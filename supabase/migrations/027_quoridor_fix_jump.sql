-- ============================================================
-- LDR-Connect: Migration 027 — Fix Quoridor Jump Detection
-- Jalankan SETELAH 026_quoridor_pathcheck.sql
--
-- Bug: Server gagal mendeteksi lompatan lurus karena membandingkan
--      target dengan posisi lawan (bukan dengan posisi 2 langkah).
--      Akibatnya semua lompatan ditolak dengan "Gerakan tidak valid".
--
-- Fix: Deteksi move berdasarkan delta (diff_r, diff_c):
--   |(diff_r)| = 1, diff_c = 0  → gerak biasa atas/bawah
--   diff_r = 0, |(diff_c)| = 1  → gerak biasa kiri/kanan
--   |(diff_r)| = 2, diff_c = 0  → lompatan lurus atas/bawah
--   diff_r = 0, |(diff_c)| = 2  → lompatan lurus kiri/kanan
--   |(diff_r)| = 1, |(diff_c)| = 1 → lompatan diagonal
--   selain itu                  → INVALID_MOVE
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

  -- Arah langkah tunggal (±1)
  v_step_r     INTEGER;
  v_step_c     INTEGER;

  v_blocked        BOOLEAN := FALSE;
  v_jump_blocked   BOOLEAN := FALSE;
  v_valid_move     BOOLEAN := FALSE;

  v_winner      TEXT := NULL;
  v_target_row  INTEGER;
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
      RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Game sudah selesai';
    END IF;
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak aktif';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_session.id;
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  v_gs := v_session.game_state;

  -- ── Tentukan role ─────────────────────────────────────────────────────────
  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  -- ── Validasi giliran ──────────────────────────────────────────────────────
  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN' USING DETAIL = 'Bukan giliranmu';
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

  -- ══════════════════════════════════════════════════════════════════════════
  -- Handle MOVE
  -- ══════════════════════════════════════════════════════════════════════════
  IF p_action_type = 'move' THEN
    v_new_r := (p_payload->>'r')::int;
    v_new_c := (p_payload->>'c')::int;

    IF v_new_r < 0 OR v_new_r > 8 OR v_new_c < 0 OR v_new_c > 8 THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi di luar papan';
    END IF;

    -- Tidak boleh berdiam di tempat
    IF v_new_r = v_my_r AND v_new_c = v_my_c THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi tujuan sama dengan posisi saat ini';
    END IF;

    v_diff_r := v_new_r - v_my_r;
    v_diff_c := v_new_c - v_my_c;

    -- ──────────────────────────────────────────────────────────────────────
    -- KASUS A: Gerak biasa 1 langkah (tidak ke arah lawan)
    -- ──────────────────────────────────────────────────────────────────────
    IF (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 1) THEN

      -- Tidak boleh berdiri di posisi lawan
      IF v_new_r = v_opp_r AND v_new_c = v_opp_c THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Tidak bisa bergerak ke posisi lawan';
      END IF;

      -- Cek tembok yang menghalangi
      v_blocked := FALSE;
      IF v_diff_r = 1 THEN          -- ke bawah: H-wall di r=my_r
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_r = -1 THEN      -- ke atas: H-wall di r=my_r-1
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r - 1
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_c = 1 THEN       -- ke kanan: V-wall di c=my_c
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      ELSIF v_diff_c = -1 THEN      -- ke kiri: V-wall di c=my_c-1
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c - 1
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      END IF;

      IF COALESCE(v_blocked, FALSE) THEN
        RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur diblokir oleh tembok';
      END IF;

      v_valid_move := TRUE;

    -- ──────────────────────────────────────────────────────────────────────
    -- KASUS B: Lompatan lurus 2 langkah (±2, 0) atau (0, ±2)
    --   Aturan: tidak ada pagar antara dua pion & tidak ada pagar
    --           di belakang pion lawan (kotak belakang kosong).
    -- ──────────────────────────────────────────────────────────────────────
    ELSIF (ABS(v_diff_r) = 2 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 2) THEN

      -- Arah satu langkah
      v_step_r := v_diff_r / 2;  -- -1, 0, atau 1
      v_step_c := v_diff_c / 2;

      -- Lawan harus tepat berada di tengah (1 langkah dari saya)
      IF v_opp_r != v_my_r + v_step_r OR v_opp_c != v_my_c + v_step_c THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Tidak ada lawan di jalur lompatan lurus';
      END IF;

      -- Cek: tidak ada tembok antara saya dan lawan
      v_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r - 1
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c - 1
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      END IF;

      IF COALESCE(v_blocked, FALSE) THEN
        RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur menuju lawan diblokir tembok';
      END IF;

      -- Cek: tidak ada tembok antara lawan dan destinasi lompatan
      v_jump_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_opp_r
          AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
        LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_opp_r - 1
          AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
        LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_opp_c
          AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
        LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_opp_c - 1
          AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
        LIMIT 1;
      END IF;

      IF COALESCE(v_jump_blocked, FALSE) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Lompatan lurus diblokir tembok di belakang lawan — gunakan diagonal';
      END IF;

      v_valid_move := TRUE;

    -- ──────────────────────────────────────────────────────────────────────
    -- KASUS C: Lompatan diagonal (|diff_r|=1, |diff_c|=1)
    --   Aturan: Lompatan lurus diblokir (tembok/tepi papan),
    --           maka diperbolehkan bergerak diagonal dari posisi lawan.
    -- ──────────────────────────────────────────────────────────────────────
    ELSIF ABS(v_diff_r) = 1 AND ABS(v_diff_c) = 1 THEN

      -- Identifikasi skenario: dari arah mana lawan berada?
      --
      -- Skenario 1: Lawan di (my_r + diff_r, my_c) — lawan searah vertikal
      --   Destinasi diagonal: (opp_r, opp_c ± diff_c)
      --   Syarat: tembok/tepi antara saya dan lawan (vertikal) TIDAK ADA,
      --           tapi BELAKANG lawan (vertikal) TERBLOKIR.
      --
      -- Skenario 2: Lawan di (my_r, my_c + diff_c) — lawan searah horizontal
      --   Destinasi diagonal: (opp_r ± diff_r, opp_c)
      --   Syarat: tembok/tepi antara saya dan lawan (horizontal) TIDAK ADA,
      --           tapi BELAKANG lawan (horizontal) TERBLOKIR.

      v_valid_move := FALSE;

      -- ── Skenario 1: Lawan di arah vertikal ────────────────────────────
      IF v_opp_r = v_my_r + v_diff_r AND v_opp_c = v_my_c THEN

        -- Tujuan diagonal harus: (opp_r, opp_c + diff_c)
        IF v_new_r = v_opp_r AND v_new_c = v_opp_c + v_diff_c THEN

          -- Cek: tidak ada tembok antara saya dan lawan (arah vertikal)
          v_blocked := FALSE;
          IF v_diff_r = 1 THEN
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_my_r
              AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
            LIMIT 1;
          ELSE -- v_diff_r = -1
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_my_r - 1
              AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
            LIMIT 1;
          END IF;

          IF COALESCE(v_blocked, FALSE) THEN
            RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur menuju lawan diblokir tembok';
          END IF;

          -- Cek: lompatan lurus harus diblokir (tembok di belakang lawan atau tepi papan)
          v_jump_blocked := FALSE;
          IF v_opp_r + v_diff_r < 0 OR v_opp_r + v_diff_r > 8 THEN
            v_jump_blocked := TRUE;
          ELSE
            IF v_diff_r = 1 THEN
              SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
              WHERE (w->>'orientation') = 'H'
                AND (w->>'r')::int = v_opp_r
                AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
              LIMIT 1;
            ELSE
              SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
              WHERE (w->>'orientation') = 'H'
                AND (w->>'r')::int = v_opp_r - 1
                AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
              LIMIT 1;
            END IF;
          END IF;

          IF NOT COALESCE(v_jump_blocked, FALSE) THEN
            RAISE EXCEPTION 'INVALID_MOVE'
              USING DETAIL = 'Lompatan lurus tersedia, tidak bisa diagonal';
          END IF;

          -- Cek: tidak ada tembok antara lawan dan tujuan diagonal (arah horizontal)
          IF v_diff_c = 1 THEN
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
          ELSE -- v_diff_c = -1
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c - 1
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
          END IF;

          IF COALESCE(v_blocked, FALSE) THEN
            RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur diagonal diblokir tembok';
          END IF;

          v_valid_move := TRUE;
        END IF;

      -- ── Skenario 2: Lawan di arah horizontal ──────────────────────────
      ELSIF v_opp_r = v_my_r AND v_opp_c = v_my_c + v_diff_c THEN

        -- Tujuan diagonal harus: (opp_r + diff_r, opp_c)
        IF v_new_r = v_opp_r + v_diff_r AND v_new_c = v_opp_c THEN

          -- Cek: tidak ada tembok antara saya dan lawan (arah horizontal)
          v_blocked := FALSE;
          IF v_diff_c = 1 THEN
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_my_c
              AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
            LIMIT 1;
          ELSE -- v_diff_c = -1
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_my_c - 1
              AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
            LIMIT 1;
          END IF;

          IF COALESCE(v_blocked, FALSE) THEN
            RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur menuju lawan diblokir tembok';
          END IF;

          -- Cek: lompatan lurus harus diblokir
          v_jump_blocked := FALSE;
          IF v_opp_c + v_diff_c < 0 OR v_opp_c + v_diff_c > 8 THEN
            v_jump_blocked := TRUE;
          ELSE
            IF v_diff_c = 1 THEN
              SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
              WHERE (w->>'orientation') = 'V'
                AND (w->>'c')::int = v_opp_c
                AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
              LIMIT 1;
            ELSE
              SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w
              WHERE (w->>'orientation') = 'V'
                AND (w->>'c')::int = v_opp_c - 1
                AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
              LIMIT 1;
            END IF;
          END IF;

          IF NOT COALESCE(v_jump_blocked, FALSE) THEN
            RAISE EXCEPTION 'INVALID_MOVE'
              USING DETAIL = 'Lompatan lurus tersedia, tidak bisa diagonal';
          END IF;

          -- Cek: tidak ada tembok antara lawan dan tujuan diagonal (arah vertikal)
          IF v_diff_r = 1 THEN
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
          ELSE
            SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r - 1
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
          END IF;

          IF COALESCE(v_blocked, FALSE) THEN
            RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur diagonal diblokir tembok';
          END IF;

          v_valid_move := TRUE;
        END IF;

      END IF;

      IF NOT v_valid_move THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Gerakan diagonal tidak valid';
      END IF;

    -- ──────────────────────────────────────────────────────────────────────
    ELSE
      RAISE EXCEPTION 'INVALID_MOVE'
        USING DETAIL = 'Gerakan tidak valid (terlalu jauh atau diagonal tak wajar)';
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

  -- ══════════════════════════════════════════════════════════════════════════
  -- Handle WALL
  -- ══════════════════════════════════════════════════════════════════════════
  ELSIF p_action_type = 'wall' THEN
    v_my_walls := CASE
      WHEN v_my_role = 'host' THEN (v_walls_left->>'host')::int
      ELSE                         (v_walls_left->>'partner')::int
    END;

    IF v_my_walls <= 0 THEN
      RAISE EXCEPTION 'NO_WALLS_LEFT' USING DETAIL = 'Kamu sudah tidak punya tembok';
    END IF;

    v_new_wall := jsonb_build_object(
      'orientation', p_payload->>'orientation',
      'r',           (p_payload->>'r')::int,
      'c',           (p_payload->>'c')::int
    );

    IF (v_new_wall->>'r')::int < 0 OR (v_new_wall->>'r')::int > 7
       OR (v_new_wall->>'c')::int < 0 OR (v_new_wall->>'c')::int > 7
    THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Posisi tembok di luar papan';
    END IF;

    IF (v_new_wall->>'orientation') NOT IN ('H', 'V') THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Orientasi tembok tidak valid (H atau V)';
    END IF;

    -- ── Cek wall overlap ────────────────────────────────────────────────
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
        RAISE EXCEPTION 'WALL_OVERLAP' USING DETAIL = 'Posisi tembok sudah terpakai atau bertabrakan';
      END IF;
    END LOOP;

    -- Tambahkan tembok sementara untuk BFS check
    v_walls := v_walls || jsonb_build_array(v_new_wall);

    -- ── BFS: tembok tidak boleh memblokir total jalur pemain ────────────
    IF NOT public.quoridor_has_path(
      (v_host_pos->>'r')::int, (v_host_pos->>'c')::int, 8, v_walls
    ) OR NOT public.quoridor_has_path(
      (v_part_pos->>'r')::int, (v_part_pos->>'c')::int, 0, v_walls
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
    RAISE EXCEPTION 'INVALID_ACTION' USING DETAIL = 'action_type harus move atau wall';
  END IF;

  -- ── Ganti giliran ─────────────────────────────────────────────────────────
  IF v_winner IS NOT NULL THEN
    v_new_gs := v_new_gs || jsonb_build_object('winner', v_winner, 'current_turn', v_my_role);
    UPDATE public.game_sessions
    SET game_state = v_new_gs, status = 'completed', updated_at = now()
    WHERE id = v_session.id;
  ELSE
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object('current_turn', v_next_turn, 'winner', NULL);
    UPDATE public.game_sessions
    SET game_state = v_new_gs, updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;
