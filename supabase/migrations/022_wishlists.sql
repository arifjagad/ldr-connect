-- Migration 022: Shared Wishlist
-- Fitur bucket list bersama untuk pasangan LDR
-- 1 tabel, reaksi tersimpan langsung di kolom (max 1 reaksi per item dari partner)

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

-- Auto update updated_at
CREATE TRIGGER trg_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

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

-- UPDATE: created_by bisa edit title/desc/category/is_active
--         Kedua partner boleh update is_done (mark selesai)
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

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;
