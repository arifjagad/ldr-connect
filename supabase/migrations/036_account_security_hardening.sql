-- ============================================================
-- LDR-Connect: Migration 036 — Account & Security Hardening
-- ============================================================
-- Isi:
--   1. Trigger `protect_sensitive_user_columns` — mencegah client
--      (role `authenticated`/`anon`) mengubah kolom sensitif di tabel
--      `users` secara langsung (is_admin, couple_code, partner_id,
--      status, email, id). RLS policy `users_update_own` hanya
--      membatasi BARIS (harus milik sendiri), TIDAK membatasi KOLOM —
--      sehingga user bisa memanggil
--        supabase.from("users").update({ is_admin: true }).eq("id", myId)
--      langsung dari browser dan self-promote jadi admin. Trigger ini
--      menutup celah tersebut tanpa mengganggu RPC internal
--      (SECURITY DEFINER) atau service role, karena `current_user` di
--      dalam fungsi SECURITY DEFINER otomatis berubah jadi role owner
--      fungsi (bukan `authenticated`) selama eksekusi fungsi tersebut.
--
--   2. Fix IDOR pada `link_couple`/`unlink_couple` — kedua fungsi
--      sebelumnya menerima `p_user_id` sebagai parameter bebas tanpa
--      pernah memvalidasi `p_user_id = auth.uid()`. Karena RPC ini
--      SECURITY DEFINER dan dipanggil langsung dari client, siapa pun
--      yang login bisa memanggil
--        supabase.rpc("unlink_couple", { p_user_id: "<uuid-korban>" })
--      dan memutuskan/memaksa-link akun orang lain tanpa consent.
--
--   3. Fix race condition pada `link_couple` — sebelumnya tidak ada
--      row lock sama sekali saat membaca status user & partner. Dua
--      user yang link ke kode pasangan yang sama nyaris bersamaan bisa
--      menghasilkan data pasangan asimetris (A.partner_id=B tapi
--      B.partner_id=C). Sekarang kedua baris dikunci dengan
--      SELECT ... FOR UPDATE dalam urutan GLOBAL konsisten
--      (LEAST/GREATEST by UUID) — ini penting untuk mencegah deadlock
--      antar dua transaksi link_couple yang berjalan bersamaan dengan
--      pasangan baris yang tumpang tindih.
-- ============================================================

-- ============================================================
-- 1. TRIGGER: protect_sensitive_user_columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_sensitive_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- current_user berubah jadi role OWNER fungsi selama eksekusi fungsi
  -- SECURITY DEFINER (link_couple, unlink_couple, handle_new_auth_user,
  -- dll) — jadi UPDATE yang berasal dari RPC tersebut TIDAK terblokir.
  -- Service role (API routes dengan SUPABASE_SERVICE_ROLE_KEY) juga
  -- tidak terblokir karena role-nya 'service_role', bukan 'authenticated'.
  -- Hanya UPDATE langsung dari client (anon key + JWT user biasa) yang
  -- dibatasi di sini.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom is_admin tidak boleh diubah langsung oleh client';
    END IF;
    IF NEW.couple_code IS DISTINCT FROM OLD.couple_code THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom couple_code tidak boleh diubah langsung oleh client';
    END IF;
    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom partner_id hanya boleh diubah via link_couple/unlink_couple';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom status hanya boleh diubah via link_couple/unlink_couple';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom email harus diubah lewat Supabase Auth, bukan tabel users langsung';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom id tidak boleh diubah';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_sensitive_user_columns() IS
  'Blokir UPDATE langsung dari client (role authenticated/anon) terhadap kolom sensitif users (is_admin, couple_code, partner_id, status, email, id). RPC SECURITY DEFINER dan service role tidak terpengaruh.';

DROP TRIGGER IF EXISTS trg_protect_sensitive_user_columns ON public.users;
CREATE TRIGGER trg_protect_sensitive_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_user_columns();

-- ============================================================
-- 2 & 3. FUNCTION: link_couple — fix IDOR + race condition
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_couple(
  p_user_id     UUID,
  p_couple_code VARCHAR(10)
)
RETURNS TABLE (
  user_id     UUID,
  partner_id  UUID,
  couple_code VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id     UUID;
  v_user_status    VARCHAR(10);
  v_partner_status VARCHAR(10);
  v_first_id       UUID;
  v_second_id      UUID;
BEGIN
  -- Fix IDOR: hanya user yang sedang login (pemilik JWT) boleh
  -- menghubungkan akunnya sendiri. Tanpa ini, siapa pun bisa memanggil
  -- link_couple(p_user_id=<uuid korban>, ...) dan memaksa-link akun
  -- orang lain karena fungsi ini SECURITY DEFINER (bypass RLS).
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED'
      USING DETAIL = 'Kamu hanya bisa menghubungkan akunmu sendiri';
  END IF;

  -- Cari kandidat partner via couple_code (read biasa, belum locking —
  -- couple_code sendiri sudah dilindungi trigger protect_sensitive_user_columns
  -- sehingga tidak bisa berubah di antara baris ini dan lock di bawah).
  SELECT u.id INTO v_partner_id
  FROM public.users u
  WHERE u.couple_code = p_couple_code
    AND u.id != p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE'
      USING DETAIL = 'Couple code tidak ditemukan atau kamu mencoba link ke diri sendiri';
  END IF;

  -- Fix race condition: lock KEDUA baris (user & partner) dalam urutan
  -- GLOBAL yang konsisten (LEAST/GREATEST by UUID) — bukan berdasarkan
  -- siapa p_user_id/partner. Ini krusial untuk mencegah deadlock ketika
  -- dua panggilan link_couple berjalan bersamaan dengan pasangan baris
  -- yang tumpang tindih (misal A & C keduanya mencoba link ke B).
  v_first_id  := LEAST(p_user_id, v_partner_id);
  v_second_id := GREATEST(p_user_id, v_partner_id);

  PERFORM 1 FROM public.users WHERE id = v_first_id  FOR UPDATE;
  PERFORM 1 FROM public.users WHERE id = v_second_id FOR UPDATE;

  -- Re-read status SETELAH lock diperoleh — nilai ini dijamin fresh
  -- (bukan snapshot lama) karena baris sudah dikunci.
  SELECT status INTO v_user_status FROM public.users WHERE id = p_user_id;
  SELECT status INTO v_partner_status FROM public.users WHERE id = v_partner_id;

  IF v_user_status = 'linked' THEN
    RAISE EXCEPTION 'ALREADY_LINKED'
      USING DETAIL = 'Kamu sudah terhubung dengan pasangan';
  END IF;

  IF v_partner_status = 'linked' THEN
    RAISE EXCEPTION 'PARTNER_ALREADY_LINKED'
      USING DETAIL = 'Kode ini sudah dipakai oleh orang lain';
  END IF;

  UPDATE public.users
  SET partner_id = v_partner_id, status = 'linked', updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.users
  SET partner_id = p_user_id, status = 'linked', updated_at = now()
  WHERE id = v_partner_id;

  RETURN QUERY SELECT p_user_id, v_partner_id, p_couple_code;
END;
$$;

-- ============================================================
-- 2 & 3. FUNCTION: unlink_couple — fix IDOR + konsisten row lock
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
BEGIN
  -- Fix IDOR: sama seperti link_couple — cegah user memutuskan hubungan
  -- pasangan orang lain dengan menebak/mengetahui UUID mereka.
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

  -- Lock kedua baris dengan urutan konsisten (sama alasannya seperti link_couple).
  v_first_id  := LEAST(p_user_id, v_partner_id);
  v_second_id := GREATEST(p_user_id, v_partner_id);

  PERFORM 1 FROM public.users WHERE id = v_first_id  FOR UPDATE;
  PERFORM 1 FROM public.users WHERE id = v_second_id FOR UPDATE;

  UPDATE public.users
  SET partner_id = NULL, status = 'single', updated_at = now()
  WHERE id IN (p_user_id, v_partner_id);
END;
$$;
