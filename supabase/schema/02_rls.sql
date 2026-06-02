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
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_tod_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_snake_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anniversaries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_dare_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_minigame_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions     ENABLE ROW LEVEL SECURITY;

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
-- (020: SELECT dibuka ke partner; 021: UPDATE dibuka ke partner)
-- ============================================================

-- Baca anniversary milik sendiri ATAU milik partner
CREATE POLICY "anniversaries_select_couple"
  ON public.anniversaries FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
  );

-- Insert hanya oleh pemilik
CREATE POLICY "anniversaries_insert_own"
  ON public.anniversaries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update boleh dilakukan oleh pemilik ATAU partner
CREATE POLICY "anniversaries_update_couple"
  ON public.anniversaries FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
  );

-- Delete hanya oleh pemilik (tidak boleh partner hapus milik partner)
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

-- ============================================================
-- game_dare_questions (migration 014)
-- ============================================================
CREATE POLICY "dare_questions_select_active"
  ON public.game_dare_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "dare_questions_all_admin"
  ON public.game_dare_questions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- game_minigame_configs (migration 014)
-- ============================================================
CREATE POLICY "minigame_configs_select_active"
  ON public.game_minigame_configs FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "minigame_configs_all_admin"
  ON public.game_minigame_configs FOR ALL
  USING (public.is_admin());

-- ============================================================
-- vouchers (migration 020+021)
-- ============================================================

-- Semua authenticated bisa baca voucher aktif (untuk cek kode)
CREATE POLICY "vouchers_select_active"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin bisa baca semua (termasuk nonaktif)
CREATE POLICY "vouchers_select_admin"
  ON public.vouchers FOR SELECT
  USING (public.is_admin());

-- Admin bisa insert, update, delete
CREATE POLICY "vouchers_write_admin"
  ON public.vouchers FOR ALL
  USING (public.is_admin());

-- ============================================================
-- voucher_redemptions (migration 020)
-- ============================================================

-- User bisa baca redemption milik sendiri
CREATE POLICY "vr_select_own"
  ON public.voucher_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE hanya via service role (redeem_voucher + apply_topup_discount RPC)
-- Admin bisa baca semua
CREATE POLICY "vr_select_admin"
  ON public.voucher_redemptions FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- wishlists (migration 022)
-- ============================================================

-- SELECT: Kedua partner bisa lihat wishlist couple mereka
CREATE POLICY "wishlists_select_couple"
  ON public.wishlists FOR SELECT
  USING (
    couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
  );

-- INSERT: Hanya user yang linked, couple_id harus cocok
CREATE POLICY "wishlists_insert_own"
  ON public.wishlists FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
  );

-- UPDATE: Kedua partner boleh update (mark selesai, edit, dll)
CREATE POLICY "wishlists_update"
  ON public.wishlists FOR UPDATE
  USING (
    couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
  );

-- DELETE: Hanya created_by
CREATE POLICY "wishlists_delete_own"
  ON public.wishlists FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- capsules (migration 023, updated 029)
-- ============================================================

-- Sender & receiver bisa lihat kapsul mereka
DROP POLICY IF EXISTS "capsules_select_couple" ON public.capsules;
CREATE POLICY "capsules_select_couple"
  ON public.capsules FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Hanya sender yang bisa buat kapsul
DROP POLICY IF EXISTS "capsules_insert_sender" ON public.capsules;
CREATE POLICY "capsules_insert_sender"
  ON public.capsules FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND receiver_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
    AND couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
    AND opens_at > CURRENT_DATE  -- harus di masa depan
  );

-- Update: receiver bisa ubah status ke 'opened'
DROP POLICY IF EXISTS "capsules_update_open" ON public.capsules;
CREATE POLICY "capsules_update_open"
  ON public.capsules FOR UPDATE
  USING (receiver_id = auth.uid() AND status = 'delivered');

-- ============================================================
-- push_subscriptions
-- ============================================================

-- User hanya bisa akses subscription miliknya sendiri
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bisa baca semua (untuk server-side push sending)
CREATE POLICY "push_subscriptions_service_role"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
