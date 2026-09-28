-- ============================================================
-- LDR-Connect: Migration 042 — Unlink Bereskan Sesi Game + Signup Atomik
-- Jalankan SETELAH 041_photobooth_storage_captures.sql
-- ============================================================
-- 1. unlink_couple tidak menyentuh game_sessions milik couple lama
--    (SECURITY_CHECKLIST outstanding #1). Sesi 'waiting' yang coin-nya
--    sudah dipotong jadi orphan: couple_id-nya tidak lagi cocok dengan
--    get_couple_id() siapa pun, jadi tidak muncul di halaman game dan tidak
--    bisa dibatalkan host — coin baru kembali saat cron harian. Sesi
--    'playing' tetap tercatat aktif untuk dua user yang sudah tidak
--    terhubung.
--    Fix: di dalam transaksi unlink yang sama —
--      · 'waiting' → refund host via refund_expired_session() (status jadi
--        'expired', coin kembali)
--      · 'playing' → 'cancelled' tanpa refund (game sudah berjalan,
--        konsisten dengan kebijakan cron expire-sessions)
--
-- 2. handle_new_auth_user menelan semua exception (EXCEPTION WHEN OTHERS
--    ... RETURN NEW) — kalau insert users/wallets gagal, auth.users tetap
--    terbuat tanpa profile (outstanding #4). User bisa login tapi semua
--    halaman rusak, tanpa jalan pulih sendiri.
--    Fix: hapus blok EXCEPTION. Kegagalan membatalkan seluruh signup
--    (auth.users ikut di-rollback) sehingga user melihat error dan bisa
--    mencoba lagi. Per migration ini tidak ada akun orphan di production.
-- ============================================================

CREATE OR REPLACE FUNCTION public.unlink_couple(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
  v_first_id   UUID;
  v_second_id  UUID;
  v_session    RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED'
      USING DETAIL = 'Kamu hanya bisa memutuskan hubungan akunmu sendiri';
  END IF;

  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NOT_LINKED'
      USING DETAIL = 'Kamu tidak sedang terhubung dengan siapapun';
  END IF;

  v_first_id  := LEAST(p_user_id, v_partner_id);
  v_second_id := GREATEST(p_user_id, v_partner_id);

  PERFORM 1 FROM public.users WHERE id = v_first_id  FOR UPDATE;
  PERFORM 1 FROM public.users WHERE id = v_second_id FOR UPDATE;

  FOR v_session IN
    SELECT id, status FROM public.game_sessions
    WHERE couple_id = v_first_id
      AND status IN ('waiting', 'playing')
    FOR UPDATE
  LOOP
    IF v_session.status = 'waiting' THEN
      PERFORM public.refund_expired_session(v_session.id);
    ELSE
      UPDATE public.game_sessions
      SET status = 'cancelled', updated_at = now()
      WHERE id = v_session.id;
    END IF;
  END LOOP;

  UPDATE public.users
  SET partner_id = NULL, status = 'single', updated_at = now()
  WHERE id IN (p_user_id, v_partner_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, couple_code, status, is_admin)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    public.generate_couple_code(),
    'single',
    false
  );

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
