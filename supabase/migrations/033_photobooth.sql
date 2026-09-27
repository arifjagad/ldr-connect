-- ============================================================
-- LDR-Connect: Migration 033 — Virtual Couple Photobooth
-- ============================================================
-- Isi:
--   1. Update CHECK constraint game_sessions.game_type untuk 'photobooth'
--   2. Tabel public.game_photobooth_templates (Frame PNG transparan & koordinat slot)
--   3. Seed game_settings untuk 'photobooth' (biaya 3 coin)
--   4. RLS policies untuk public.game_photobooth_templates
--   5. Seed template bawaan (Classic Strip 2x6 - 3 Shots)
--   6. Realtime publication untuk game_photobooth_templates
-- ============================================================

-- ============================================================
-- 1. Update CHECK constraint game_sessions.game_type
-- ============================================================
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN ('tod', 'snake_ladder', 'quiz', 'dare_derby', 'quoridor', 'photobooth'));

-- ============================================================
-- 2. TABLE: game_photobooth_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_photobooth_templates (
  id            BIGSERIAL    PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  image_url     TEXT         NOT NULL,
  thumbnail_url TEXT,
  aspect_ratio  VARCHAR(20)  NOT NULL DEFAULT '2:6', -- '2:6', '4:6', '1:1', dll
  canvas_width  INTEGER      NOT NULL DEFAULT 600,
  canvas_height INTEGER      NOT NULL DEFAULT 1800,
  photo_count   INTEGER      NOT NULL DEFAULT 3 CHECK (photo_count > 0),
  slots         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_photobooth_templates_is_active ON public.game_photobooth_templates(is_active);

COMMENT ON TABLE  public.game_photobooth_templates               IS 'Template frame PNG transparan untuk photobooth couple';
COMMENT ON COLUMN public.game_photobooth_templates.slots         IS 'Array koordinat slot foto: [{"index": 1, "x": 40, "y": 60, "width": 520, "height": 500, "rounded": 12}, ...]';
COMMENT ON COLUMN public.game_photobooth_templates.canvas_width  IS 'Lebar kanvas render resolusi tinggi (pixel)';
COMMENT ON COLUMN public.game_photobooth_templates.canvas_height IS 'Tinggi kanvas render resolusi tinggi (pixel)';

-- ============================================================
-- 3. SEED: game_settings (Photobooth - 3 Coin)
-- ============================================================
INSERT INTO public.game_settings (game_type, display_name, description, coin_cost, expires_in_minutes, is_active)
VALUES (
  'photobooth',
  'Virtual Photobooth',
  'Foto studio couple online! Abadikan momen estetik bersama pasangan lewat video call & strip frame transparan resolusi tinggi.',
  3,
  30,
  true
)
ON CONFLICT (game_type) DO UPDATE
  SET display_name       = EXCLUDED.display_name,
      description        = EXCLUDED.description,
      coin_cost          = EXCLUDED.coin_cost,
      expires_in_minutes = EXCLUDED.expires_in_minutes,
      updated_at         = now();

-- ============================================================
-- 4. ROW LEVEL SECURITY: game_photobooth_templates
-- ============================================================
ALTER TABLE public.game_photobooth_templates ENABLE ROW LEVEL SECURITY;

-- Semua user login dapat melihat template yang aktif
DROP POLICY IF EXISTS "game_photobooth_templates_select" ON public.game_photobooth_templates;
CREATE POLICY "game_photobooth_templates_select"
  ON public.game_photobooth_templates FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Admin dapat insert/update/delete template
DROP POLICY IF EXISTS "game_photobooth_templates_admin_all" ON public.game_photobooth_templates;
CREATE POLICY "game_photobooth_templates_admin_all"
  ON public.game_photobooth_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 5. SEED INITIAL TEMPLATE: Classic Strip 2x6 - Minimalist Dark
-- Menggunakan layout strip 2x6 (3 cut vertikal)
-- ============================================================
INSERT INTO public.game_photobooth_templates (
  name,
  description,
  image_url,
  thumbnail_url,
  aspect_ratio,
  canvas_width,
  canvas_height,
  photo_count,
  slots,
  is_active
) VALUES (
  'Classic 2x6 Noir — 3 Cuts',
  'Template strip vertikal 2x6 klasik dengan estetika minimalis gelap dan 3 frame foto pasangan.',
  '/images/photobooth/2x6_02.png',
  '/images/photobooth/2x6_02.png',
  '2:6',
  600,
  1800,
  3,
  '[
    { "index": 1, "x": 48, "y": 80,  "width": 504, "height": 460, "rounded": 16 },
    { "index": 2, "x": 48, "y": 570, "width": 504, "height": 460, "rounded": 16 },
    { "index": 3, "x": 48, "y": 1060, "width": 504, "height": 460, "rounded": 16 }
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. REALTIME SUBSCRIPTION
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_photobooth_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_photobooth_templates;
  END IF;
END $$;
