-- 020b_vouchers_seed.sql
-- Dummy data voucher untuk testing. Jalankan setelah 021_discount_vouchers.sql.
-- Mencakup dua tipe: coin_credit (dapat coin gratis) dan topup_discount (diskon harga topup).

INSERT INTO public.vouchers
  (code, type, coin_value, discount_type, discount_value, max_discount, min_purchase,
   max_uses, uses_remaining, valid_from, valid_until, is_active)
VALUES

  -- ──────────────────────────────────────────────
  -- COIN CREDIT — user langsung dapat coin gratis
  -- ──────────────────────────────────────────────

  -- Voucher welcome: banyak slot, tidak ada batas waktu
  ('WELCOME10',   'coin_credit', 10,  NULL, NULL, NULL, NULL,
    100, 100, NOW(), NULL, true),

  -- Voucher event terbatas: hanya 10 slot (test race condition)
  ('LOVE-EVENT',  'coin_credit', 25,  NULL, NULL, NULL, NULL,
    10, 10, NOW(), NOW() + INTERVAL '30 days', true),

  -- Voucher satu kali pakai per orang (global max_uses=1)
  ('LDR-SPECIAL', 'coin_credit', 50,  NULL, NULL, NULL, NULL,
    1, 1, NOW(), NOW() + INTERVAL '7 days', true),

  -- Voucher premium: 5 slot, nilai besar
  ('PREMIUM-LDR', 'coin_credit', 100, NULL, NULL, NULL, NULL,
    5, 5, NOW(), NOW() + INTERVAL '14 days', true),

  -- Voucher belum berlaku (future)
  ('SOON-2026',   'coin_credit', 15,  NULL, NULL, NULL, NULL,
    50, 50, NOW() + INTERVAL '3 days', NOW() + INTERVAL '10 days', true),

  -- Voucher sudah kadaluarsa (test expired handling)
  ('EXPIRED-OLD', 'coin_credit', 20,  NULL, NULL, NULL, NULL,
    50, 50, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', true),

  -- Voucher nonaktif (admin matikan)
  ('PAUSED-VOC',  'coin_credit', 30,  NULL, NULL, NULL, NULL,
    20, 20, NOW(), NULL, false),

  -- Voucher sudah habis digunakan (uses_remaining = 0)
  ('SOLD-OUT',    'coin_credit', 5,   NULL, NULL, NULL, NULL,
    3, 0, NOW() - INTERVAL '5 days', NULL, true),

  -- ──────────────────────────────────────────────
  -- TOPUP DISCOUNT — potongan harga saat beli paket coin
  -- ──────────────────────────────────────────────

  -- Diskon 20% maks Rp20.000, min beli Rp35.000 (Popular Pack ke atas)
  -- Cocok ditest dengan paket Popular (Rp35k → hemat Rp7k) atau Value (Rp65k → hemat Rp13k)
  ('HEMAT20',     'topup_discount', NULL, 'percentage', 20, 20000, 35000,
    50, 50, NOW(), NOW() + INTERVAL '30 days', true),

  -- Diskon flat Rp10.000, min beli Rp50.000 (Value Pack ke atas)
  -- Test: Starter/Popular = tidak memenuhi syarat; Value = hemat Rp10k
  ('DISC10K',     'topup_discount', NULL, 'fixed', 10000, NULL, 50000,
    30, 30, NOW(), NOW() + INTERVAL '14 days', true),

  -- Diskon gede 50% maks Rp30.000, min beli Rp65.000 (Value Pack)
  -- Hanya 5 slot — test race condition diskon
  ('COUPLE50',    'topup_discount', NULL, 'percentage', 50, 30000, 65000,
    5, 5, NOW(), NOW() + INTERVAL '7 days', true),

  -- Diskon flat Rp5.000 tanpa syarat minimum — berlaku semua paket
  ('DISKON5K',    'topup_discount', NULL, 'fixed', 5000, NULL, NULL,
    100, 100, NOW(), NULL, true),

  -- Diskon event nonaktif (admin belum aktifkan)
  ('PROMO-OFF',   'topup_discount', NULL, 'percentage', 15, 25000, 35000,
    20, 20, NOW(), NOW() + INTERVAL '30 days', false),

  -- Diskon sudah kadaluarsa
  ('OLDPROMO',    'topup_discount', NULL, 'fixed', 15000, NULL, 50000,
    100, 100, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', true)

ON CONFLICT (code) DO NOTHING;
