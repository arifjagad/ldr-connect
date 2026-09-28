-- ============================================================
-- LDR-Connect Schema — 03 Rate limiting
-- Jalankan SETELAH 02_coin_payment.sql
--
-- rate_limit_events + limiter per endpoint dan limiter login 2-tier.
-- ============================================================

-- ============================================================
-- TABLE: rate_limit_events (dari migration 010)
-- ============================================================
CREATE TABLE public.rate_limit_events (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, endpoint, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: check_and_record_rate_limit
-- Rate limiting per-user per-endpoint berbasis DB (migration 010)
-- Bekerja di serverless/multi-instance environment
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
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_endpoint)
  );

  -- Hapus event lama milik user ini (> 24 jam)
  DELETE FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung event dalam window
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (p_user_id, p_endpoint);

  RETURN TRUE;
END;
$$;

-- Two-tier brute-force protection berbasis email.
-- Tier 1: 5 gagal dalam 1 menit  → return 'tier1' (blok 1 menit)
-- Tier 2: 10 gagal dalam 1 jam   → return 'tier2' (blok 1 jam)
-- Else: catat attempt dan return 'ok'
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT
)
RETURNS TEXT  -- 'ok' | 'tier1' | 'tier2'
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
  v_endpoint        TEXT := 'auth:login';
  v_count_minute    INT;
  v_count_hour      INT;
BEGIN
  -- Buat UUID deterministik dari email (UUID v5, namespace OID)
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,
    lower(trim(p_email))
  );

  -- Advisory lock per email untuk cegah race condition
  PERFORM pg_advisory_xact_lock(hashtext(p_email));

  -- Hapus events lama (> 24 jam)
  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung kegagalan dalam 1 menit (Tier 1)
  SELECT COUNT(*) INTO v_count_minute
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_count_minute >= 5 THEN
    RETURN 'tier1';  -- blok 1 menit
  END IF;

  -- Hitung kegagalan dalam 1 jam (Tier 2)
  SELECT COUNT(*) INTO v_count_hour
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 10 THEN
    RETURN 'tier2';  -- blok 1 jam
  END IF;

  -- Catat attempt baru
  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (v_pseudo_user_id, v_endpoint);

  RETURN 'ok';
END;
$$;

-- ============================================================
-- FUNCTION: clear_login_rate_limit (migration 028)
-- Reset rate limit counter setelah login berhasil.
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
BEGIN
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,
    lower(trim(p_email))
  );

  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = 'auth:login';
END;
$$;

-- ============================================================
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
