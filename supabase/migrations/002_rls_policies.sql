-- ============================================================
-- LDR-Connect: Migration 002 — Row Level Security (RLS)
-- Jalankan SETELAH 001_tables.sql
-- ============================================================
-- Prinsip:
-- - Semua operasi WRITE (insert/update/delete) yang melibatkan
--   business logic (deduct coin, buat session, dll) dilakukan
--   via API Routes Next.js menggunakan SERVICE ROLE KEY
--   (bypass RLS). Ini aman karena service key hanya ada di server.
-- - RLS policies di sini melindungi akses READ langsung dari client
--   dan INSERT sederhana (anniversaries, submit question).
--
-- PENTING: Jangan query public.users di dalam policy ON public.users
-- karena akan menyebabkan infinite recursion (error 42P17).
-- Gunakan helper functions SECURITY DEFINER sebagai gantinya.
-- ============================================================

-- Enable RLS pada semua tabel
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_tod_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_snake_questions   ENABLE ROW LEVEL SECURITY;
-- game_snake_sessions dihapus di migration 006 (pakai game_sessions)
ALTER TABLE public.anniversaries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- Bypass RLS agar tidak menyebabkan infinite recursion
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
-- TABLE: users
-- ============================================================

-- Baca profile sendiri
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Baca profile partner — pakai helper function, BUKAN subquery ke users
-- (subquery ke users di dalam policy users menyebabkan infinite recursion)
CREATE POLICY "users_select_partner"
  ON public.users FOR SELECT
  USING (id = public.get_my_partner_id());

-- Update profile sendiri
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT dihandle oleh trigger handle_new_auth_user() dengan SECURITY DEFINER
-- Tidak ada INSERT policy untuk client

-- ============================================================
-- TABLE: wallets
-- ============================================================

-- Baca wallet sendiri
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (user_id = auth.uid());

-- Baca wallet partner — pakai helper function
CREATE POLICY "wallets_select_partner"
  ON public.wallets FOR SELECT
  USING (user_id = public.get_my_partner_id());

-- UPDATE dan INSERT hanya via service role (API routes)

-- ============================================================
-- TABLE: coin_packages
-- ============================================================

-- Semua user authenticated bisa lihat paket aktif
CREATE POLICY "coin_packages_select_active"
  ON public.coin_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- TABLE: coin_transactions
-- ============================================================

-- Baca riwayat transaksi sendiri
CREATE POLICY "coin_transactions_select_own"
  ON public.coin_transactions FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE hanya via service role (API routes + webhook handler)

-- ============================================================
-- TABLE: game_tod_questions
-- ============================================================

-- Baca pertanyaan global (admin seeded, is_active = true, couple_id = null)
CREATE POLICY "game_tod_questions_select_global"
  ON public.game_tod_questions FOR SELECT
  USING (
    is_active = true
    AND couple_id IS NULL
  );

-- Baca pertanyaan couple sendiri — pakai helper function
CREATE POLICY "game_tod_questions_select_own_couple"
  ON public.game_tod_questions FOR SELECT
  USING (
    is_active = true
    AND couple_id = LEAST(auth.uid(), public.get_my_partner_id())
  );

-- User bisa submit pertanyaan sendiri (is_active HARUS false, source HARUS 'user')
CREATE POLICY "game_tod_questions_insert_user"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND is_active = false
    AND source = 'user'
    AND couple_id IS NOT NULL
  );

-- Admin bisa baca semua pertanyaan (termasuk yang pending)
CREATE POLICY "game_tod_questions_select_admin"
  ON public.game_tod_questions FOR SELECT
  USING (public.is_admin());

-- Admin bisa update (approve/reject)
CREATE POLICY "game_tod_questions_update_admin"
  ON public.game_tod_questions FOR UPDATE
  USING (public.is_admin());

-- Admin bisa insert (seed pertanyaan global)
CREATE POLICY "game_tod_questions_insert_admin"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- TABLE: game_sessions
-- ============================================================

-- Baca sesi milik sendiri (sebagai host atau partner)
CREATE POLICY "game_sessions_select_own"
  ON public.game_sessions FOR SELECT
  USING (
    host_user_id = auth.uid()
    OR partner_user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE hanya via service role (API routes)
-- Alasan: create_session harus atomic dengan coin deduction

-- NOTE untuk Supabase Realtime:
-- Realtime menghormati RLS. Client hanya bisa subscribe ke perubahan
-- game_sessions yang memenuhi policy "game_sessions_select_own" di atas.
-- Subscribe dilakukan dengan filter: session_code=eq.{code}

-- ============================================================
-- TABLE: anniversaries
-- ============================================================

-- CRUD penuh untuk anniversary milik sendiri
CREATE POLICY "anniversaries_select_own"
  ON public.anniversaries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "anniversaries_insert_own"
  ON public.anniversaries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "anniversaries_update_own"
  ON public.anniversaries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "anniversaries_delete_own"
  ON public.anniversaries FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE: admin_activity_logs
-- ============================================================

-- Hanya admin yang bisa baca — pakai helper function
CREATE POLICY "admin_logs_select_admin"
  ON public.admin_activity_logs FOR SELECT
  USING (public.is_admin());

-- INSERT hanya via service role (audit logging di API routes)

-- ============================================================
-- TABLE: game_settings
-- ============================================================

-- Semua user authenticated bisa baca settings
CREATE POLICY "game_settings_select_authenticated"
  ON public.game_settings FOR SELECT
  TO authenticated
  USING (true);

-- Admin bisa update settings — pakai helper function
CREATE POLICY "game_settings_update_admin"
  ON public.game_settings FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- TABLE: game_snake_questions
-- ============================================================

-- Semua user authenticated bisa baca pertanyaan aktif
CREATE POLICY "snake_questions_select_active"
  ON public.game_snake_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- INSERT/UPDATE/DELETE hanya via service role (API routes)

-- game_snake_sessions dihapus di migration 006.
-- Sesi Ular Tangga sekarang pakai game_sessions (game_type='snake_ladder').
-- RLS untuk game_sessions sudah di-cover oleh policy game_sessions_select_own.
