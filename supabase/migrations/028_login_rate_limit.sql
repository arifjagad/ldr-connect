-- Migration 028: Login rate limiting (two-tier brute-force protection)
-- Tambah functions check_login_rate_limit + clear_login_rate_limit
-- Menggunakan tabel rate_limit_events yang sudah ada (migration 010)

-- ============================================================
-- FUNCTION: check_login_rate_limit
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
-- FUNCTION: clear_login_rate_limit
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
