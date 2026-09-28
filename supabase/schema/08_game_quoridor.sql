-- ============================================================
-- LDR-Connect Schema — 08 Game — Quoridor
-- Jalankan SETELAH 07_game_dare_derby.sql
--
-- Validasi jalur (BFS) + aksi gerak/tembok atomik.
-- ============================================================

-- ============================================================
-- FUNCTION: quoridor_has_path (migration 026)
-- BFS dari (p_start_r, p_start_c) menuju baris p_target_row.
-- Return TRUE jika jalur ada, FALSE jika diblokir total.
-- ============================================================
CREATE OR REPLACE FUNCTION public.quoridor_has_path(
  p_start_r    INTEGER,
  p_start_c    INTEGER,
  p_target_row INTEGER,
  p_walls      JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_visited  BOOLEAN[9][9];
  v_queue    INTEGER[];
  v_head     INTEGER;
  v_tail     INTEGER;
  v_node     INTEGER;
  v_r        INTEGER;
  v_c        INTEGER;
BEGIN
  v_visited := ARRAY_FILL(FALSE, ARRAY[9, 9]);
  v_visited[p_start_r + 1][p_start_c + 1] := TRUE;

  v_queue := ARRAY[p_start_r * 9 + p_start_c];
  v_head  := 1;
  v_tail  := 1;

  WHILE v_head <= v_tail LOOP
    v_node  := v_queue[v_head];
    v_head  := v_head + 1;
    v_r     := v_node / 9;
    v_c     := v_node % 9;

    IF v_r = p_target_row THEN
      RETURN TRUE;
    END IF;

    -- Atas
    IF v_r > 0 AND NOT v_visited[v_r][v_c + 1] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_r - 1
          AND ((w->>'c')::int = v_c OR (w->>'c')::int = v_c - 1)
      ) THEN
        v_visited[v_r][v_c + 1] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, (v_r - 1) * 9 + v_c);
      END IF;
    END IF;

    -- Bawah
    IF v_r < 8 AND NOT v_visited[v_r + 2][v_c + 1] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_r
          AND ((w->>'c')::int = v_c OR (w->>'c')::int = v_c - 1)
      ) THEN
        v_visited[v_r + 2][v_c + 1] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, (v_r + 1) * 9 + v_c);
      END IF;
    END IF;

    -- Kiri
    IF v_c > 0 AND NOT v_visited[v_r + 1][v_c] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_c - 1
          AND ((w->>'r')::int = v_r OR (w->>'r')::int = v_r - 1)
      ) THEN
        v_visited[v_r + 1][v_c] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, v_r * 9 + (v_c - 1));
      END IF;
    END IF;

    -- Kanan
    IF v_c < 8 AND NOT v_visited[v_r + 1][v_c + 2] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_c
          AND ((w->>'r')::int = v_r OR (w->>'r')::int = v_r - 1)
      ) THEN
        v_visited[v_r + 1][v_c + 2] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, v_r * 9 + (v_c + 1));
      END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- FUNCTION: quoridor_action (state akhir — migration 027)
-- Atomic move + wall placement untuk game Quoridor.
-- Dipanggil dari: POST /api/game/quoridor/session/[code]/action
--
-- p_action_type: 'move' | 'wall'
-- p_payload:
--   move: { "r": int, "c": int }
--   wall: { "orientation": "H"|"V", "r": int, "c": int }
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

  v_host_pos   JSONB;
  v_part_pos   JSONB;
  v_my_pos     JSONB;
  v_opp_pos    JSONB;

  v_walls      JSONB;
  v_walls_left JSONB;
  v_my_walls   INTEGER;
  v_new_wall   JSONB;
  v_wall_elem  JSONB;
  v_overlap    BOOLEAN := FALSE;

  v_my_r       INTEGER;
  v_my_c       INTEGER;
  v_opp_r      INTEGER;
  v_opp_c      INTEGER;
  v_new_r      INTEGER;
  v_new_c      INTEGER;
  v_diff_r     INTEGER;
  v_diff_c     INTEGER;

  v_step_r     INTEGER;
  v_step_c     INTEGER;

  v_blocked        BOOLEAN := FALSE;
  v_jump_blocked   BOOLEAN := FALSE;
  v_valid_move     BOOLEAN := FALSE;

  v_winner      TEXT := NULL;
  v_target_row  INTEGER;
  v_last_action JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.status != 'playing' THEN
    IF v_session.status = 'completed' THEN
      RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Game sudah selesai';
    END IF;
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak aktif';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions SET status = 'expired', updated_at = now() WHERE id = v_session.id;
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  v_gs := v_session.game_state;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN' USING DETAIL = 'Bukan giliranmu';
  END IF;

  v_host_pos   := v_gs->'host_pos';
  v_part_pos   := v_gs->'partner_pos';
  v_walls      := COALESCE(v_gs->'walls', '[]'::jsonb);
  v_walls_left := v_gs->'walls_left';

  IF v_my_role = 'host' THEN
    v_my_pos := v_host_pos; v_opp_pos := v_part_pos;
  ELSE
    v_my_pos := v_part_pos; v_opp_pos := v_host_pos;
  END IF;

  v_my_r  := (v_my_pos->>'r')::int;
  v_my_c  := (v_my_pos->>'c')::int;
  v_opp_r := (v_opp_pos->>'r')::int;
  v_opp_c := (v_opp_pos->>'c')::int;

  -- ══ MOVE ══════════════════════════════════════════════════════════════════
  IF p_action_type = 'move' THEN
    v_new_r := (p_payload->>'r')::int;
    v_new_c := (p_payload->>'c')::int;

    IF v_new_r < 0 OR v_new_r > 8 OR v_new_c < 0 OR v_new_c > 8 THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi di luar papan';
    END IF;
    IF v_new_r = v_my_r AND v_new_c = v_my_c THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi tujuan sama dengan posisi saat ini';
    END IF;

    v_diff_r := v_new_r - v_my_r;
    v_diff_c := v_new_c - v_my_c;

    -- KASUS A: Gerak 1 langkah
    IF (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 1) THEN
      IF v_new_r = v_opp_r AND v_new_c = v_opp_c THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Tidak bisa bergerak ke posisi lawan';
      END IF;
      v_blocked := FALSE;
      IF v_diff_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_diff_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_diff_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      ELSIF v_diff_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_blocked, FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur diblokir oleh tembok'; END IF;
      v_valid_move := TRUE;

    -- KASUS B: Lompatan lurus 2 langkah
    ELSIF (ABS(v_diff_r) = 2 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 2) THEN
      v_step_r := v_diff_r / 2;
      v_step_c := v_diff_c / 2;
      IF v_opp_r != v_my_r + v_step_r OR v_opp_c != v_my_c + v_step_c THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Tidak ada lawan di jalur lompatan lurus';
      END IF;
      v_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_blocked, FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur menuju lawan diblokir tembok'; END IF;
      v_jump_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_jump_blocked, FALSE) THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Lompatan lurus diblokir tembok di belakang lawan — gunakan diagonal';
      END IF;
      v_valid_move := TRUE;

    -- KASUS C: Lompatan diagonal
    ELSIF ABS(v_diff_r) = 1 AND ABS(v_diff_c) = 1 THEN
      v_valid_move := FALSE;

      IF v_opp_r = v_my_r + v_diff_r AND v_opp_c = v_my_c THEN
        IF v_new_r = v_opp_r AND v_new_c = v_opp_c + v_diff_c THEN
          v_blocked := FALSE;
          IF v_diff_r = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur menuju lawan diblokir tembok'; END IF;
          v_jump_blocked := FALSE;
          IF v_opp_r+v_diff_r < 0 OR v_opp_r+v_diff_r > 8 THEN v_jump_blocked := TRUE;
          ELSIF v_diff_r = 1 THEN SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1; END IF;
          IF NOT COALESCE(v_jump_blocked,FALSE) THEN RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL='Lompatan lurus tersedia, tidak bisa diagonal'; END IF;
          v_blocked := FALSE;
          IF v_diff_c = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur diagonal diblokir tembok'; END IF;
          v_valid_move := TRUE;
        END IF;

      ELSIF v_opp_r = v_my_r AND v_opp_c = v_my_c + v_diff_c THEN
        IF v_new_r = v_opp_r + v_diff_r AND v_new_c = v_opp_c THEN
          v_blocked := FALSE;
          IF v_diff_c = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur menuju lawan diblokir tembok'; END IF;
          v_jump_blocked := FALSE;
          IF v_opp_c+v_diff_c < 0 OR v_opp_c+v_diff_c > 8 THEN v_jump_blocked := TRUE;
          ELSIF v_diff_c = 1 THEN SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1; END IF;
          IF NOT COALESCE(v_jump_blocked,FALSE) THEN RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL='Lompatan lurus tersedia, tidak bisa diagonal'; END IF;
          v_blocked := FALSE;
          IF v_diff_r = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur diagonal diblokir tembok'; END IF;
          v_valid_move := TRUE;
        END IF;
      END IF;

      IF NOT v_valid_move THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Gerakan diagonal tidak valid';
      END IF;

    ELSE
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Gerakan tidak valid (terlalu jauh atau diagonal tak wajar)';
    END IF;

    v_last_action := jsonb_build_object('player', v_my_role, 'type', 'move', 'payload', jsonb_build_object('r', v_new_r, 'c', v_new_c));

    IF v_my_role = 'host' THEN
      v_new_gs := v_gs || jsonb_build_object('host_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c), 'last_action', v_last_action);
      IF v_new_r = 8 THEN v_winner := 'host'; END IF;
    ELSE
      v_new_gs := v_gs || jsonb_build_object('partner_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c), 'last_action', v_last_action);
      IF v_new_r = 0 THEN v_winner := 'partner'; END IF;
    END IF;

  -- ══ WALL ══════════════════════════════════════════════════════════════════
  ELSIF p_action_type = 'wall' THEN
    v_my_walls := CASE WHEN v_my_role = 'host' THEN (v_walls_left->>'host')::int ELSE (v_walls_left->>'partner')::int END;
    IF v_my_walls <= 0 THEN RAISE EXCEPTION 'NO_WALLS_LEFT' USING DETAIL = 'Kamu sudah tidak punya tembok'; END IF;

    v_new_wall := jsonb_build_object('orientation', p_payload->>'orientation', 'r', (p_payload->>'r')::int, 'c', (p_payload->>'c')::int);

    IF (v_new_wall->>'r')::int < 0 OR (v_new_wall->>'r')::int > 7 OR (v_new_wall->>'c')::int < 0 OR (v_new_wall->>'c')::int > 7 THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Posisi tembok di luar papan';
    END IF;
    IF (v_new_wall->>'orientation') NOT IN ('H', 'V') THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Orientasi tembok tidak valid (H atau V)';
    END IF;

    -- Cek wall overlap
    v_overlap := FALSE;
    FOR v_wall_elem IN SELECT * FROM jsonb_array_elements(v_walls) LOOP
      IF (v_wall_elem->>'orientation') = 'H' AND (v_new_wall->>'orientation') = 'H' THEN
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int AND ABS((v_wall_elem->>'c')::int - (v_new_wall->>'c')::int) <= 1 THEN v_overlap := TRUE; END IF;
      ELSIF (v_wall_elem->>'orientation') = 'V' AND (v_new_wall->>'orientation') = 'V' THEN
        IF (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int AND ABS((v_wall_elem->>'r')::int - (v_new_wall->>'r')::int) <= 1 THEN v_overlap := TRUE; END IF;
      ELSE
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int AND (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int THEN v_overlap := TRUE; END IF;
      END IF;
      IF v_overlap THEN RAISE EXCEPTION 'WALL_OVERLAP' USING DETAIL = 'Posisi tembok sudah terpakai atau bertabrakan'; END IF;
    END LOOP;

    v_walls := v_walls || jsonb_build_array(v_new_wall);

    -- BFS path check
    IF NOT public.quoridor_has_path((v_host_pos->>'r')::int, (v_host_pos->>'c')::int, 8, v_walls)
       OR NOT public.quoridor_has_path((v_part_pos->>'r')::int, (v_part_pos->>'c')::int, 0, v_walls) THEN
      RAISE EXCEPTION 'WALL_BLOCKS_PATH' USING DETAIL = 'Tembok ini memblokir total jalur salah satu pemain';
    END IF;

    IF v_my_role = 'host' THEN
      v_walls_left := v_walls_left || jsonb_build_object('host', v_my_walls - 1);
    ELSE
      v_walls_left := v_walls_left || jsonb_build_object('partner', v_my_walls - 1);
    END IF;

    v_last_action := jsonb_build_object('player', v_my_role, 'type', 'wall', 'payload', v_new_wall);
    v_new_gs := v_gs || jsonb_build_object('walls', v_walls, 'walls_left', v_walls_left, 'last_action', v_last_action);

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION' USING DETAIL = 'action_type harus move atau wall';
  END IF;

  -- Ganti giliran
  IF v_winner IS NOT NULL THEN
    v_new_gs := v_new_gs || jsonb_build_object('winner', v_winner, 'current_turn', v_my_role);
    UPDATE public.game_sessions SET game_state = v_new_gs, status = 'completed', updated_at = now() WHERE id = v_session.id;
  ELSE
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object('current_turn', v_next_turn, 'winner', NULL);
    UPDATE public.game_sessions SET game_state = v_new_gs, updated_at = now() WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.quoridor_has_path(INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quoridor_action(VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
