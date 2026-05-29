-- ============================================================
-- LDR-Connect: Migration 025 — Quoridor Bug Fixes
-- Jalankan SETELAH 024_quoridor.sql
--
-- Fix:
--   1. Wall partial overlap (H-adjacency, V-adjacency) tidak dicek sebelumnya
--   2. Jump-over lawan (straight + diagonal fallback) tidak diimplementasikan
--      di server — sebelumnya server menolak semua gerakan ke posisi lawan
-- ============================================================

-- ============================================================
-- Helper: cek apakah ada tembok yang memblokir suatu arah
-- Ini adalah versi SQL dari helpers.ts client-side
-- ============================================================

-- isBlockedDown: H-wall di r=r, c=c atau c=c-1
-- isBlockedUp:   H-wall di r=r-1, c=c atau c=c-1
-- isBlockedRight: V-wall di c=c, r=r atau r=r-1
-- isBlockedLeft:  V-wall di c=c-1, r=r atau r=r-1

-- ============================================================
-- FUNCTION: quoridor_action (versi fix)
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
  v_overlap    BOOLEAN := FALSE;

  -- Move data
  v_new_r      INTEGER;
  v_new_c      INTEGER;
  v_my_r       INTEGER;
  v_my_c       INTEGER;
  v_opp_r      INTEGER;
  v_opp_c      INTEGER;
  v_diff_r     INTEGER;
  v_diff_c     INTEGER;
  v_blocked    BOOLEAN;

  -- Jump-over data
  v_jump_r     INTEGER;  -- target lompatan lurus
  v_jump_c     INTEGER;
  v_jump_blocked BOOLEAN;
  v_valid_move   BOOLEAN := FALSE;

  -- Win condition
  v_winner     TEXT;
  v_target_row INTEGER;

  -- Last action
  v_last_action JSONB;

  -- ── Inline wall-block check helpers ──────────────────────────────────────
  -- Memeriksa apakah ada tembok yang memblokir arah tertentu.
  -- Karena PL/pgSQL tidak bisa membuat fungsi lokal, kita pakai EXISTS subquery.
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

    -- ────────────────────────────────────────────────────────────────────────
    -- KASUS A: Target bukan posisi lawan — gerak biasa 1 langkah
    -- ────────────────────────────────────────────────────────────────────────
    IF NOT (v_new_r = v_opp_r AND v_new_c = v_opp_c) THEN

      -- Harus tepat 1 langkah lurus (bukan diagonal)
      IF NOT (
        (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR
        (ABS(v_diff_c) = 1 AND v_diff_r = 0)
      ) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Hanya bisa bergerak 1 langkah lurus';
      END IF;

      -- Cek apakah ada tembok yang menghalangi
      v_blocked := FALSE;

      IF v_diff_r = 1 THEN       -- bergerak ke bawah: H-wall di r=my_r
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_r = -1 THEN   -- bergerak ke atas: H-wall di r=my_r-1
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_my_r - 1
          AND ((w->>'c')::int = v_my_c OR (w->>'c')::int = v_my_c - 1)
        LIMIT 1;
      ELSIF v_diff_c = 1 THEN    -- bergerak ke kanan: V-wall di c=my_c
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_my_c
          AND ((w->>'r')::int = v_my_r OR (w->>'r')::int = v_my_r - 1)
        LIMIT 1;
      ELSIF v_diff_c = -1 THEN   -- bergerak ke kiri: V-wall di c=my_c-1
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

    -- ────────────────────────────────────────────────────────────────────────
    -- KASUS B: Target = posisi lawan — aturan jump Quoridor
    -- ────────────────────────────────────────────────────────────────────────
    ELSE
      -- Harus berdekatan 1 langkah dengan lawan dulu
      IF NOT (
        (ABS(v_opp_r - v_my_r) = 1 AND v_opp_c = v_my_c) OR
        (ABS(v_opp_c - v_my_c) = 1 AND v_opp_r = v_my_r)
      ) THEN
        RAISE EXCEPTION 'INVALID_MOVE'
          USING DETAIL = 'Tidak bisa melompat ke posisi lawan yang jauh';
      END IF;

      -- Tentukan arah menuju lawan
      v_diff_r := v_opp_r - v_my_r;
      v_diff_c := v_opp_c - v_my_c;

      -- Cek apakah jalur dari saya ke lawan diblokir tembok
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

      -- Cek apakah lompatan lurus tidak keluar board dan tidak diblokir tembok
      v_jump_blocked := FALSE;
      IF v_jump_r < 0 OR v_jump_r > 8 OR v_jump_c < 0 OR v_jump_c > 8 THEN
        v_jump_blocked := TRUE;
      ELSE
        -- Cek tembok antara lawan dan titik lompatan lurus
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
        -- ── Lompatan lurus berhasil: target = v_jump_r, v_jump_c ──────────
        IF v_new_r != v_jump_r OR v_new_c != v_jump_c THEN
          RAISE EXCEPTION 'INVALID_MOVE'
            USING DETAIL = 'Lompatan lurus tidak menuju posisi yang valid';
        END IF;
        v_valid_move := TRUE;
      ELSE
        -- ── Lompatan lurus diblokir: hanya boleh ke diagonal ─────────────
        -- Dua diagonal yang valid tergantung arah lompatan
        DECLARE
          v_diag1_r INTEGER;
          v_diag1_c INTEGER;
          v_diag2_r INTEGER;
          v_diag2_c INTEGER;
          v_d1_blocked BOOLEAN := FALSE;
          v_d2_blocked BOOLEAN := FALSE;
        BEGIN
          IF v_diff_r != 0 THEN
            -- Gerak vertikal → diagonal ke kiri/kanan dari lawan
            v_diag1_r := v_opp_r; v_diag1_c := v_opp_c - 1;
            v_diag2_r := v_opp_r; v_diag2_c := v_opp_c + 1;
            -- Cek tembok diagonal kiri (V-wall di c=opp_c-1)
            SELECT TRUE INTO v_d1_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c - 1
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
            -- Cek tembok diagonal kanan (V-wall di c=opp_c)
            SELECT TRUE INTO v_d2_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'V'
              AND (w->>'c')::int = v_opp_c
              AND ((w->>'r')::int = v_opp_r OR (w->>'r')::int = v_opp_r - 1)
            LIMIT 1;
          ELSE
            -- Gerak horizontal → diagonal ke atas/bawah dari lawan
            v_diag1_r := v_opp_r - 1; v_diag1_c := v_opp_c;
            v_diag2_r := v_opp_r + 1; v_diag2_c := v_opp_c;
            -- Cek tembok diagonal atas (H-wall di r=opp_r-1)
            SELECT TRUE INTO v_d1_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r - 1
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
            -- Cek tembok diagonal bawah (H-wall di r=opp_r)
            SELECT TRUE INTO v_d2_blocked FROM jsonb_array_elements(v_walls) w
            WHERE (w->>'orientation') = 'H'
              AND (w->>'r')::int = v_opp_r
              AND ((w->>'c')::int = v_opp_c OR (w->>'c')::int = v_opp_c - 1)
            LIMIT 1;
          END IF;

          -- Validasi: target harus salah satu diagonal yang tidak diblokir dan di dalam board
          v_valid_move := FALSE;
          IF (v_new_r = v_diag1_r AND v_new_c = v_diag1_c)
              AND v_diag1_r >= 0 AND v_diag1_r <= 8 AND v_diag1_c >= 0 AND v_diag1_c <= 8
              AND NOT v_d1_blocked THEN
            v_valid_move := TRUE;
          ELSIF (v_new_r = v_diag2_r AND v_new_c = v_diag2_c)
              AND v_diag2_r >= 0 AND v_diag2_r <= 8 AND v_diag2_c >= 0 AND v_diag2_c <= 8
              AND NOT v_d2_blocked THEN
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

    -- ── Cek wall overlap — FIX: juga cek partial adjacency ────────────────
    -- Tembok berukuran 2 sel:
    --   H(r,c) mengisi celah baris r↔r+1 di kolom c dan c+1
    --   V(r,c) mengisi celah kolom c↔c+1 di baris r dan r+1
    --
    -- Dua wall sama orientasi conflict jika beda kolom/baris ≤ 1 (share 1 segmen)
    -- H vs V conflict jika mereka bersilang di titik tengah yang sama (r,c sama)
    v_overlap := FALSE;

    FOR v_wall_elem IN SELECT * FROM jsonb_array_elements(v_walls)
    LOOP
      IF (v_wall_elem->>'orientation') = 'H' AND (v_new_wall->>'orientation') = 'H' THEN
        -- H-H conflict: same row + |c diff| <= 1
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int
           AND ABS((v_wall_elem->>'c')::int - (v_new_wall->>'c')::int) <= 1 THEN
          v_overlap := TRUE;
        END IF;
      ELSIF (v_wall_elem->>'orientation') = 'V' AND (v_new_wall->>'orientation') = 'V' THEN
        -- V-V conflict: same col + |r diff| <= 1
        IF (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int
           AND ABS((v_wall_elem->>'r')::int - (v_new_wall->>'r')::int) <= 1 THEN
          v_overlap := TRUE;
        END IF;
      ELSE
        -- H-V cross conflict: same (r,c)
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
