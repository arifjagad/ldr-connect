-- ============================================================
-- LDR-Connect: Migration 024 — Quoridor Game
-- Jalankan SETELAH 023_capsules.sql
--
-- Isi:
--   1. Seed game_settings untuk 'quoridor'
--   2. Stored function: quoridor_action (move + wall placement, atomic)
-- ============================================================

-- ============================================================
-- 1. Update CHECK constraint game_sessions.game_type
--    Tambahkan 'quoridor' ke daftar game_type yang diperbolehkan
-- ============================================================
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN ('tod', 'snake_ladder', 'quiz', 'dare_derby', 'quoridor'));

-- ============================================================
-- 2. Seed game_settings

INSERT INTO public.game_settings (game_type, display_name, description, coin_cost, expires_in_minutes, is_active)
VALUES (
  'quoridor',
  'Quoridor',
  'Game strategi papan 9×9. Gerakkan pion atau pasang tembok — yang pertama mencapai garis lawan menang!',
  3,
  30,
  true
)
ON CONFLICT (game_type) DO UPDATE
  SET display_name       = EXCLUDED.display_name,
      description        = EXCLUDED.description,
      coin_cost          = EXCLUDED.coin_cost,
      expires_in_minutes = EXCLUDED.expires_in_minutes,
      updated_at         = now();

-- ============================================================
-- FUNCTION: quoridor_action
-- Atomic move atau wall placement untuk game Quoridor
-- Dipanggil dari: POST /api/game/quoridor/session/[code]/action
--
-- p_action_type: 'move' | 'wall'
-- p_payload:
--   move → { "r": number, "c": number }
--   wall → { "orientation": "H"|"V", "r": number, "c": number }
-- ============================================================
CREATE OR REPLACE FUNCTION public.quoridor_action(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_action_type  VARCHAR(10),
  p_payload      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session    public.game_sessions;
  v_gs         JSONB;
  v_my_role    TEXT;
  v_new_gs     JSONB;
  v_next_turn  TEXT;

  -- Posisi pion
  v_host_pos   JSONB;
  v_part_pos   JSONB;
  v_my_pos     JSONB;
  v_opp_pos    JSONB;

  -- Wall data
  v_walls      JSONB;
  v_walls_left JSONB;
  v_my_walls   INTEGER;
  v_new_wall   JSONB;
  v_wall_elem  JSONB;
  v_conflict   BOOLEAN;

  -- Move data
  v_new_r      INTEGER;
  v_new_c      INTEGER;
  v_my_r       INTEGER;
  v_my_c       INTEGER;
  v_opp_r      INTEGER;
  v_opp_c      INTEGER;
  v_diff_r     INTEGER;
  v_diff_c     INTEGER;

  -- Win condition
  v_winner     TEXT;
  v_target_row INTEGER;

  -- Last action
  v_last_action JSONB;
BEGIN
  -- ── Lock sesi ────────────────────────────────────────────────────────────
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'quoridor'
    AND status       = 'playing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan atau tidak aktif';
  END IF;

  -- Cek expiry
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_session.id;
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  v_gs := v_session.game_state;

  -- ── Tentukan role ─────────────────────────────────────────────────────────
  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  -- ── Validasi giliran ──────────────────────────────────────────────────────
  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN'
      USING DETAIL = 'Bukan giliranmu';
  END IF;

  v_host_pos   := v_gs->'host_pos';
  v_part_pos   := v_gs->'partner_pos';
  v_walls      := COALESCE(v_gs->'walls', '[]'::jsonb);
  v_walls_left := v_gs->'walls_left';

  IF v_my_role = 'host' THEN
    v_my_pos  := v_host_pos;
    v_opp_pos := v_part_pos;
  ELSE
    v_my_pos  := v_part_pos;
    v_opp_pos := v_host_pos;
  END IF;

  v_my_r  := (v_my_pos->>'r')::int;
  v_my_c  := (v_my_pos->>'c')::int;
  v_opp_r := (v_opp_pos->>'r')::int;
  v_opp_c := (v_opp_pos->>'c')::int;

  -- ── Handle MOVE ──────────────────────────────────────────────────────────
  IF p_action_type = 'move' THEN
    v_new_r := (p_payload->>'r')::int;
    v_new_c := (p_payload->>'c')::int;

    -- Validasi koordinat dalam batas board (0–8)
    IF v_new_r < 0 OR v_new_r > 8 OR v_new_c < 0 OR v_new_c > 8 THEN
      RAISE EXCEPTION 'INVALID_MOVE'
        USING DETAIL = 'Posisi di luar papan';
    END IF;

    v_diff_r := v_new_r - v_my_r;
    v_diff_c := v_new_c - v_my_c;

    -- ── Kasus normal: gerak 1 langkah ─────────────────────────────────────
    IF NOT (v_new_r = v_opp_r AND v_new_c = v_opp_c) THEN
      -- Harus tepat 1 langkah (r±1 atau c±1, bukan diagonal)
      IF NOT (
        (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR
        (ABS(v_diff_c) = 1 AND v_diff_r = 0)
      ) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Hanya bisa bergerak 1 langkah lurus';
      END IF;

      -- Cek apakah ada tembok yang menghalangi (simplified check)
      -- Tembok Horizontal di antara baris r dan r+1: wall {orientation:'H', r:min_r, c}
      -- Tembok Vertical di antara kolom c dan c+1: wall {orientation:'V', r, c:min_c}
      IF v_diff_r = 1 THEN  -- gerak ke bawah (dari r ke r+1)
        SELECT TRUE INTO v_conflict
        FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND (
            (w->>'c')::int = v_my_c OR
            (w->>'c')::int = v_my_c - 1
          )
        LIMIT 1;
      ELSIF v_diff_r = -1 THEN  -- gerak ke atas (dari r ke r-1)
        SELECT TRUE INTO v_conflict
        FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_new_r
          AND (
            (w->>'c')::int = v_my_c OR
            (w->>'c')::int = v_my_c - 1
          )
        LIMIT 1;
      ELSIF v_diff_c = 1 THEN  -- gerak ke kanan
        SELECT TRUE INTO v_conflict
        FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND (
            (w->>'r')::int = v_my_r OR
            (w->>'r')::int = v_my_r - 1
          )
        LIMIT 1;
      ELSIF v_diff_c = -1 THEN  -- gerak ke kiri
        SELECT TRUE INTO v_conflict
        FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_new_c
          AND (
            (w->>'r')::int = v_my_r OR
            (w->>'r')::int = v_my_r - 1
          )
        LIMIT 1;
      END IF;

      IF v_conflict IS TRUE THEN
        RAISE EXCEPTION 'BLOCKED_BY_WALL'
          USING DETAIL = 'Jalur diblokir oleh tembok';
      END IF;

    -- ── Kasus: mencoba menuju posisi pion lawan (tidak diizinkan) ─────────
    ELSE
      RAISE EXCEPTION 'INVALID_MOVE'
        USING DETAIL = 'Tidak bisa menuju posisi yang ditempati lawan';
    END IF;

    -- Terapkan posisi baru
    v_last_action := jsonb_build_object(
      'player',  v_my_role,
      'type',    'move',
      'payload', jsonb_build_object('r', v_new_r, 'c', v_new_c)
    );

    IF v_my_role = 'host' THEN
      v_new_gs := v_gs || jsonb_build_object(
        'host_pos',    jsonb_build_object('r', v_new_r, 'c', v_new_c),
        'last_action', v_last_action
      );
      v_target_row := 8;  -- host menang kalau capai baris 8
      IF v_new_r = v_target_row THEN v_winner := 'host'; END IF;
    ELSE
      v_new_gs := v_gs || jsonb_build_object(
        'partner_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c),
        'last_action', v_last_action
      );
      v_target_row := 0;  -- partner menang kalau capai baris 0
      IF v_new_r = v_target_row THEN v_winner := 'partner'; END IF;
    END IF;

  -- ── Handle WALL ──────────────────────────────────────────────────────────
  ELSIF p_action_type = 'wall' THEN
    -- Cek sisa tembok
    v_my_walls := CASE
      WHEN v_my_role = 'host'    THEN (v_walls_left->>'host')::int
      ELSE                            (v_walls_left->>'partner')::int
    END;

    IF v_my_walls <= 0 THEN
      RAISE EXCEPTION 'NO_WALLS_LEFT'
        USING DETAIL = 'Kamu sudah tidak punya tembok';
    END IF;

    v_new_wall := jsonb_build_object(
      'orientation', p_payload->>'orientation',
      'r',           (p_payload->>'r')::int,
      'c',           (p_payload->>'c')::int
    );

    -- Validasi koordinat wall (0–7 untuk kedua dimensi)
    IF (v_new_wall->>'r')::int < 0 OR (v_new_wall->>'r')::int > 7
       OR (v_new_wall->>'c')::int < 0 OR (v_new_wall->>'c')::int > 7
    THEN
      RAISE EXCEPTION 'INVALID_WALL'
        USING DETAIL = 'Posisi tembok di luar papan';
    END IF;

    IF (v_new_wall->>'orientation') NOT IN ('H', 'V') THEN
      RAISE EXCEPTION 'INVALID_WALL'
        USING DETAIL = 'Orientasi tembok tidak valid (H atau V)';
    END IF;

    -- Cek overlap dengan tembok yang sudah ada
    FOR v_wall_elem IN SELECT * FROM jsonb_array_elements(v_walls)
    LOOP
      IF (v_wall_elem->>'orientation') = (v_new_wall->>'orientation')
         AND (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int
         AND (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int
      THEN
        RAISE EXCEPTION 'WALL_OVERLAP'
          USING DETAIL = 'Posisi tembok sudah terpakai';
      END IF;

      -- Cek cross overlap (tembok H dan V yang saling memotong di titik tengah)
      IF (v_wall_elem->>'orientation') != (v_new_wall->>'orientation')
         AND (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int
         AND (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int
      THEN
        RAISE EXCEPTION 'WALL_OVERLAP'
          USING DETAIL = 'Tembok saling berpotongan';
      END IF;
    END LOOP;

    -- Tambahkan tembok baru
    v_walls := v_walls || jsonb_build_array(v_new_wall);

    -- Kurangi sisa tembok
    IF v_my_role = 'host' THEN
      v_walls_left := v_walls_left || jsonb_build_object('host', v_my_walls - 1);
    ELSE
      v_walls_left := v_walls_left || jsonb_build_object('partner', v_my_walls - 1);
    END IF;

    v_last_action := jsonb_build_object(
      'player',  v_my_role,
      'type',    'wall',
      'payload', v_new_wall
    );

    v_new_gs := v_gs || jsonb_build_object(
      'walls',       v_walls,
      'walls_left',  v_walls_left,
      'last_action', v_last_action
    );

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION'
      USING DETAIL = 'action_type harus move atau wall';
  END IF;

  -- ── Ganti giliran (jika belum ada pemenang) ───────────────────────────────
  IF v_winner IS NOT NULL THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'winner',       v_winner,
      'current_turn', v_my_role
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        status     = 'completed',
        updated_at = now()
    WHERE id = v_session.id;
  ELSE
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object(
      'current_turn', v_next_turn,
      'winner',       NULL
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;
