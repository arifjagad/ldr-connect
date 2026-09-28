-- ============================================================
-- LDR-Connect Seed — Konfigurasi biaya & durasi per game
-- Jalankan setelah semua file schema (00–11).
-- ============================================================

-- ============================================================
-- SEED: game_settings
-- coin_cost Dare Derby = biaya partner join; biaya host dihitung
-- di API route berdasarkan total_rounds (5→3, 7→4, 10→6 coin).
-- ============================================================
INSERT INTO public.game_settings
  (game_type, display_name, description, coin_cost, expires_in_minutes, is_active)
VALUES
  ('tod',          'Truth or Dare', 'Game seru Truth or Dare untuk pasangan LDR',                        1,  10, true),
  ('snake_ladder', 'Ular Tangga',   'Main ular tangga bareng pasangan',                                  5,  20, true),
  ('quiz',         'Quiz Pasangan', 'Uji seberapa kenal kamu dengan pasanganmu',                         5,  15, false),
  ('dare_derby',   'Dare Derby',    'Mini-game kompetitif! Yang kalah tiap ronde dapat dare.',            3,  60, true),
  ('quoridor',     'Quoridor',      'Game strategi papan 9×9. Gerakkan pion atau pasang tembok!',         3,  30, true)
ON CONFLICT (game_type) DO UPDATE
  SET coin_cost          = EXCLUDED.coin_cost,
      expires_in_minutes = EXCLUDED.expires_in_minutes,
      is_active          = EXCLUDED.is_active,
      updated_at         = now();

-- Virtual Photobooth (migration 033)
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
