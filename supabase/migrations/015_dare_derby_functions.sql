-- ============================================================
-- LDR-Connect: Migration 015 — Dare Derby Functions
-- Jalankan SETELAH 014_dare_derby_tables.sql
--
-- Functions:
--   1. select_dare_derby_minigames  — pilih mini-game balanced random
--   2. ready_up_dare_derby          — tandai player siap, mulai game
--   3. submit_dare_derby_round      — submit skor mini-game, tentukan loser
--   4. complete_dare_derby_dare     — loser tandai dare selesai
--   5. confirm_dare_derby_dare      — partner konfirmasi dare
--   6. skip_dare_derby_dare         — loser skip dare (+ penalti)
--
-- Catatan board_config & game_state:
--   board_config = { total_rounds, dare_level, custom_dares, minigame_sequence }
--   game_state   = { phase, current_round, ready, round_submissions,
--                    skip_counts, dare_counts, is_replay_round,
--                    pending_bonus_for, last_round_result }
--   questions    = array hasil tiap ronde (append tiap ronde selesai)
-- ============================================================

-- ============================================================
-- FUNCTION: select_dare_derby_minigames
--
-- Dipanggil dari API route saat host create session.
-- Mengembalikan array game_id yang sudah di-shuffle dengan
-- distribusi balanced per kategori.
--
-- Distribusi:
--   5 ronde  → 2 Reflex + 2 Brain + 1 Skill
--   7 ronde  → 3 Reflex + 2 Brain + 2 Skill
--   10 ronde → 4 Reflex + 3 Brain + 3 Skill
-- ============================================================
CREATE OR REPLACE FUNCTION public.select_dare_derby_minigames(p_total_rounds INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reflex_count INTEGER;
  v_brain_count  INTEGER;
  v_skill_count  INTEGER;
  v_result       JSONB;
BEGIN
  CASE p_total_rounds
    WHEN 5  THEN v_reflex_count := 2; v_brain_count := 2; v_skill_count := 1;
    WHEN 7  THEN v_reflex_count := 3; v_brain_count := 2; v_skill_count := 2;
    WHEN 10 THEN v_reflex_count := 4; v_brain_count := 3; v_skill_count := 3;
    ELSE
      RAISE EXCEPTION 'INVALID_ROUND_COUNT'
        USING DETAIL = 'Jumlah ronde harus 5, 7, atau 10';
  END CASE;

  WITH
    reflex_pick AS (
      SELECT game_id FROM public.game_minigame_configs
      WHERE category = 'reflex' AND is_active = true
      ORDER BY random() LIMIT v_reflex_count
    ),
    brain_pick AS (
      SELECT game_id FROM public.game_minigame_configs
      WHERE category = 'brain' AND is_active = true
      ORDER BY random() LIMIT v_brain_count
    ),
    skill_pick AS (
      SELECT game_id FROM public.game_minigame_configs
      WHERE category = 'skill' AND is_active = true
      ORDER BY random() LIMIT v_skill_count
    ),
    all_picks AS (
      SELECT game_id FROM reflex_pick
      UNION ALL SELECT game_id FROM brain_pick
      UNION ALL SELECT game_id FROM skill_pick
    )
  SELECT jsonb_agg(game_id ORDER BY random())
  INTO v_result
  FROM all_picks;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- FUNCTION: ready_up_dare_derby
--
-- Dipanggil saat player tap "Siap!" di lobby.
-- Ketika keduanya ready → phase 'lobby' → 'playing' (ronde 1 dimulai).
-- Session harus sudah 'playing' (partner sudah join).
-- ============================================================
CREATE OR REPLACE FUNCTION public.ready_up_dare_derby(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_my_role       TEXT;
  v_new_gs        JSONB;
  v_host_ready    BOOLEAN;
  v_partner_ready BOOLEAN;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE'
      USING DETAIL = 'Partner belum join sesi';
  END IF;

  v_gs := v_session.game_state;

  IF v_gs->>'phase' != 'lobby' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Game sudah dimulai';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  v_new_gs := v_gs || jsonb_build_object(
    'ready',
    (v_gs->'ready') || jsonb_build_object(v_my_role, true)
  );

  v_host_ready    := COALESCE((v_new_gs->'ready'->>'host')::boolean, false);
  v_partner_ready := COALESCE((v_new_gs->'ready'->>'partner')::boolean, false);

  IF v_host_ready AND v_partner_ready THEN
    v_new_gs := v_new_gs || jsonb_build_object('phase', 'playing');
  END IF;

  UPDATE public.game_sessions
  SET game_state = v_new_gs, updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: submit_dare_derby_round
--
-- Dipanggil tiap player saat mini-game selesai.
-- - Submission pertama   → simpan skor, tunggu partner
-- - Submission kedua     → bandingkan skor, tentukan loser, assign dare
-- - Draw (skor sama)     → replay ronde yang sama (1x)
-- - Draw pada replay     → tiebreaker via time_taken (lebih cepat = menang)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_dare_derby_round(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_score        INTEGER,              -- 0–100
  p_time_taken   INTEGER,              -- milliseconds
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_dare_level    TEXT;
  v_minigame_id   TEXT;
  v_host_sub      JSONB;
  v_partner_sub   JSONB;
  v_host_score    INTEGER;
  v_partner_score INTEGER;
  v_host_time     INTEGER;
  v_partner_time  INTEGER;
  v_loser         TEXT;
  v_is_replay     BOOLEAN;
  v_dare_id       BIGINT;
  v_dare_content  TEXT;
  v_dare_category TEXT;
  v_round_result  JSONB;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE'
      USING DETAIL = 'Sesi tidak dalam status playing';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'playing' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Bukan fase mini-game saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  -- Cegah double submit
  IF v_gs->'round_submissions'->v_my_role IS NOT NULL
     AND v_gs->'round_submissions'->v_my_role != 'null'::jsonb THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED'
      USING DETAIL = 'Kamu sudah mengirim skor untuk ronde ini';
  END IF;

  -- Simpan submission
  v_new_gs := v_gs || jsonb_build_object(
    'round_submissions',
    (v_gs->'round_submissions') || jsonb_build_object(
      v_my_role,
      jsonb_build_object(
        'score',        p_score,
        'time_taken',   p_time_taken,
        'submitted_at', now()::text,
        'metadata',     p_metadata
      )
    )
  );

  v_host_sub    := v_new_gs->'round_submissions'->'host';
  v_partner_sub := v_new_gs->'round_submissions'->'partner';

  -- Jika salah satu belum submit → simpan dan tunggu
  IF v_host_sub IS NULL OR v_host_sub = 'null'::jsonb
     OR v_partner_sub IS NULL OR v_partner_sub = 'null'::jsonb THEN
    UPDATE public.game_sessions
    SET game_state = v_new_gs, updated_at = now()
    WHERE id = v_session.id;

    RETURN jsonb_build_object('waiting_for_partner', true, 'game_state', v_new_gs);
  END IF;

  -- Keduanya sudah submit → hitung hasil
  v_host_score    := (v_host_sub->>'score')::int;
  v_partner_score := (v_partner_sub->>'score')::int;
  v_host_time     := (v_host_sub->>'time_taken')::int;
  v_partner_time  := (v_partner_sub->>'time_taken')::int;
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;
  v_dare_level    := v_bc->>'dare_level';
  v_minigame_id   := v_bc->'minigame_sequence'->>(v_current_round - 1);
  v_is_replay     := COALESCE((v_gs->>'is_replay_round')::boolean, false);

  -- Tentukan loser
  IF v_host_score > v_partner_score THEN
    v_loser := 'partner';
  ELSIF v_partner_score > v_host_score THEN
    v_loser := 'host';
  ELSIF v_is_replay THEN
    -- Draw pada replay → tiebreaker: waktu lebih cepat menang
    IF v_host_time < v_partner_time THEN
      v_loser := 'partner';
    ELSIF v_partner_time < v_host_time THEN
      v_loser := 'host';
    ELSE
      -- Waktu identik → coin flip
      v_loser := CASE WHEN random() > 0.5 THEN 'host' ELSE 'partner' END;
    END IF;
  ELSE
    v_loser := 'draw';
  END IF;

  -- Assign dare jika bukan draw
  IF v_loser != 'draw' THEN
    -- Coba ambil dare yang belum dipakai di session ini
    SELECT dq.id, dq.content, dq.category
    INTO v_dare_id, v_dare_content, v_dare_category
    FROM public.game_dare_questions dq
    WHERE dq.is_active = true
      AND CASE v_dare_level
            WHEN 'sweet_only' THEN dq.category = 'sweet'
            WHEN 'full_chaos' THEN true
            ELSE dq.category IN ('sweet', 'funny', 'bold')  -- mixed (default)
          END
      AND dq.id NOT IN (
        SELECT (r->>'dare_id')::bigint
        FROM jsonb_array_elements(v_session.questions) r
        WHERE r->>'dare_id' IS NOT NULL
      )
    ORDER BY random()
    LIMIT 1;

    -- Jika semua dare sudah terpakai → izinkan repetisi
    IF NOT FOUND THEN
      SELECT dq.id, dq.content, dq.category
      INTO v_dare_id, v_dare_content, v_dare_category
      FROM public.game_dare_questions dq
      WHERE dq.is_active = true
        AND CASE v_dare_level
              WHEN 'sweet_only' THEN dq.category = 'sweet'
              WHEN 'full_chaos' THEN true
              ELSE dq.category IN ('sweet', 'funny', 'bold')
            END
      ORDER BY random()
      LIMIT 1;
    END IF;

    -- Update dare count
    v_new_gs := v_new_gs || jsonb_build_object(
      'dare_counts',
      (v_gs->'dare_counts') || jsonb_build_object(
        v_loser, ((v_gs->'dare_counts'->>v_loser)::int + 1)
      )
    );
  END IF;

  -- Buat round result
  v_round_result := jsonb_build_object(
    'round_number',  v_current_round,
    'minigame_id',   v_minigame_id,
    'host_score',    v_host_score,
    'partner_score', v_partner_score,
    'loser',         v_loser,
    'dare_id',       v_dare_id,
    'dare_content',  v_dare_content,
    'dare_category', v_dare_category,
    'dare_status',   CASE WHEN v_loser != 'draw' THEN 'pending' ELSE NULL END,
    'confirmed_at',  NULL
  );

  -- Append ke questions (kecuali draw awal — draw dicatat tapi tidak dicount)
  v_new_questions := v_session.questions || jsonb_build_array(v_round_result);

  IF v_loser = 'draw' THEN
    -- Reset submission untuk replay ronde yang sama
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase',             'playing',
      'is_replay_round',   true,
      'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
      'last_round_result', v_round_result,
      'pending_bonus_for', NULL
    );
  ELSE
    -- Tampilkan result + dare
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase',             'result',
      'is_replay_round',   false,
      'last_round_result', v_round_result,
      'pending_bonus_for', NULL
    );
  END IF;

  UPDATE public.game_sessions
  SET game_state = v_new_gs,
      questions  = v_new_questions,
      updated_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'waiting_for_partner', false,
    'round_result',        v_round_result,
    'game_state',          v_new_gs
  );
END;
$$;

-- ============================================================
-- FUNCTION: complete_dare_derby_dare
--
-- Dipanggil oleh loser setelah menyelesaikan dare.
-- Mengubah dare_status: 'pending' → 'awaiting_confirm'
-- Kemudian partner bisa konfirmasi via confirm_dare_derby_dare.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_my_role       TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  v_gs := v_session.game_state;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Bukan fase dare saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  v_last_result   := v_gs->'last_round_result';
  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;

  IF v_my_role != v_loser THEN
    RAISE EXCEPTION 'NOT_THE_LOSER'
      USING DETAIL = 'Hanya yang kalah yang bisa menyelesaikan dare';
  END IF;

  IF v_last_result->>'dare_status' != 'pending' THEN
    RAISE EXCEPTION 'DARE_NOT_PENDING'
      USING DETAIL = 'Dare bukan dalam status pending';
  END IF;

  -- Update dare_status di questions array
  v_new_questions := (
    SELECT jsonb_agg(
      CASE
        WHEN (q->>'round_number')::int = v_current_round
             AND q->>'loser' = v_loser
             AND q->>'dare_status' = 'pending'
        THEN q || jsonb_build_object('dare_status', 'awaiting_confirm')
        ELSE q
      END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  v_new_gs := v_gs || jsonb_build_object(
    'last_round_result',
    v_last_result || jsonb_build_object('dare_status', 'awaiting_confirm')
  );

  UPDATE public.game_sessions
  SET game_state = v_new_gs,
      questions  = v_new_questions,
      updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: confirm_dare_derby_dare
--
-- Dipanggil oleh partner (bukan loser) untuk konfirmasi dare.
-- p_confirmed = true  → dare selesai, lanjut ronde berikutnya / game over
-- p_confirmed = false → dare dikembalikan ke 'pending' (loser ulangi)
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_confirmed    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Bukan fase konfirmasi dare';
  END IF;

  v_last_result := v_gs->'last_round_result';

  IF v_last_result->>'dare_status' != 'awaiting_confirm' THEN
    RAISE EXCEPTION 'DARE_NOT_AWAITING'
      USING DETAIL = 'Dare belum ditandai selesai oleh yang kalah';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;

  -- Hanya winner (bukan loser) yang bisa konfirmasi
  IF v_my_role = v_loser THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_OWN'
      USING DETAIL = 'Kamu tidak bisa konfirmasi dare milikmu sendiri';
  END IF;

  IF p_confirmed THEN
    -- Dare diterima → tandai selesai
    v_new_questions := (
      SELECT jsonb_agg(
        CASE
          WHEN (q->>'round_number')::int = v_current_round
               AND q->>'loser' = v_loser
          THEN q || jsonb_build_object(
                 'dare_status',  'completed',
                 'confirmed_at', now()::text
               )
          ELSE q
        END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );

    IF v_current_round >= v_total_rounds THEN
      -- Game over
      v_new_gs := v_gs || jsonb_build_object(
        'phase',             'game_over',
        'last_round_result', v_last_result || jsonb_build_object(
          'dare_status', 'completed', 'confirmed_at', now()::text
        )
      );

      UPDATE public.game_sessions
      SET game_state = v_new_gs,
          questions  = v_new_questions,
          status     = 'completed',
          updated_at = now()
      WHERE id = v_session.id;
    ELSE
      -- Lanjut ke ronde berikutnya
      v_new_gs := v_gs || jsonb_build_object(
        'phase',             'playing',
        'current_round',     v_current_round + 1,
        'is_replay_round',   false,
        'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
        'last_round_result', v_last_result || jsonb_build_object(
          'dare_status', 'completed', 'confirmed_at', now()::text
        )
      );

      UPDATE public.game_sessions
      SET game_state = v_new_gs,
          questions  = v_new_questions,
          updated_at = now()
      WHERE id = v_session.id;
    END IF;
  ELSE
    -- Dare ditolak → loser harus ulangi (kembali ke 'pending')
    v_new_questions := (
      SELECT jsonb_agg(
        CASE
          WHEN (q->>'round_number')::int = v_current_round
               AND q->>'loser' = v_loser
          THEN q || jsonb_build_object('dare_status', 'pending')
          ELSE q
        END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );

    v_new_gs := v_gs || jsonb_build_object(
      'last_round_result',
      v_last_result || jsonb_build_object('dare_status', 'pending')
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        questions  = v_new_questions,
        updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: skip_dare_derby_dare
--
-- Dipanggil loser untuk skip dare dengan konsekuensi:
--   Skip 1x → tidak ada penalti (tercatat)
--   Skip 2x → lawan dapat pending_bonus_for (+50 poin di ronde berikutnya)
--   Skip 3x → forfeit, loser otomatis kalah, session selesai
-- ============================================================
CREATE OR REPLACE FUNCTION public.skip_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_opponent_role TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_skip_count    INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
  v_is_last_round BOOLEAN;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Bukan fase dare saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  v_last_result   := v_gs->'last_round_result';
  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;
  v_opponent_role := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
  v_is_last_round := v_current_round >= v_total_rounds;

  IF v_my_role != v_loser THEN
    RAISE EXCEPTION 'NOT_THE_LOSER'
      USING DETAIL = 'Hanya yang kalah yang bisa skip dare';
  END IF;

  IF v_last_result->>'dare_status' NOT IN ('pending', 'awaiting_confirm') THEN
    RAISE EXCEPTION 'DARE_NOT_SKIPPABLE';
  END IF;

  -- Increment skip count
  v_skip_count := (v_gs->'skip_counts'->>v_my_role)::int + 1;

  -- Update questions: tandai dare sebagai skipped
  v_new_questions := (
    SELECT jsonb_agg(
      CASE
        WHEN (q->>'round_number')::int = v_current_round
             AND q->>'loser' = v_loser
        THEN q || jsonb_build_object('dare_status', 'skipped')
        ELSE q
      END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  v_new_gs := v_gs || jsonb_build_object(
    'skip_counts',
    (v_gs->'skip_counts') || jsonb_build_object(v_my_role, v_skip_count)
  );

  IF v_skip_count >= 3 THEN
    -- Forfeit: loser otomatis kalah keseluruhan
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase',             'game_over',
      'forfeit_by',        v_my_role,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        questions  = v_new_questions,
        status     = 'completed',
        updated_at = now()
    WHERE id = v_session.id;

  ELSIF v_is_last_round THEN
    -- Skip di ronde terakhir → game over
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase',             'game_over',
      'pending_bonus_for', NULL,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        questions  = v_new_questions,
        status     = 'completed',
        updated_at = now()
    WHERE id = v_session.id;

  ELSE
    -- Lanjut ke ronde berikutnya + terapkan penalti jika skip ke-2
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase',             'playing',
      'current_round',     v_current_round + 1,
      'is_replay_round',   false,
      'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
      -- Skip ke-2: lawan dapat bonus di ronde berikutnya
      'pending_bonus_for', CASE WHEN v_skip_count = 2 THEN v_opponent_role ELSE NULL END,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        questions  = v_new_questions,
        updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;
