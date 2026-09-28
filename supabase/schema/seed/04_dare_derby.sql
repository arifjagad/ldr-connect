-- ============================================================
-- LDR-Connect Seed — Mini-game Dare Derby + pool dare
-- Jalankan setelah semua file schema (00–11).
-- ============================================================

-- ============================================================
-- SEED: game_minigame_configs (migration 016 + 019 + 030)
-- ============================================================
INSERT INTO public.game_minigame_configs (game_id, name, category, duration, is_active, config)
VALUES
  ('tap_timing',    'Perfect Tap',   'reflex', 10, true,
   '{"description": "Tap tepat saat bar berada di zona merah!", "zones": {"red": 10, "yellow": 40, "green": 70}}'::jsonb),
  ('reaction_btn',  'React!',        'reflex',  8, true,
   '{"description": "Tap tombol secepat mungkin saat muncul!", "max_delay_ms": 3000}'::jsonb),
  ('memory_seq',    'Ingat Urutan',  'brain',  30, true,
   '{"description": "Ingat dan ulangi urutan warna!", "sequence_length": 5, "colors": ["red","blue","green","yellow"]}'::jsonb),
  ('number_order',  'Urutan Angka',  'brain',  20, true,
   '{"description": "Tap angka 1 sampai 9 secara berurutan dari grid acak!", "total_numbers": 9}'::jsonb),
  ('word_scramble', 'Acak Kata',     'skill',  20, true,
   '{"description": "Susun huruf acak menjadi kata yang benar!", "word_count": 1}'::jsonb),
  ('true_false',    'Benar/Salah',   'skill',  15, true,
   '{"description": "Tentukan apakah pernyataan berikut benar atau salah!", "question_count": 5}'::jsonb),
  ('math_dash',     'Math Dash',     'brain',  20, true,
   '{"description": "Jawab soal matematika secepat mungkin!", "questions_per_round": 5}'::jsonb),
  ('flag_guess',    'Tebak Bendera', 'brain',  20, true,
   '{"description": "Tebak negara dari emoji bendera!", "questions_per_round": 5}'::jsonb),
  ('fastest_typer', 'Ketik Cepat',   'skill',  30, true,
   '{"description": "Ketik kata yang muncul secepat mungkin!", "words_per_round": 5}'::jsonb),
  ('color_match',   'Color Match',   'skill',  20, true,
   '{"description": "Pilih warna teks, bukan kata yang tertulis! (Stroop effect)", "rounds_per_game": 6}'::jsonb)
ON CONFLICT (game_id) DO UPDATE
  SET name = EXCLUDED.name, category = EXCLUDED.category,
      duration = EXCLUDED.duration, config = EXCLUDED.config,
      is_active = EXCLUDED.is_active;

-- ============================================================
-- SEED: game_dare_questions (migration 016)
-- ============================================================
INSERT INTO public.game_dare_questions (category, content) VALUES
  -- SWEET (6)
  ('sweet', 'Kirim voice note bilang "I love you" dengan cara paling manis yang kamu bisa'),
  ('sweet', 'Screenshot wallpaper HP kamu sekarang dan kirim ke aku'),
  ('sweet', 'Ceritakan satu hal yang kamu suka dari aku hari ini lewat chat'),
  ('sweet', 'Kirim foto ekspresi paling sayang kamu sekarang juga'),
  ('sweet', 'Tuliskan 3 hal yang kamu syukuri tentang hubungan kita dan kirim'),
  ('sweet', 'Kirim voice note ceritain kenangan favorit kamu bareng aku'),
  -- FUNNY (6)
  ('funny', 'Foto ekspresi paling jelek kamu sekarang dan kirim, no filter!'),
  ('funny', 'Rekam video 10 detik kamu lagi nyanyi lagu anak-anak'),
  ('funny', 'Foto posisi duduk/tiduran kamu sekarang tanpa diubah dulu, kirim'),
  ('funny', 'Ceritakan lelucon paling garing yang kamu tahu lewat voice note'),
  ('funny', 'Foto muka kamu lagi melotot sekuat-kuatnya, kirim sekarang'),
  ('funny', 'Rekam 15 detik kamu lagi niru gaya presenter berita, kirim'),
  -- BOLD (6)
  ('bold', 'Screenshot notifikasi terakhir di HP kamu dan kirim (yang bisa kamu share)'),
  ('bold', 'Foto isi kulkas atau laci meja kamu sekarang'),
  ('bold', 'Ceritakan satu rahasia kecil yang belum pernah kamu ceritain ke aku'),
  ('bold', 'Rekam suara kamu lagi bilang nama aku 5 kali dengan nada dan gaya berbeda'),
  ('bold', 'Foto kondisi kamar/meja kamu sekarang apa adanya, kirim'),
  ('bold', 'Screenshot playlist lagu yang lagi kamu dengerin dan kirim'),
  -- CHALLENGE (6)
  ('challenge', 'Nyanyi 1 bait lagu favorit kita via voice note sekarang, harus sampai selesai'),
  ('challenge', 'Rekam video 30 detik kamu ngomong hal yang paling kamu suka dari hubungan kita'),
  ('challenge', 'Tulis puisi 4 baris tentang aku, lalu bacain via voice note'),
  ('challenge', 'Telepon aku sekarang dan bilang 3 hal yang bikin kamu jatuh cinta padaku'),
  ('challenge', 'Gambar wajah aku (semampunya), foto hasilnya, dan kirim'),
  ('challenge', 'Rekam video kamu lagi joget 20 detik dengan lagu favorit kita, kirim')
ON CONFLICT DO NOTHING;
