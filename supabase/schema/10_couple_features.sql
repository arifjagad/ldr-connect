-- ============================================================
-- LDR-Connect Schema — 10 Fitur couple
-- Jalankan SETELAH 09_game_photobooth.sql
--
-- anniversaries, wishlists, capsules (time capsule).
-- ============================================================

-- ============================================================
-- TABLE: anniversaries
-- ============================================================
CREATE TABLE public.anniversaries (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  date       DATE         NOT NULL,
  notes      TEXT,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_anniversaries_user_id ON public.anniversaries(user_id);
CREATE INDEX idx_anniversaries_date    ON public.anniversaries(date);

CREATE TRIGGER trg_anniversaries_updated_at
  BEFORE UPDATE ON public.anniversaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER FUNCTION: protect_anniversary_owner (migration 037)
-- RLS `anniversaries_update_couple` memvalidasi nilai BARU user_id boleh
-- diri sendiri atau partner, tapi tidak melarang PERUBAHAN user_id itu
-- sendiri — partner bisa reassign kepemilikan lalu hapus via
-- `anniversaries_delete_own` yang seharusnya owner-only.
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

CREATE TRIGGER trg_protect_anniversary_owner
  BEFORE UPDATE ON public.anniversaries
  FOR EACH ROW EXECUTE FUNCTION public.protect_anniversary_owner();

-- ============================================================
-- TABLE: wishlists (migration 022)
-- Bucket list bersama untuk pasangan
-- ============================================================
CREATE TABLE public.wishlists (
  id           BIGSERIAL    PRIMARY KEY,
  couple_id    UUID         NOT NULL,
  created_by   UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  category     VARCHAR(10)  NOT NULL DEFAULT 'other'
                 CHECK (category IN ('virtual', 'offline', 'dream', 'gift', 'other')),

  -- Status selesai
  is_done      BOOLEAN      NOT NULL DEFAULT false,
  done_by      UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  done_at      TIMESTAMPTZ,
  done_note    TEXT,

  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_wishlists_couple_id  ON public.wishlists(couple_id);
CREATE INDEX idx_wishlists_created_by ON public.wishlists(created_by);
CREATE INDEX idx_wishlists_is_done    ON public.wishlists(is_done);
CREATE INDEX idx_wishlists_category   ON public.wishlists(category);
CREATE INDEX idx_wishlists_created_at ON public.wishlists(created_at DESC);

CREATE TRIGGER trg_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;

-- ============================================================
-- TABLE: capsules (migration 023, updated 029)
-- Kapsul waktu digital — pesan yang dikunci sampai tanggal tertentu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.capsules (
  id           BIGSERIAL    PRIMARY KEY,
  sender_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id    UUID         NOT NULL,           -- LEAST(sender_id, receiver_id)

  message      TEXT         NOT NULL,           -- isi pesan
  opens_at     DATE         NOT NULL,           -- tanggal kapsul bisa dibuka

  -- Status: locked → delivered → opened
  status       VARCHAR(10)  NOT NULL DEFAULT 'locked'
                 CHECK (status IN ('locked', 'delivered', 'opened')),

  delivered_at TIMESTAMPTZ,                     -- kapan cron deliver (push notif)
  opened_at    TIMESTAMPTZ,                     -- kapan receiver buka

  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capsules_sender_id   ON public.capsules(sender_id);
CREATE INDEX IF NOT EXISTS idx_capsules_receiver_id ON public.capsules(receiver_id);
CREATE INDEX IF NOT EXISTS idx_capsules_couple_id   ON public.capsules(couple_id);
CREATE INDEX IF NOT EXISTS idx_capsules_opens_at    ON public.capsules(opens_at) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS idx_capsules_status      ON public.capsules(status);

CREATE OR REPLACE TRIGGER trg_capsules_updated_at
  BEFORE UPDATE ON public.capsules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.capsules;

ALTER TABLE public.anniversaries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capsules               ENABLE ROW LEVEL SECURITY;

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

-- Sender & receiver bisa lihat kapsul mereka.
-- Hardening migration 037: receiver HANYA bisa SELECT baris yang sudah
-- tidak 'locked' — tanpa ini, isi `message` bisa dibaca langsung via
-- supabase.from("capsules") atau realtime payload sebelum status berubah
-- jadi 'delivered' (sensor `message: null` sebelumnya hanya dilakukan di
-- app/api/capsule/route.ts, bukan di level RLS). Sender tetap bisa lihat
-- semua baris miliknya (termasuk locked — bukan risiko keamanan).
DROP POLICY IF EXISTS "capsules_select_couple" ON public.capsules;

CREATE POLICY "capsules_select_couple"
  ON public.capsules FOR SELECT
  USING (
    sender_id = auth.uid()
    OR (receiver_id = auth.uid() AND status != 'locked')
  );

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
