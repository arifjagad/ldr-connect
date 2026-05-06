-- ============================================================
-- LDR-Connect: Migration 019 — Tambah number_order mini-game
--
-- Menambahkan mini-game "Urutan Angka" (number_order) ke pool
-- kategori BRAIN. Player tap angka 1–9 secara berurutan pada
-- grid 3×3 yang diacak.
-- ============================================================

INSERT INTO public.game_minigame_configs (game_id, name, category, duration, is_active, config)
VALUES (
  'number_order',
  'Urutan Angka',
  'brain',
  20,
  true,
  '{"description": "Tap angka 1 sampai 9 secara berurutan dari grid acak!", "total_numbers": 9}'::jsonb
)
ON CONFLICT (game_id) DO UPDATE
  SET name      = EXCLUDED.name,
      category  = EXCLUDED.category,
      duration  = EXCLUDED.duration,
      config    = EXCLUDED.config,
      is_active = EXCLUDED.is_active;
