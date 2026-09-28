-- ============================================================
-- LDR-Connect Seed — Template frame Photobooth bawaan
-- Jalankan setelah semua file schema (00–11).
-- ============================================================

-- Classic Strip 2x6 — 3 shot (migration 033)
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
