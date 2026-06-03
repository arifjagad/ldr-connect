-- ============================================================
-- Migration 030: Add 4 new mini-games to Dare Derby
--   1. math_dash     (brain)  — Jawab soal matematika cepat-cepatan
--   2. flag_guess    (brain)  — Tebak negara dari emoji bendera
--   3. fastest_typer (skill)  — Ketik kata secepat mungkin
--   4. color_match   (skill)  — Stroop effect: pilih warna teks, bukan kata
-- ============================================================

INSERT INTO public.game_minigame_configs (game_id, name, category, duration, is_active, config)
VALUES
  ('math_dash',     'Math Dash',     'brain', 20, true,
   '{"description": "Jawab soal matematika secepat mungkin!", "questions_per_round": 5}'::jsonb),
  ('flag_guess',    'Tebak Bendera', 'brain', 20, true,
   '{"description": "Tebak negara dari emoji bendera!", "questions_per_round": 5}'::jsonb),
  ('fastest_typer', 'Ketik Cepat',   'skill', 30, true,
   '{"description": "Ketik kata yang muncul secepat mungkin!", "words_per_round": 5}'::jsonb),
  ('color_match',   'Color Match',   'skill', 20, true,
   '{"description": "Pilih warna teks, bukan kata yang tertulis! (Stroop effect)", "rounds_per_game": 6}'::jsonb)
ON CONFLICT (game_id) DO UPDATE
  SET name = EXCLUDED.name, category = EXCLUDED.category,
      duration = EXCLUDED.duration, config = EXCLUDED.config,
      is_active = EXCLUDED.is_active;
