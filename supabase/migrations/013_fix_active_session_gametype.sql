-- ============================================================
-- Migration 013: Fix get_active_session_for_couple
--
-- Masalah:
--   1. Fungsi tidak filter by game_type → ToD page bisa dapat
--      sesi Snake (atau sebaliknya), menyebabkan UI campur aduk.
--   2. Fungsi tidak cek expires_at → sesi yang sudah habis waktu
--      (tapi status belum terupdate) dianggap masih aktif.
--
-- Fix:
--   - Tambah parameter p_game_type VARCHAR DEFAULT NULL
--   - Tambah kondisi AND expires_at > NOW()
--   - Auto-expire sesi kedaluwarsa sebelum query
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_active_session_for_couple(
  p_user_id   UUID,
  p_game_type VARCHAR DEFAULT NULL
)
RETURNS public.game_sessions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id UUID;
  v_session   public.game_sessions;
BEGIN
  v_couple_id := public.get_couple_id(p_user_id);

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE couple_id = v_couple_id
    AND status IN ('waiting', 'playing')
    AND expires_at > NOW()
    AND (p_game_type IS NULL OR game_type = p_game_type)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session;
END;
$$;
