-- ============================================================
-- LDR-Connect Seed — Voucher dummy untuk testing (hapus/ubah sebelum dipakai di production)
-- Jalankan setelah semua file schema (00–11).
-- ============================================================

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
