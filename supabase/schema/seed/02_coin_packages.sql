-- ============================================================
-- LDR-Connect Seed — Paket topup coin
-- Jalankan setelah semua file schema (00–11).
-- ============================================================

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
