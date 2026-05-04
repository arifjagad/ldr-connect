-- ============================================================
-- LDR-Connect: Migration 010 — Rate Limiting
-- Jalankan SETELAH 009_drop_deprecated_snake_functions.sql
--
-- Tujuan:
--   Menyediakan infrastruktur rate limiting per-user berbasis DB
--   agar bekerja di environment serverless (Vercel, dll.).
-- ============================================================

-- Tabel untuk mencatat event rate-limit per user per endpoint
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, endpoint, created_at DESC);

-- RLS: Tidak ada akses langsung. Hanya bisa diakses via SECURITY DEFINER function.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: check_and_record_rate_limit
--
-- Mengecek apakah user boleh melakukan request ke endpoint tertentu.
-- Jika boleh, langsung mencatat event (atomic via advisory lock).
--
-- Returns:
--   TRUE  = request diizinkan
--   FALSE = rate limit terlampaui
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
  p_user_id        UUID,
  p_endpoint       TEXT,
  p_max_requests   INT,
  p_window_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Advisory lock per user+endpoint untuk mencegah race condition
  -- (serialisasi request yang masuk bersamaan dari user yang sama)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_endpoint)
  );

  -- Hapus event lama (> 24 jam) milik user ini agar tabel tidak membengkak
  DELETE FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung event dalam window waktu
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Tolak jika sudah melampaui batas
  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  -- Catat event baru
  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (p_user_id, p_endpoint);

  RETURN TRUE;
END;
$$;
