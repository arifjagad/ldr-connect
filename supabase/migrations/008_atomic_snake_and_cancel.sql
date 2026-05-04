-- ============================================================
-- LDR-Connect: Migration 008 — Atomic Snake Game & Cancel/Refund
-- Jalankan SETELAH 007_fix_create_game_session_ambiguity.sql
--
-- Fixes:
-- RC-01: roll/confirm snake tidak atomic (tidak ada FOR UPDATE)
-- RC-02: cancel + refund tidak atomic (TOCTOU, double refund)
-- ============================================================

-- ============================================================
-- FUNCTION: roll_snake_dice
-- Lempar dadu ular tangga secara atomic (lock sesi dulu)
-- Dipanggil dari: POST /api/game/snake/session/[code]/roll
-- ============================================================
CREATE OR REPLACE FUNCTION public.roll_snake_dice(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session    public.game_sessions;
  v_gs         JSONB;
  v_bc         JSONB;
  v_my_role    TEXT;
  v_dice       INTEGER;
  v_current    INTEGER;
  v_landed     INTEGER;
  v_final      INTEGER;
  v_bounced    BOOLEAN;
  v_snake      JSONB;
  v_ladder     JSONB;
  v_challenge  JSONB;
  v_last_roll  JSONB;
  v_new_gs     JSONB;
  v_next_turn  TEXT;
BEGIN
  -- Ambil + lock sesi (mencegah concurrent roll dari kedua player)
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'snake_ladder'
    AND status       = 'playing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan atau tidak aktif';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  -- Tentukan role user
  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  -- Validasi giliran
  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN'
      USING DETAIL = 'Bukan giliranmu';
  END IF;

  -- Validasi tidak ada pending challenge
  IF v_gs->'pending_challenge' IS NOT NULL
     AND v_gs->'pending_challenge' != 'null'::jsonb
  THEN
    RAISE EXCEPTION 'PENDING_CHALLENGE'
      USING DETAIL = 'Selesaikan tantangan dulu';
  END IF;

  -- Lempar dadu (1–6)
  v_dice := floor(random() * 6 + 1)::int;

  -- Posisi saat ini
  IF v_my_role = 'host' THEN
    v_current := (v_gs->>'host_position')::int;
  ELSE
    v_current := (v_gs->>'partner_position')::int;
  END IF;

  -- Hitung posisi setelah dadu
  v_landed  := v_current + v_dice;
  v_bounced := false;

  -- Bounce jika melewati 100
  IF v_landed > 100 THEN
    v_landed  := 100 - (v_landed - 100);
    v_bounced := true;
  END IF;

  -- Cek ular di posisi landing
  SELECT s INTO v_snake
  FROM jsonb_array_elements(v_bc->'snakes') s
  WHERE (s->>'from')::int = v_landed
  LIMIT 1;

  -- Cek tangga di posisi landing
  SELECT l INTO v_ladder
  FROM jsonb_array_elements(v_bc->'ladders') l
  WHERE (l->>'from')::int = v_landed
  LIMIT 1;

  -- Posisi akhir setelah ular/tangga
  v_final := v_landed;
  IF v_snake IS NOT NULL THEN
    v_final := (v_snake->>'to')::int;
  ELSIF v_ladder IS NOT NULL THEN
    v_final := (v_ladder->>'to')::int;
  END IF;

  -- Buat objek last_roll
  v_last_roll := jsonb_build_object(
    'player',      v_my_role,
    'dice',        v_dice,
    'from',        v_current,
    'landed',      v_landed,
    'final',       v_final,
    'snake_from',  CASE WHEN v_snake   IS NOT NULL THEN (v_snake->>'from')::int   ELSE NULL END,
    'ladder_from', CASE WHEN v_ladder  IS NOT NULL THEN (v_ladder->>'from')::int  ELSE NULL END,
    'bounced',     v_bounced
  );

  -- Terapkan posisi baru ke game_state
  v_new_gs := v_gs || jsonb_build_object('last_roll', v_last_roll);

  IF v_my_role = 'host' THEN
    v_new_gs := v_new_gs || jsonb_build_object('host_position', v_final);
  ELSE
    v_new_gs := v_new_gs || jsonb_build_object('partner_position', v_final);
  END IF;

  -- Kondisi menang: tepat posisi 100
  IF v_final = 100 THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'winner',            v_my_role,
      'current_turn',      v_my_role,
      'pending_challenge', NULL
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        status     = 'completed',
        updated_at = now()
    WHERE id = v_session.id;

    RETURN v_new_gs;
  END IF;

  -- Cek tantangan di posisi akhir
  SELECT c INTO v_challenge
  FROM jsonb_array_elements(v_bc->'challenges') c
  WHERE (c->>'square')::int = v_final
  LIMIT 1;

  IF v_challenge IS NOT NULL THEN
    -- Ada tantangan: set pending_challenge
    v_new_gs := v_new_gs || jsonb_build_object(
      'pending_challenge', jsonb_build_object(
        'player',    v_my_role,
        'square',    v_final,
        'type',      v_challenge->>'type',
        'question',  v_challenge->>'question',
        'category',  v_challenge->>'category',
        'roll_again', (v_dice = 6 AND NOT v_bounced)
      )
    );
  ELSIF v_dice = 6 AND NOT v_bounced THEN
    -- Dadu 6 tanpa tantangan → main lagi
    v_new_gs := v_new_gs || jsonb_build_object(
      'current_turn',      v_my_role,
      'pending_challenge', NULL
    );
  ELSE
    -- Giliran berganti
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object(
      'current_turn',      v_next_turn,
      'pending_challenge', NULL
    );
  END IF;

  UPDATE public.game_sessions
  SET game_state = v_new_gs,
      updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: confirm_snake_challenge
-- Partner konfirmasi tantangan selesai — atomic dengan FOR UPDATE
-- Dipanggil dari: POST /api/game/snake/session/[code]/confirm
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_snake_challenge(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session          public.game_sessions;
  v_gs               JSONB;
  v_challenger       TEXT;
  v_challenger_uid   UUID;
  v_roll_again       BOOLEAN;
  v_next_turn        TEXT;
  v_new_gs           JSONB;
BEGIN
  -- Ambil + lock sesi
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'snake_ladder'
    AND status       = 'playing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan atau tidak aktif';
  END IF;

  v_gs := v_session.game_state;

  -- Pastikan ada pending challenge
  IF v_gs->'pending_challenge' IS NULL
     OR v_gs->'pending_challenge' = 'null'::jsonb
  THEN
    RAISE EXCEPTION 'NO_PENDING_CHALLENGE'
      USING DETAIL = 'Tidak ada tantangan yang perlu dikonfirmasi';
  END IF;

  v_challenger := v_gs->'pending_challenge'->>'player';

  -- Tentukan user_id challenger
  IF v_challenger = 'host' THEN
    v_challenger_uid := v_session.host_user_id;
  ELSE
    v_challenger_uid := v_session.partner_user_id;
  END IF;

  -- Challenger tidak bisa konfirmasi tantangannya sendiri
  IF p_user_id = v_challenger_uid THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_OWN'
      USING DETAIL = 'Kamu tidak bisa mengkonfirmasi tantanganmu sendiri';
  END IF;

  -- Pastikan konfirmator adalah peserta sesi (bukan random user)
  IF p_user_id != v_session.host_user_id AND p_user_id != v_session.partner_user_id THEN
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  v_roll_again := (v_gs->'pending_challenge'->>'roll_again')::boolean;

  -- Tentukan giliran berikutnya
  IF v_roll_again THEN
    v_next_turn := v_challenger;
  ELSE
    v_next_turn := CASE WHEN v_challenger = 'host' THEN 'partner' ELSE 'host' END;
  END IF;

  v_new_gs := v_gs || jsonb_build_object(
    'pending_challenge', NULL,
    'current_turn',      v_next_turn
  );

  UPDATE public.game_sessions
  SET game_state = v_new_gs,
      updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: cancel_game_session
-- Batalkan sesi + refund coin (atomic, mencegah double refund)
-- Dipanggil dari: POST /api/game/tod/session/[code]/cancel
--                 POST /api/game/snake/session/[code]/cancel (jika ada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_game_session(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.game_sessions;
BEGIN
  -- Ambil + lock sesi (mencegah concurrent cancel → double refund)
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  -- Hanya host yang boleh cancel
  IF v_session.host_user_id != p_user_id THEN
    RAISE EXCEPTION 'NOT_HOST'
      USING DETAIL = 'Hanya host yang bisa membatalkan sesi';
  END IF;

  -- Idempotent: sudah tidak aktif → return tanpa error
  IF NOT (v_session.status = ANY(ARRAY['waiting'::varchar, 'playing'::varchar])) THEN
    RETURN;
  END IF;

  -- Update status ke cancelled
  UPDATE public.game_sessions
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id = v_session.id;

  -- Refund hanya jika: status masih 'waiting', belum direfund, ada coin yang dipotong
  IF v_session.status = 'waiting'
     AND v_session.coin_refunded_at IS NULL
     AND v_session.coin_deducted > 0
  THEN
    -- Kembalikan coin ke host (UPDATE atomic, tidak perlu SELECT FOR UPDATE terpisah)
    UPDATE public.wallets
    SET balance    = balance + v_session.coin_deducted,
        updated_at = now()
    WHERE user_id = v_session.host_user_id;

    -- Catat transaksi refund
    INSERT INTO public.coin_transactions (
      user_id, type, amount, payment_status, metadata
    ) VALUES (
      v_session.host_user_id,
      'topup',
      v_session.coin_deducted,
      'paid',
      jsonb_build_object(
        'reason',       'session_cancelled_refund',
        'session_code', p_session_code,
        'session_id',   v_session.id
      )
    );

    -- Tandai sudah direfund (atomic dalam transaksi yang sama)
    UPDATE public.game_sessions
    SET coin_refunded_at = now()
    WHERE id = v_session.id;
  END IF;
END;
$$;
