-- ============================================================
-- LDR-Connect: Migration 026 — Quoridor BFS Path Check
-- Jalankan SETELAH 025_quoridor_fix.sql
--
-- Fix:
--   Aturan: Tembok tidak boleh memblokir TOTAL jalur salah satu
--   pemain ke tujuannya. Harus selalu ada setidaknya 1 jalur.
--
--   Migration 025 sudah handle jump logic & wall overlap, tapi
--   belum ada BFS validation di server untuk wall placement.
--   Migration ini menambahkan:
--     1. quoridor_has_path: fungsi BFS iteratif (9×9 board)
--     2. quoridor_action: rekonstruksi dengan BFS check setelah pasang tembok
-- ============================================================

-- ============================================================
-- 1. FUNCTION: quoridor_has_path
--    BFS dari (p_start_r, p_start_c) menuju baris p_target_row.
--    Menghormati walls yang ada di p_walls (JSONB array).
--    Return TRUE jika jalur ada, FALSE jika diblokir total.
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
  -- Visited: [row+1][col+1], 1-indexed karena PostgreSQL array default 1-based
  v_visited  BOOLEAN[9][9];
  -- Queue: node = r*9+c (flatten 2D ke 1D)
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

    -- ── Atas (v_r - 1): diblokir H-wall di r=v_r-1 ──
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

    -- ── Bawah (v_r + 1): diblokir H-wall di r=v_r ──
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

    -- ── Kiri (v_c - 1): diblokir V-wall di c=v_c-1 ──
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

    -- ── Kanan (v_c + 1): diblokir V-wall di c=v_c ──
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
-- 2. FUNCTION: quoridor_action (rekonstruksi dengan BFS check)
--    Identik dengan migration 025 + penambahan BFS setelah
--    tembok ditambahkan ke v_walls.
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

  v_blocked      BOOLEAN := FALSE;
  v_jump_r       INTEGER;
  v_jump_c       INTEGER;
  v_jump_blocked BOOLEAN := FALSE;
  v_valid_move   BOOLEAN := FALSE;

  v_winner     TEXT := NULL;
  v_target_row INTEGER;
  v_last_action JSONB;
BEGIN
  -- ── Ambil + lock sesi ─────────────────────────────────────────────────────
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.status != 'playing' THEN
    IF v_session.status = 'completed' THEN
      RAISE EXCEPTION 'SESSION_EXPIRED'
        USING DETAIL = 'Game sudah selesai';
    END IF;
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak aktif';
  END IF;

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

    IF v_new_r < 0 OR v_new_r > 8 OR v_new_c < 0 OR v_new_c > 8 THEN
      RAISE EXCEPTION 'INVALID_MOVE'
        USING DETAIL = 'Posisi di luar papan';
    END IF;

    v_diff_r := v_new_r - v_my_r;
    v_diff_c := v_new_c - v_my_c;

    -- ─── Kasus A: gerak biasa (bukan ke posisi lawan) ────────────────────────
    IF NOT (v_new_r = v_opp_r AND v_new_c = v_opp_c) THEN

      -- 1 langkah lurus saja
      IF NOT (
        (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR
        (ABS(v_diff_c) = 1 AND v_diff_r = 0)
      ) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Hanya bisa bergerak 1 langkah lurus';
      END IF;

      -- Cek tembok yang menghalangi
      v_blocked := FALSE;
      IF v_diff_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r - 1
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      ELSIF v_diff_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c - 1
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      END IF;

      IF v_blocked IS TRUE THEN
        RAISE EXCEPTION 'BLOCKED_BY_WALL'
          USING DETAIL = 'Jalur diblokir oleh tembok';
      END IF;

      v_valid_move := TRUE;

    -- ─── Kasus B: target = posisi lawan — aturan jump Quoridor ───────────────
    ELSE
      -- Harus berdekatan 1 langkah
      IF NOT (
        (ABS(v_opp_r - v_my_r) = 1 AND v_opp_c = v_my_c) OR
        (ABS(v_opp_c - v_my_c) = 1 AND v_opp_r = v_my_r)
      ) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Tidak bisa melompat ke posisi lawan yang jauh';
      END IF;

      v_diff_r := v_opp_r - v_my_r;
      v_diff_c := v_opp_c - v_my_c;

      -- Cek apakah jalur dari saya ke lawan diblokir tembok
      -- (Aturan: Ada pagar di antara dua pion → Tidak bisa lompat sama sekali)
      v_blocked := FALSE;
      IF v_diff_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r - 1
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      ELSIF v_diff_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c - 1
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      END IF;

      IF v_blocked IS TRUE THEN
        RAISE EXCEPTION 'BLOCKED_BY_WALL'
          USING DETAIL = 'Jalur menuju lawan diblokir tembok';
      END IF;

      -- Target lompatan lurus (di belakang lawan)
      v_jump_r := v_opp_r + v_diff_r;
      v_jump_c := v_opp_c + v_diff_c;

      -- Apakah lompatan lurus tersedia?
      -- (Aturan: Tidak ada pagar di belakang lawan + masih di dalam papan → lompat lurus)
      v_jump_blocked := FALSE;
      IF v_jump_r < 0 OR v_jump_r > 8 OR v_jump_c < 0 OR v_jump_c > 8 THEN
        v_jump_blocked := TRUE;
      ELSE
        IF v_diff_r = 1 THEN
          SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
          WHERE (w->>'orientation') = 'H'
            AND (w->>'r')::int = v_opp_r
            AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
          LIMIT 1;
        ELSIF v_diff_r = -1 THEN
          SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
          WHERE (w->>'orientation') = 'H'
            AND (w->>'r')::int = v_opp_r - 1
            AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
          LIMIT 1;
        ELSIF v_diff_c = 1 THEN
          SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
          WHERE (w->>'orientation') = 'V'
            AND (w->>'c')::int = v_opp_c
            AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
          LIMIT 1;
        ELSIF v_diff_c = -1 THEN
          SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
          WHERE (w->>'orientation') = 'V'
            AND (w->>'c')::int = v_opp_c - 1
            AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
          LIMIT 1;
        END IF;
      END IF;

      IF NOT v_jump_blocked THEN
        -- ── Lompatan lurus tersedia → wajib lompat lurus ────────────────────
        IF v_new_r != v_jump_r OR v_new_c != v_jump_c THEN
          RAISE EXCEPTION 'INVALID_MOVE'
            USING DETAIL = 'Lompatan lurus tidak menuju posisi yang valid';
        END IF;
        v_valid_move := TRUE;

      ELSE
        -- ── Lompatan lurus diblokir → hanya boleh ke diagonal (dari posisi lawan) ─
        -- (Aturan: Ada pagar di belakang lawan → Lompat diagonal ke kiri/kanan)
        DECLARE
          v_diag1_r INTEGER;
          v_diag1_c INTEGER;
          v_diag2_r INTEGER;
          v_diag2_c INTEGER;
          v_d1_blocked BOOLEAN := FALSE;
          v_d2_blocked BOOLEAN := FALSE;
        BEGIN
          IF v_diff_r != 0 THEN
            -- Gerak vertikal → diagonal kiri/kanan dari posisi lawan
            v_diag1_r := v_opp_r; v_diag1_c := v_opp_c - 1;
            v_diag2_r := v_opp_r; v_diag2_c := v_opp_c + 1;
            -- Kiri diblokir V-wall di c=opp_c-1
            SELECT TRUE INTO v_d1_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c - 1
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
            -- Kanan diblokir V-wall di c=opp_c
            SELECT TRUE INTO v_d2_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
          ELSE
            -- Gerak horizontal → diagonal atas/bawah dari posisi lawan
            v_diag1_r := v_opp_r - 1; v_diag1_c := v_opp_c;
            v_diag2_r := v_opp_r + 1; v_diag2_c := v_opp_c;
            -- Atas diblokir H-wall di r=opp_r-1
            SELECT TRUE INTO v_d1_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r - 1
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
            -- Bawah diblokir H-wall di r=opp_r
            SELECT TRUE INTO v_d2_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
          END IF;

          v_valid_move := FALSE;
          IF (v_new_r = v_diag1_r AND v_new_c = v_diag1_c)
              AND v_diag1_r >= 0 AND v_diag1_r <= 8
              AND v_diag1_c >= 0 AND v_diag1_c <= 8
              AND NOT COALESCE(v_d1_blocked, FALSE) THEN
            v_valid_move := TRUE;
          ELSIF (v_new_r = v_diag2_r AND v_new_c = v_diag2_c)
              AND v_diag2_r >= 0 AND v_diag2_r <= 8
              AND v_diag2_c >= 0 AND v_diag2_c <= 8
              AND NOT COALESCE(v_d2_blocked, FALSE) THEN
            v_valid_move := TRUE;
          END IF;

          IF NOT v_valid_move THEN
            RAISE EXCEPTION 'INVALID_MOVE'
              USING DETAIL = 'Gerakan diagonal tidak valid';
          END IF;
        END;
      END IF;
    END IF;

    IF NOT v_valid_move THEN
      RAISE EXCEPTION 'INVALID_MOVE'
        USING DETAIL = 'Gerakan tidak valid';
    END IF;

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
      v_target_row := 8;
      IF v_new_r = v_target_row THEN v_winner := 'host'; END IF;
    ELSE
      v_new_gs := v_gs || jsonb_build_object(
        'partner_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c),
        'last_action', v_last_action
      );
      v_target_row := 0;
      IF v_new_r = v_target_row THEN v_winner := 'partner'; END IF;
    END IF;

  -- ── Handle WALL ──────────────────────────────────────────────────────────
  ELSIF p_action_type = 'wall' THEN
    v_my_walls := CASE
      WHEN v_my_role = 'host' THEN (v_walls_left->>'host')::int
      ELSE                         (v_walls_left->>'partner')::int
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

    -- Validasi koordinat wall (0–7)
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

    -- ── Cek wall overlap (H-H, V-V, H-V cross) ────────────────────────────
    v_overlap := FALSE;
    FOR v_wall_elem IN SELECT * FROM jsonb_array_elements(v_walls)
    LOOP
      IF (v_wall_elem->>'orientation') = 'H' AND (v_new_wall->>'orientation') = 'H' THEN
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int
           AND ABS((v_wall_elem->>'c')::int - (v_new_wall->>'c')::int) <= 1 THEN
          v_overlap := TRUE;
        END IF;
      ELSIF (v_wall_elem->>'orientation') = 'V' AND (v_new_wall->>'orientation') = 'V' THEN
        IF (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int
           AND ABS((v_wall_elem->>'r')::int - (v_new_wall->>'r')::int) <= 1 THEN
          v_overlap := TRUE;
        END IF;
      ELSE
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int
           AND (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int THEN
          v_overlap := TRUE;
        END IF;
      END IF;

      IF v_overlap THEN
        RAISE EXCEPTION 'WALL_OVERLAP'
          USING DETAIL = 'Posisi tembok sudah terpakai atau bertabrakan';
      END IF;
    END LOOP;

    -- Tambahkan tembok ke array sementara
    v_walls := v_walls || jsonb_build_array(v_new_wall);

    -- ── BFS: validasi jalur — tembok tidak boleh memblokir total ────────────
    -- Host harus masih bisa mencapai baris 8 (bawah)
    -- Partner harus masih bisa mencapai baris 0 (atas)
    IF NOT public.quoridor_has_path(
      (v_host_pos->>'r')::int,
      (v_host_pos->>'c')::int,
      8,
      v_walls
    ) OR NOT public.quoridor_has_path(
      (v_part_pos->>'r')::int,
      (v_part_pos->>'c')::int,
      0,
      v_walls
    ) THEN
      RAISE EXCEPTION 'WALL_BLOCKS_PATH'
        USING DETAIL = 'Tembok ini memblokir total jalur salah satu pemain';
    END IF;

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

  -- ── Ganti giliran ─────────────────────────────────────────────────────────
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
