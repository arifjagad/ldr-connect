-- ============================================================
-- LDR-Connect: Migration 037 — Couple Features Hardening
-- ============================================================
-- Isi:
--   1. Fix RLS `capsules_select_couple` — sebelumnya HANYA cek ownership
--      (sender_id/receiver_id), TIDAK memeriksa `status`. Sensor isi
--      pesan (`message: null`) hanya dilakukan di layer aplikasi
--      (app/api/capsule/route.ts, pakai service-role client) — RLS
--      sendiri tidak dibatasi, sehingga:
--        a) Panggilan Supabase langsung dari browser
--           (`supabase.from("capsules").select("message").eq("id", X)`)
--           bisa membocorkan isi pesan sebelum status='delivered'.
--        b) Realtime payload (postgres_changes) yang dikirim ke browser
--           receiver — termasuk kolom `message` — juga tidak difilter,
--           sehingga bisa dibaca lewat DevTools Network/WS tab meski UI
--           tidak menampilkannya.
--      Fix: receiver hanya boleh SELECT baris yang `status != 'locked'`.
--      Sender tetap bisa SELECT semua baris miliknya (termasuk locked —
--      "spoiler untuk diri sendiri" bukan masalah keamanan).
--
--   2. Trigger `protect_anniversary_owner` — RLS `anniversaries_update_couple`
--      memvalidasi bahwa `user_id` BARU adalah salah satu dari (diri
--      sendiri, partner), tapi tidak melarang PERUBAHAN `user_id` itu
--      sendiri. Partner B bisa reassign anniversary milik A jadi "milik"
--      B (nilai baru = B = auth.uid(), lolos WITH CHECK), lalu hapus
--      lewat `anniversaries_delete_own` yang seharusnya hanya untuk
--      pemilik asli. Fix: blokir UPDATE kolom `user_id` dari client
--      (role authenticated/anon), sama pola dengan
--      `protect_sensitive_user_columns` (migration 036).
-- ============================================================

-- ============================================================
-- 1. FIX RLS: capsules_select_couple
-- ============================================================
DROP POLICY IF EXISTS "capsules_select_couple" ON public.capsules;
CREATE POLICY "capsules_select_couple"
  ON public.capsules FOR SELECT
  USING (
    sender_id = auth.uid()
    OR (receiver_id = auth.uid() AND status != 'locked')
  );

-- ============================================================
-- 2. TRIGGER: protect_anniversary_owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_anniversary_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE'
        USING DETAIL = 'Kolom user_id pada anniversaries tidak boleh diubah langsung oleh client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_anniversary_owner() IS
  'Blokir UPDATE kolom user_id pada anniversaries dari client (role authenticated/anon) — mencegah partner me-reassign kepemilikan lalu menghapus entry milik pihak lain via anniversaries_delete_own.';

DROP TRIGGER IF EXISTS trg_protect_anniversary_owner ON public.anniversaries;
CREATE TRIGGER trg_protect_anniversary_owner
  BEFORE UPDATE ON public.anniversaries
  FOR EACH ROW EXECUTE FUNCTION public.protect_anniversary_owner();
