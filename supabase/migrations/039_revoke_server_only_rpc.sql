-- ============================================================
-- LDR-Connect: Migration 039 — Revoke Client Access ke RPC Server-Only
-- Jalankan SETELAH 038_tod_audit_fixes.sql
-- ============================================================
-- Bug (ditemukan saat audit game Dare Derby, tapi berdampak ke SEMUA
-- RPC game & sebagian RPC payment):
--
-- Hampir semua stored function SECURITY DEFINER di project ini menerima
-- `p_user_id` sebagai parameter bebas TANPA memvalidasi `p_user_id =
-- auth.uid()` — pola identik dengan bug IDOR `link_couple`/`unlink_couple`
-- yang sudah diperbaiki di migration 036. Bedanya, `link_couple`/
-- `unlink_couple` MEMANG didesain dipanggil langsung dari client
-- (app/dashboard/couple/page.tsx via supabase.rpc()), sehingga fix yang
-- tepat untuk keduanya adalah menambah cek auth.uid(). Fungsi-fungsi lain
-- (semua RPC game: create_game_session, roll_snake_dice,
-- confirm_dare_derby_dare, quoridor_action, dst — dan RPC payment:
-- redeem_voucher, create_pending_topup, dst) TIDAK PERNAH dipanggil dari
-- client sama sekali — semuanya dipanggil eksklusif dari API route via
-- service-role client (createServiceClient()).
--
-- Supabase/PostgREST secara default meng-GRANT EXECUTE semua fungsi baru
-- ke role `authenticated` (dan kadang `anon`). Karena fungsi-fungsi ini
-- SECURITY DEFINER (bypass RLS) dan tidak pernah divalidasi p_user_id-nya,
-- SIAPA PUN yang login bisa memanggil misalnya:
--   supabase.rpc("confirm_dare_derby_dare", {
--     p_session_code: "<kode sesi milik orang lain/sendiri>",
--     p_user_id: "<uuid korban>",   -- menyamar sebagai user lain
--     p_confirmed: true
--   })
-- langsung dari browser (bypass Next.js API route sepenuhnya) dan
-- melakukan aksi ATAS NAMA user lain — termasuk roll dadu, submit skor,
-- gerak Quoridor, konfirmasi/skip dare, redeem voucher, dst.
--
-- Fix: REVOKE EXECUTE dari `PUBLIC`, `anon`, dan `authenticated` untuk
-- semua RPC yang seharusnya HANYA dipanggil server-side. Service role
-- (dipakai createServiceClient()) TIDAK terpengaruh REVOKE ini — service
-- role selalu bisa mengeksekusi semua fungsi terlepas dari GRANT/REVOKE
-- biasa. `link_couple` dan `unlink_couple` SENGAJA TIDAK di-revoke di
-- sini karena keduanya memang dipanggil client-side dan sudah dilindungi
-- oleh cek auth.uid() sejak migration 036.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_couple_id(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_game_session(UUID, VARCHAR, VARCHAR, JSONB, INTEGER, TIMESTAMPTZ, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_game_session(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.answer_tod_question(UUID, VARCHAR, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_expired_session(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_waiting_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_status(VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pending_topup_count(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_session_for_couple(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_game_session(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.roll_snake_dice(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_snake_challenge(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.select_dare_derby_minigames(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ready_up_dare_derby(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_dare_derby_round(VARCHAR, UUID, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_dare_derby_dare(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_dare_derby_dare(VARCHAR, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_dare_derby_dare(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_voucher(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_topup_discount(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_pending_topup(UUID, BIGINT, INTEGER, INTEGER, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quoridor_has_path(INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quoridor_action(VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_topup_transaction(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_topups() FROM PUBLIC, anon, authenticated;

-- link_couple & unlink_couple SENGAJA TIDAK di-revoke — dipanggil client-side
-- (app/dashboard/couple/page.tsx) dan sudah dilindungi auth.uid() sejak 036.
