-- ============================================================
-- LDR-Connect Schema — 01 Akun, profil & couple
-- Jalankan SETELAH 00_common.sql
--
-- users, admin_activity_logs, signup trigger, proteksi kolom sensitif,
-- helper RLS (get_my_partner_id, is_admin), get_couple_id, link/unlink couple,
-- bucket avatars.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: generate_couple_code
-- Buat couple_code unik 10 karakter (diperlukan untuk DEFAULT di tabel users)
-- Harus dibuat SEBELUM tabel users
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_couple_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE couple_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE public.users (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  couple_code VARCHAR(10)  UNIQUE NOT NULL DEFAULT public.generate_couple_code(),
  partner_id  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  avatar_url  TEXT         DEFAULT NULL,
  status      VARCHAR(10)  NOT NULL DEFAULT 'single'
                CHECK (status IN ('single', 'linked')),
  is_admin    BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_couple_code ON public.users(couple_code);
CREATE INDEX idx_users_partner_id  ON public.users(partner_id);
CREATE INDEX idx_users_status      ON public.users(status);

COMMENT ON COLUMN public.users.couple_code IS 'Kode unik 10 karakter untuk link pasangan';
COMMENT ON COLUMN public.users.partner_id  IS 'Self-referential FK ke users.id';
COMMENT ON COLUMN public.users.status      IS 'single | linked';

-- ============================================================
-- TABLE: admin_activity_logs
-- ============================================================
CREATE TABLE public.admin_activity_logs (
  id            BIGSERIAL    PRIMARY KEY,
  admin_user_id UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  action        VARCHAR(120) NOT NULL,
  target_type   VARCHAR(255),
  target_id     BIGINT,
  metadata      JSONB,
  ip_address    INET,
  user_agent    VARCHAR(500),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_logs_user   ON public.admin_activity_logs(admin_user_id);
CREATE INDEX idx_admin_logs_target ON public.admin_activity_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_action ON public.admin_activity_logs(action);
CREATE INDEX idx_admin_logs_date   ON public.admin_activity_logs(created_at DESC);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER FUNCTION: protect_sensitive_user_columns (migration 036)
-- Blokir UPDATE langsung dari client (role authenticated/anon) terhadap
-- kolom sensitif users (is_admin, couple_code, partner_id, status, email,
-- id). RLS policy `users_update_own` hanya membatasi BARIS, tidak KOLOM —
-- tanpa trigger ini, client bisa memanggil
--   supabase.from("users").update({ is_admin: true }).eq("id", myId)
-- langsung dari browser dan self-promote jadi admin.
-- RPC SECURITY DEFINER (link_couple, unlink_couple, handle_new_auth_user)
-- dan service role TIDAK terpengaruh — current_user berubah jadi role
-- owner fungsi selama eksekusi SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_sensitive_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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

CREATE TRIGGER trg_protect_sensitive_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_user_columns();

CREATE TRIGGER trg_admin_logs_updated_at
  BEFORE UPDATE ON public.admin_activity_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create user profile + wallet saat signup
-- Sejak migration 042 tidak menelan exception — signup gagal utuh
-- (auth.users ikut rollback) daripada meninggalkan akun tanpa profile.
-- ============================================================
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Enable RLS pada semua tabel
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- Bypass RLS untuk menghindari infinite recursion di policies
-- ============================================================

-- Ambil partner_id user yang sedang login
CREATE OR REPLACE FUNCTION public.get_my_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.users WHERE id = auth.uid();
$$;

-- Cek apakah user yang sedang login adalah admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- users
-- ============================================================
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Baca profil partner via helper function (hindari infinite recursion)
CREATE POLICY "users_select_partner"
  ON public.users FOR SELECT
  USING (id = public.get_my_partner_id());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- admin_activity_logs
-- ============================================================
CREATE POLICY "admin_logs_select_admin"
  ON public.admin_activity_logs FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- FUNCTION: get_couple_id
-- Hitung couple_id dari user_id (selalu LEAST(user_id, partner_id))
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_couple_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN LEAST(p_user_id, v_partner_id);
END;
$$;

-- ============================================================
-- FUNCTION: link_couple (hardened — migration 036)
-- Hubungkan dua user sebagai pasangan (atomic)
-- Dipanggil dari: client (supabase.rpc) di app/dashboard/couple/page.tsx
--
-- Hardening migration 036:
--   - IDOR fix: p_user_id WAJIB sama dengan auth.uid() — mencegah user
--     memaksa-link akun orang lain (fungsi ini SECURITY DEFINER/bypass RLS).
--   - Race condition fix: kedua baris (user & partner) dikunci via
--     SELECT ... FOR UPDATE dalam urutan GLOBAL konsisten
--     (LEAST/GREATEST by UUID) sebelum re-read status & update — mencegah
--     data pasangan asimetris jika dua link_couple berjalan bersamaan,
--     dan mencegah deadlock antar transaksi yang overlap.
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
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED'
      USING DETAIL = 'Kamu hanya bisa menghubungkan akunmu sendiri';
  END IF;

  SELECT u.id INTO v_partner_id
  FROM public.users u
  WHERE u.couple_code = p_couple_code
    AND u.id != p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE'
      USING DETAIL = 'Couple code tidak ditemukan atau kamu mencoba link ke diri sendiri';
  END IF;

  v_first_id  := LEAST(p_user_id, v_partner_id);
  v_second_id := GREATEST(p_user_id, v_partner_id);

  PERFORM 1 FROM public.users WHERE id = v_first_id  FOR UPDATE;
  PERFORM 1 FROM public.users WHERE id = v_second_id FOR UPDATE;

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
-- FUNCTION: unlink_couple (hardened — migration 036, sesi game — 042)
-- Putuskan hubungan pasangan (atomic). Sejak 042 juga membereskan sesi
-- game aktif couple: waiting → refund host, playing → cancelled.
-- Dipanggil dari: client (supabase.rpc) di app/dashboard/couple/page.tsx
--
-- Hardening migration 036: sama seperti link_couple — IDOR fix
-- (p_user_id = auth.uid()) + row lock konsisten.
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

-- ============================================================
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_couple_id(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- STORAGE: bucket avatars (migration 043)
-- Publik karena app/api/user/avatar memakai getPublicUrl(). Tulis/hapus
-- hanya lewat service role, jadi tidak ada policy untuk anon/authenticated.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  3145728, -- 3 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public             = true,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
