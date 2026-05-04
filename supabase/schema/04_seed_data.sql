-- ============================================================
-- LDR-Connect: Schema Fresh — 04 Seed Data
-- Jalankan SETELAH 03_functions.sql
--
-- Berisi: game_settings + coin_packages
-- Untuk pertanyaan, lanjutkan dengan:
--   migrations/004_tod_questions_seed.sql   (ToD questions)
--   migrations/005_snake_questions_seed.sql  (Snake questions)
-- ============================================================

-- ============================================================
-- SEED: game_settings
-- ============================================================
INSERT INTO public.game_settings
  (game_type, display_name, description, coin_cost, expires_in_minutes, is_active)
VALUES
  ('tod',          'Truth or Dare', 'Game seru Truth or Dare untuk pasangan LDR', 1,  10, true),
  ('snake_ladder', 'Ular Tangga',   'Main ular tangga bareng pasangan',            5,  20, true),
  ('quiz',         'Quiz Pasangan', 'Uji seberapa kenal kamu dengan pasanganmu',   5,  15, false)
ON CONFLICT (game_type) DO UPDATE
  SET coin_cost          = EXCLUDED.coin_cost,
      expires_in_minutes = EXCLUDED.expires_in_minutes,
      is_active          = EXCLUDED.is_active,
      updated_at         = now();

-- ============================================================
-- SEED: coin_packages
-- ============================================================
INSERT INTO public.coin_packages (name, coin_amount, price, is_active)
VALUES
  ('Starter Pack',  20,  15000,  true),
  ('Popular Pack',  50,  35000,  true),
  ('Value Pack',    100, 65000,  true),
  ('Premium Pack',  200, 120000, true)
ON CONFLICT DO NOTHING;
