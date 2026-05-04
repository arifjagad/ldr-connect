-- ============================================================
-- LDR-Connect: Schema Fresh — 05 Seed Pertanyaan Truth or Dare
-- Jalankan SETELAH 04_seed_data.sql
--
-- Semua pertanyaan: couple_id = NULL (global, dari admin)
-- source = 'admin', is_active = true
-- Kategori: romantis, kenangan, mimpi, tantangan, seru
-- ============================================================

INSERT INTO public.game_tod_questions
  (couple_id, type, category, question, source, is_active)
VALUES

-- ============================================================
-- KATEGORI: romantis — TRUTH
-- ============================================================
(NULL, 'truth', 'romantis', 'Apa hal pertama yang kamu perhatikan dari aku saat pertama kali ketemu?', 'admin', true),
(NULL, 'truth', 'romantis', 'Momen apa yang paling kamu rindukan saat kita sedang jauh?', 'admin', true),
(NULL, 'truth', 'romantis', 'Kapan kamu sadar kalau kamu menyukai aku?', 'admin', true),
(NULL, 'truth', 'romantis', 'Apa yang kamu pikirkan saat membaca pesanku untuk pertama kali hari ini?', 'admin', true),
(NULL, 'truth', 'romantis', 'Apa kebiasaanku yang paling kamu sukai?', 'admin', true),
(NULL, 'truth', 'romantis', 'Kalau kita bisa bertemu sekarang, hal pertama apa yang ingin kamu lakukan?', 'admin', true),
(NULL, 'truth', 'romantis', 'Apa kata-kata yang pernah aku ucapkan yang selalu kamu ingat?', 'admin', true),
(NULL, 'truth', 'romantis', 'Seberapa sering kamu kepikiran aku dalam sehari?', 'admin', true),
(NULL, 'truth', 'romantis', 'Apa hal terkecil yang bisa aku lakukan yang membuatmu merasa dicintai?', 'admin', true),
(NULL, 'truth', 'romantis', 'Apa bagian dari tubuhku yang paling kamu suka?', 'admin', true),

-- ============================================================
-- KATEGORI: romantis — DARE
-- ============================================================
(NULL, 'dare', 'romantis', 'Kirimkan foto selfie terbaikmu sekarang!', 'admin', true),
(NULL, 'dare', 'romantis', 'Tulis 3 hal yang kamu sukai dari aku dalam satu pesan.', 'admin', true),
(NULL, 'dare', 'romantis', 'Rekam video kecil 10 detik sambil bilang "aku sayang kamu" dengan cara paling lucu.', 'admin', true),
(NULL, 'dare', 'romantis', 'Kirimkan screenshot kontak kamu di HP dan tunjukkan aku ada di mana.', 'admin', true),
(NULL, 'dare', 'romantis', 'Ceritakan mimpi terindah tentang kita dalam 3 kalimat sekarang.', 'admin', true),
(NULL, 'dare', 'romantis', 'Kirimkan lagu yang paling mengingatkanmu tentang aku sekarang.', 'admin', true),

-- ============================================================
-- KATEGORI: kenangan — TRUTH
-- ============================================================
(NULL, 'truth', 'kenangan', 'Apa momen paling lucu yang pernah terjadi di antara kita?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Apa pertengkaran terkecil yang pernah kita alami?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Apa kenangan pertama kita yang paling kamu ingat sampai sekarang?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Ada momen bersama kita yang kamu sesali tidak mengabadikannya?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Apa ulang tahun atau hari spesial kita yang paling berkesan?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Pertama kali aku bilang sayang, apa yang kamu rasakan?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Apa hal paling gila yang pernah kita lakukan bareng?', 'admin', true),
(NULL, 'truth', 'kenangan', 'Pernah tidak kamu pura-pura marah padahal sebenernya tidak?', 'admin', true),

-- ============================================================
-- KATEGORI: kenangan — DARE
-- ============================================================
(NULL, 'dare', 'kenangan', 'Ceritakan ulang bagaimana perasaanmu saat pertama kali kita kenalan.', 'admin', true),
(NULL, 'dare', 'kenangan', 'Temukan dan kirimkan foto kita yang paling lama yang ada di HPmu.', 'admin', true),
(NULL, 'dare', 'kenangan', 'Ceritakan momen paling memalukan yang kamu ingat tentang kita.', 'admin', true),

-- ============================================================
-- KATEGORI: mimpi — TRUTH
-- ============================================================
(NULL, 'truth', 'mimpi', 'Di mana impian kita untuk tinggal bersama suatu hari nanti?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Apa satu hal yang paling ingin kamu lakukan bersamaku setelah kita akhirnya bisa bertemu?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Kalau kita bisa pergi liburan ke mana saja, kamu mau ke mana?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Bagaimana kamu membayangkan hari pertama kita tinggal bersama?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Apa hal pertama yang ingin kamu masak untukku?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Kamu bayangkan kita menikah di mana dan seperti apa?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Apa hobi yang ingin kamu lakukan bersama kita setiap minggu?', 'admin', true),
(NULL, 'truth', 'mimpi', 'Kalau kita punya hewan peliharaan, kamu mau pelihara apa?', 'admin', true),

-- ============================================================
-- KATEGORI: mimpi — DARE
-- ============================================================
(NULL, 'dare', 'mimpi', 'Gambar (walaupun jelek) rumah impian kita dan kirimkan fotonya!', 'admin', true),
(NULL, 'dare', 'mimpi', 'Tulis 5 hal yang ingin kita lakukan bersama dalam bucket list kita.', 'admin', true),
(NULL, 'dare', 'mimpi', 'Cari satu foto destinasi liburan yang paling ingin kamu kunjungi bersama aku dan kirimkan.', 'admin', true),

-- ============================================================
-- KATEGORI: tantangan — TRUTH
-- ============================================================
(NULL, 'truth', 'tantangan', 'Apa hal terberat dari menjalani LDR bersamamu?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Pernah tidak kamu merasa ingin menyerah? Apa yang membuatmu bertahan?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Apa yang paling susah kamu terima dari jarak kita?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Bagaimana cara kamu menghadapi hari-hari ketika kamu sangat merindukan aku?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Pernah merasa insecure dalam hubungan kita? Tentang apa?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Apa yang paling kamu khawatirkan tentang masa depan hubungan kita?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Adakah sesuatu yang ingin kamu ubah dari cara kita berkomunikasi?', 'admin', true),
(NULL, 'truth', 'tantangan', 'Apakah ada hal yang kamu takut untuk diceritakan padaku?', 'admin', true),

-- ============================================================
-- KATEGORI: tantangan — DARE
-- ============================================================
(NULL, 'dare', 'tantangan', 'Tulis satu hal yang selama ini belum pernah kamu ungkapkan dan kirimkan padaku sekarang.', 'admin', true),
(NULL, 'dare', 'tantangan', 'Hubungi aku dengan panggilan video selama minimal 1 menit sekarang jika memungkinkan.', 'admin', true),
(NULL, 'dare', 'tantangan', 'Ceritakan satu kekhawatiranmu tentang kita yang belum pernah kamu bilang.', 'admin', true),

-- ============================================================
-- KATEGORI: seru — TRUTH
-- ============================================================
(NULL, 'truth', 'seru', 'Kalau aku adalah makanan, kira-kira aku jenis makanan apa?', 'admin', true),
(NULL, 'truth', 'seru', 'Apa aplikasi yang paling sering kamu buka setelah WhatsApp/chat kita?', 'admin', true),
(NULL, 'truth', 'seru', 'Kalau kita swap kehidupan selama sehari, apa hal pertama yang kamu lakukan?', 'admin', true),
(NULL, 'truth', 'seru', 'Film atau series apa yang paling ingin kamu tonton bareng aku?', 'admin', true),
(NULL, 'truth', 'seru', 'Siapa artis atau seleb yang menurut kamu paling mirip denganku?', 'admin', true),
(NULL, 'truth', 'seru', 'Kalau kita bisa masuk ke dunia game atau film, kamu mau masuk ke dunia mana?', 'admin', true),
(NULL, 'truth', 'seru', 'Apa makanan yang ingin banget kamu makan bareng aku suatu hari?', 'admin', true),
(NULL, 'truth', 'seru', 'Kalau kamu harus mendeskripsikan aku dengan 3 emoji, apa pilihanmu?', 'admin', true),
(NULL, 'truth', 'seru', 'Lagu apa yang selalu kamu skip tapi aku suka?', 'admin', true),
(NULL, 'truth', 'seru', 'Siapa yang lebih lebay di antara kita berdua?', 'admin', true),

-- ============================================================
-- KATEGORI: seru — DARE
-- ============================================================
(NULL, 'dare', 'seru', 'Kirimkan meme yang menurutmu paling menggambarkan hubungan kita.', 'admin', true),
(NULL, 'dare', 'seru', 'Nyanyikan chorus lagu favoritmu dan kirimkan voice note-nya sekarang!', 'admin', true),
(NULL, 'dare', 'seru', 'Deskripsikan aku menggunakan 5 karakter anime atau film tanpa menyebut nama.', 'admin', true),
(NULL, 'dare', 'seru', 'Foto makanan terakhir yang kamu makan dan kirimkan sekarang.', 'admin', true),
(NULL, 'dare', 'seru', 'Tebak apa yang aku lakukan sekarang dalam 3 pilihan dan aku akan jawab jujur.', 'admin', true),
(NULL, 'dare', 'seru', 'Kirimkan voice note dengan suara paling aneh yang bisa kamu buat.', 'admin', true);
