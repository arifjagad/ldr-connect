-- ============================================================
-- LDR-Connect: Schema Fresh — 02 Row Level Security (RLS)
-- Jalankan SETELAH 01_tables.sql
--
-- Prinsip:
--   • Semua operasi WRITE business logic (deduct coin, buat session, dll)
--     dilakukan via API Routes menggunakan SERVICE ROLE KEY (bypass RLS).
--   • RLS di sini melindungi READ langsung dari client.
-- ============================================================

-- Enable RLS pada semua tabel
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_tod_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_snake_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anniversaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings       ENABLE ROW LEVEL SECURITY;

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

-- INSERT dihandle oleh trigger handle_new_auth_user() (SECURITY DEFINER)

-- ============================================================
-- wallets
-- ============================================================
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "wallets_select_partner"
  ON public.wallets FOR SELECT
  USING (user_id = public.get_my_partner_id());

-- UPDATE & INSERT hanya via service role

-- ============================================================
-- coin_packages
-- ============================================================
CREATE POLICY "coin_packages_select_active"
  ON public.coin_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- coin_transactions
-- ============================================================
CREATE POLICY "coin_transactions_select_own"
  ON public.coin_transactions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- game_tod_questions
-- ============================================================

-- Baca pertanyaan global (admin seed)
CREATE POLICY "game_tod_questions_select_global"
  ON public.game_tod_questions FOR SELECT
  USING (is_active = true AND couple_id IS NULL);

-- Baca pertanyaan couple sendiri
CREATE POLICY "game_tod_questions_select_own_couple"
  ON public.game_tod_questions FOR SELECT
  USING (
    is_active = true
    AND couple_id = LEAST(auth.uid(), public.get_my_partner_id())
  );

-- User submit pertanyaan (is_active HARUS false, source HARUS 'user')
CREATE POLICY "game_tod_questions_insert_user"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND is_active = false
    AND source = 'user'
    AND couple_id IS NOT NULL
  );

-- Admin: baca semua (termasuk pending)
CREATE POLICY "game_tod_questions_select_admin"
  ON public.game_tod_questions FOR SELECT
  USING (public.is_admin());

-- Admin: approve/reject
CREATE POLICY "game_tod_questions_update_admin"
  ON public.game_tod_questions FOR UPDATE
  USING (public.is_admin());

-- Admin: seed pertanyaan global
CREATE POLICY "game_tod_questions_insert_admin"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- game_sessions
-- ============================================================

-- Baca sesi milik sendiri (host atau partner)
CREATE POLICY "game_sessions_select_own"
  ON public.game_sessions FOR SELECT
  USING (
    host_user_id = auth.uid()
    OR partner_user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE hanya via service role (atomic dengan coin deduction)
-- Realtime menghormati RLS — client hanya subscribe sesi milik sendiri

-- ============================================================
-- anniversaries
-- ============================================================
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
-- admin_activity_logs
-- ============================================================
CREATE POLICY "admin_logs_select_admin"
  ON public.admin_activity_logs FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- game_settings
-- ============================================================
CREATE POLICY "game_settings_select_authenticated"
  ON public.game_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "game_settings_update_admin"
  ON public.game_settings FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- game_snake_questions
-- ============================================================
CREATE POLICY "snake_questions_select_active"
  ON public.game_snake_questions FOR SELECT
  TO authenticated
  USING (is_active = true);
