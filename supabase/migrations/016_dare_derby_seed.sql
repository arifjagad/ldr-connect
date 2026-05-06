-- ============================================================
-- LDR-Connect: Migration 016 — Dare Derby Seed Data
-- Jalankan SETELAH 015_dare_derby_functions.sql
--
-- Isi:
--   1. game_settings  — config session Dare Derby
--   2. game_minigame_configs — 5 mini-game MVP
--   3. game_dare_questions   — 24 dare (6 per kategori)
-- ============================================================

-- ============================================================
-- 1. GAME SETTINGS
--
-- Catatan coin_cost:
--   Nilai di sini (3) adalah default untuk partner join (join_game_session).
--   Coin host dihitung di API route berdasarkan total_rounds:
--     5 ronde  = 3 coin
--     7 ronde  = 4 coin
--     10 ronde = 6 coin
--
-- expires_in_minutes = 60 (generous untuk sesi hingga 10 ronde)
-- ============================================================
INSERT INTO public.game_settings (game_type, display_name, description, coin_cost, expires_in_minutes, is_active)
VALUES (
  'dare_derby',
  'Dare Derby',
  'Mini-game kompetitif! Yang kalah tiap ronde dapat dare nyata dari pasangan.',
  3,
  60,
  true
)
ON CONFLICT (game_type) DO UPDATE
  SET display_name       = EXCLUDED.display_name,
      description        = EXCLUDED.description,
      expires_in_minutes = EXCLUDED.expires_in_minutes,
      updated_at         = now();

-- ============================================================
-- 2. MINI-GAME CONFIGS — 5 Game MVP
--
-- Roadmap:
--   MVP (launch) : tap_timing, reaction_btn, memory_seq, word_scramble, true_false
--   v1.1         : pattern_copy, number_order, emoji_match, double_tap, math_fast
--   v1.2+        : sisa 20 game
-- ============================================================
INSERT INTO public.game_minigame_configs (game_id, name, category, duration, is_active, config)
VALUES
  -- ⚡ REFLEX
  (
    'tap_timing',
    'Perfect Tap',
    'reflex',
    10,
    true,
    '{"description": "Tap tepat saat bar berada di zona merah!", "zones": {"red": 10, "yellow": 40, "green": 70}}'::jsonb
  ),
  (
    'reaction_btn',
    'React!',
    'reflex',
    8,
    true,
    '{"description": "Tap tombol secepat mungkin saat muncul!", "max_delay_ms": 3000}'::jsonb
  ),

  -- 🧠 BRAIN
  (
    'memory_seq',
    'Ingat Urutan',
    'brain',
    30,
    true,
    '{"description": "Ingat dan ulangi urutan warna yang ditampilkan!", "sequence_length": 5, "colors": ["red", "blue", "green", "yellow"]}'::jsonb
  ),

  -- 🎯 SKILL
  (
    'word_scramble',
    'Acak Kata',
    'skill',
    20,
    true,
    '{"description": "Susun huruf acak menjadi kata yang benar!", "word_count": 1}'::jsonb
  ),
  (
    'true_false',
    'Benar/Salah',
    'skill',
    15,
    true,
    '{"description": "Tentukan apakah pernyataan berikut benar atau salah!", "question_count": 5}'::jsonb
  )

ON CONFLICT (game_id) DO UPDATE
  SET name      = EXCLUDED.name,
      category  = EXCLUDED.category,
      duration  = EXCLUDED.duration,
      config    = EXCLUDED.config,
      is_active = EXCLUDED.is_active;

-- ============================================================
-- 3. DARE QUESTIONS — 24 Dare (6 per kategori)
--
-- Kategori:
--   sweet    → Ringan, romantis, heartwarming
--   funny    → Lucu, sedikit memalukan, menghibur
--   bold     → Berani, sedikit challenging
--   challenge → Butuh effort lebih, memorable
-- ============================================================
INSERT INTO public.game_dare_questions (category, content) VALUES

  -- 🟢 SWEET (6)
  ('sweet', 'Kirim voice note bilang "I love you" dengan cara paling manis yang kamu bisa'),
  ('sweet', 'Screenshot wallpaper HP kamu sekarang dan kirim ke aku'),
  ('sweet', 'Ceritakan satu hal yang kamu suka dari aku hari ini lewat chat'),
  ('sweet', 'Kirim foto ekspresi paling sayang kamu sekarang juga'),
  ('sweet', 'Tuliskan 3 hal yang kamu syukuri tentang hubungan kita dan kirim'),
  ('sweet', 'Kirim voice note ceritain kenangan favorit kamu bareng aku'),

  -- 🟡 FUNNY (6)
  ('funny', 'Foto ekspresi paling jelek kamu sekarang dan kirim, no filter!'),
  ('funny', 'Rekam video 10 detik kamu lagi nyanyi lagu anak-anak'),
  ('funny', 'Foto posisi duduk/tiduran kamu sekarang tanpa diubah dulu, kirim'),
  ('funny', 'Ceritakan lelucon paling garing yang kamu tahu lewat voice note'),
  ('funny', 'Foto muka kamu lagi melotot sekuat-kuatnya, kirim sekarang'),
  ('funny', 'Rekam 15 detik kamu lagi niru gaya presenter berita, kirim'),

  -- 🟠 BOLD (6)
  ('bold', 'Screenshot notifikasi terakhir di HP kamu dan kirim (yang bisa kamu share)'),
  ('bold', 'Foto isi kulkas atau laci meja kamu sekarang'),
  ('bold', 'Ceritakan satu rahasia kecil yang belum pernah kamu ceritain ke aku'),
  ('bold', 'Rekam suara kamu lagi bilang nama aku 5 kali dengan nada dan gaya berbeda'),
  ('bold', 'Foto kondisi kamar/meja kamu sekarang apa adanya, kirim'),
  ('bold', 'Screenshot playlist lagu yang lagi kamu dengerin dan kirim'),

  -- 🔴 CHALLENGE (6)
  ('challenge', 'Nyanyi 1 bait lagu favorit kita via voice note sekarang, harus sampai selesai'),
  ('challenge', 'Rekam video 30 detik kamu ngomong hal yang paling kamu suka dari hubungan kita'),
  ('challenge', 'Tulis puisi 4 baris tentang aku, lalu bacain via voice note'),
  ('challenge', 'Telepon aku sekarang dan bilang 3 hal yang bikin kamu jatuh cinta padaku'),
  ('challenge', 'Gambar wajah aku (semampunya), foto hasilnya, dan kirim'),
  ('challenge', 'Rekam video kamu lagi joget 20 detik dengan lagu favorit kita, kirim');
