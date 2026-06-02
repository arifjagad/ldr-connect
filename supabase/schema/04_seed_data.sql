-- ============================================================
-- LDR-Connect: Schema Fresh — 04 Seed Data
-- Jalankan SETELAH 03_functions.sql
--
-- Berisi: game_settings, coin_packages, minigame_configs,
--         dare_questions, vouchers (dummy)
-- Pertanyaan game lanjutkan dengan:
--   05_seed_tod_questions.sql   (ToD questions)
--   06_seed_snake_questions.sql (Snake questions)
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

-- ============================================================
-- SEED: game_minigame_configs (migration 016 + 019)
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
   '{"description": "Tentukan apakah pernyataan berikut benar atau salah!", "question_count": 5}'::jsonb)
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

-- ============================================================
-- SEED: vouchers — dummy data untuk testing
-- Hapus dulu sebelum re-seed:
--   TRUNCATE public.voucher_redemptions, public.vouchers RESTART IDENTITY CASCADE;
-- ============================================================
INSERT INTO public.vouchers
  (code, type, coin_value, discount_type, discount_value, max_discount, min_purchase,
   max_uses, uses_remaining, valid_from, valid_until, is_active)
VALUES
  -- COIN CREDIT
  ('WELCOME10',   'coin_credit', 10,  NULL, NULL, NULL, NULL, 100, 100, NOW(), NULL, true),
  ('LOVE-EVENT',  'coin_credit', 25,  NULL, NULL, NULL, NULL,  10,  10, NOW(), NOW() + INTERVAL '30 days', true),
  ('LDR-SPECIAL', 'coin_credit', 50,  NULL, NULL, NULL, NULL,   1,   1, NOW(), NOW() + INTERVAL '7 days',  true),
  ('PREMIUM-LDR', 'coin_credit', 100, NULL, NULL, NULL, NULL,   5,   5, NOW(), NOW() + INTERVAL '14 days', true),
  ('SOON-2026',   'coin_credit', 15,  NULL, NULL, NULL, NULL,  50,  50, NOW() + INTERVAL '3 days', NOW() + INTERVAL '10 days', true),
  ('EXPIRED-OLD', 'coin_credit', 20,  NULL, NULL, NULL, NULL,  50,  50, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', true),
  ('PAUSED-VOC',  'coin_credit', 30,  NULL, NULL, NULL, NULL,  20,  20, NOW(), NULL, false),
  ('SOLD-OUT',    'coin_credit', 5,   NULL, NULL, NULL, NULL,   3,   0, NOW() - INTERVAL '5 days', NULL, true),
  -- TOPUP DISCOUNT
  ('HEMAT20',     'topup_discount', NULL, 'percentage', 20, 20000, 35000,  50, 50, NOW(), NOW() + INTERVAL '30 days', true),
  ('DISC10K',     'topup_discount', NULL, 'fixed',  10000,  NULL, 50000,   30, 30, NOW(), NOW() + INTERVAL '14 days', true),
  ('COUPLE50',    'topup_discount', NULL, 'percentage', 50, 30000, 65000,   5,  5, NOW(), NOW() + INTERVAL '7 days',  true),
  ('DISKON5K',    'topup_discount', NULL, 'fixed',   5000,  NULL,  NULL,  100,100, NOW(), NULL, true),
  ('PROMO-OFF',   'topup_discount', NULL, 'percentage', 15, 25000, 35000,  20, 20, NOW(), NOW() + INTERVAL '30 days', false),
  ('OLDPROMO',    'topup_discount', NULL, 'fixed',  15000,  NULL, 50000,  100,100, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', true)
ON CONFLICT (code) DO NOTHING;
