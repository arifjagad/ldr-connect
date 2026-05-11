-- 021_discount_vouchers.sql
-- Menambahkan tipe voucher diskon ke tabel vouchers yang sudah ada.
-- Voucher sekarang punya dua jenis:
--   'coin_credit'    → user dapat coin gratis (perilaku existing redeem_voucher)
--   'topup_discount' → potongan harga saat beli paket coin (seperti voucher Shopee)

-- =====================================================================
-- ALTER TABLE: tambah kolom baru ke vouchers
-- =====================================================================

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS type          VARCHAR(20) NOT NULL DEFAULT 'coin_credit',
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(15),   -- 'percentage' | 'fixed' | NULL
  ADD COLUMN IF NOT EXISTS discount_value INTEGER,       -- % (1-100) atau IDR
  ADD COLUMN IF NOT EXISTS max_discount   INTEGER,       -- batas atas diskon dalam IDR
  ADD COLUMN IF NOT EXISTS min_purchase   INTEGER;

-- coin_value tidak relevan untuk topup_discount, jadi boleh NULL
ALTER TABLE public.vouchers ALTER COLUMN coin_value DROP NOT NULL;
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_coin_value_check;       -- minimum pembelian dalam IDR

-- Validasi konsistensi kolom
ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS voucher_type_fields_check;

ALTER TABLE public.vouchers
  ADD CONSTRAINT voucher_type_fields_check CHECK (
    (type = 'coin_credit' AND discount_type IS NULL AND discount_value IS NULL)
    OR
    (type = 'topup_discount'
      AND discount_type IN ('percentage', 'fixed')
      AND discount_value > 0
      AND (discount_type != 'percentage' OR discount_value BETWEEN 1 AND 100)
    )
  );

-- =====================================================================
-- UPDATE redeem_voucher: tolak voucher diskon (harus lewat apply_topup_discount)
-- =====================================================================

CREATE OR REPLACE FUNCTION redeem_voucher(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher   public.vouchers%ROWTYPE;
  v_tx_id     BIGINT;
BEGIN
  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_voucher FROM public.vouchers WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
  END IF;

  -- Voucher diskon tidak bisa di-redeem langsung sebagai coin
  IF v_voucher.type = 'topup_discount' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher ini hanya berlaku saat pembelian paket coin');
  END IF;

  IF NOT v_voucher.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak aktif');
  END IF;

  IF v_voucher.valid_from IS NOT NULL AND NOW() < v_voucher.valid_from THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher belum berlaku');
  END IF;

  IF v_voucher.valid_until IS NOT NULL AND NOW() > v_voucher.valid_until THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah kadaluarsa');
  END IF;

  IF v_voucher.uses_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah habis digunakan');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = v_voucher.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  UPDATE public.vouchers SET uses_remaining = uses_remaining - 1 WHERE id = v_voucher.id;
  UPDATE public.wallets SET balance = balance + v_voucher.coin_value WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, payment_reference, paid_at, metadata
  ) VALUES (
    p_user_id, 'topup', v_voucher.coin_value, 'paid',
    'VOUCHER-' || v_voucher.code, NOW(),
    jsonb_build_object('reason', 'voucher_redemption', 'voucher_code', v_voucher.code, 'voucher_id', v_voucher.id)
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.voucher_redemptions (voucher_id, user_id, coin_transaction_id)
  VALUES (v_voucher.id, p_user_id, v_tx_id);

  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Voucher berhasil digunakan!',
    'coin_value', v_voucher.coin_value
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
END;
$$;

-- =====================================================================
-- FUNCTION: validate_topup_voucher (read-only, untuk preview di UI)
-- Tidak ada SELECT FOR UPDATE, tidak ada side effect.
-- Hanya menghitung estimasi diskon untuk ditampilkan sebelum checkout.
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_topup_voucher(
  p_user_id        UUID,
  p_code           TEXT,
  p_purchase_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher  public.vouchers%ROWTYPE;
  v_discount INTEGER;
BEGIN
  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_voucher FROM public.vouchers WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
  END IF;

  IF v_voucher.type != 'topup_discount' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher ini bukan voucher diskon pembelian');
  END IF;

  IF NOT v_voucher.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak aktif');
  END IF;

  IF v_voucher.valid_from IS NOT NULL AND NOW() < v_voucher.valid_from THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher belum berlaku');
  END IF;

  IF v_voucher.valid_until IS NOT NULL AND NOW() > v_voucher.valid_until THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah kadaluarsa');
  END IF;

  IF v_voucher.uses_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah habis digunakan');
  END IF;

  IF v_voucher.min_purchase IS NOT NULL AND p_purchase_amount < v_voucher.min_purchase THEN
    RETURN jsonb_build_object(
      'success', false,
      'message',
        'Minimum pembelian Rp' || to_char(v_voucher.min_purchase, 'FM999,999,999') ||
        ' untuk voucher ini'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = v_voucher.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  -- Hitung estimasi diskon
  IF v_voucher.discount_type = 'percentage' THEN
    v_discount := FLOOR(p_purchase_amount * v_voucher.discount_value / 100.0);
    IF v_voucher.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_voucher.max_discount);
    END IF;
  ELSE -- 'fixed'
    v_discount := LEAST(v_voucher.discount_value, p_purchase_amount);
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'message',        'Voucher valid',
    'discount_amount', v_discount,
    'final_amount',   p_purchase_amount - v_discount,
    'discount_type',  v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'max_discount',   v_voucher.max_discount,
    'uses_remaining', v_voucher.uses_remaining
  );
END;
$$;

-- =====================================================================
-- FUNCTION: apply_topup_discount (atomic, dengan SELECT FOR UPDATE)
-- Dipanggil saat checkout topup, SEBELUM Midtrans payment dibuat.
-- Mencegah race condition: banyak user berebut slot voucher diskon.
-- =====================================================================

CREATE OR REPLACE FUNCTION apply_topup_discount(
  p_user_id         UUID,
  p_code            TEXT,
  p_purchase_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher      public.vouchers%ROWTYPE;
  v_discount     INTEGER;
  v_redemption_id BIGINT;
BEGIN
  p_code := UPPER(TRIM(p_code));

  -- Lock baris voucher: hanya satu transaksi yang bisa proses sekaligus
  SELECT * INTO v_voucher FROM public.vouchers WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
  END IF;

  IF v_voucher.type != 'topup_discount' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher ini bukan voucher diskon pembelian');
  END IF;

  IF NOT v_voucher.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak aktif');
  END IF;

  IF v_voucher.valid_from IS NOT NULL AND NOW() < v_voucher.valid_from THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher belum berlaku');
  END IF;

  IF v_voucher.valid_until IS NOT NULL AND NOW() > v_voucher.valid_until THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah kadaluarsa');
  END IF;

  -- Cek kuota (nilai pasti up-to-date karena row sudah di-lock)
  IF v_voucher.uses_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah habis digunakan');
  END IF;

  IF v_voucher.min_purchase IS NOT NULL AND p_purchase_amount < v_voucher.min_purchase THEN
    RETURN jsonb_build_object(
      'success', false,
      'message',
        'Minimum pembelian Rp' || to_char(v_voucher.min_purchase, 'FM999,999,999') ||
        ' untuk voucher ini'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = v_voucher.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  -- Hitung diskon final
  IF v_voucher.discount_type = 'percentage' THEN
    v_discount := FLOOR(p_purchase_amount * v_voucher.discount_value / 100.0);
    IF v_voucher.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_voucher.max_discount);
    END IF;
  ELSE -- 'fixed'
    v_discount := LEAST(v_voucher.discount_value, p_purchase_amount);
  END IF;

  -- Kurangi kuota
  UPDATE public.vouchers SET uses_remaining = uses_remaining - 1 WHERE id = v_voucher.id;

  -- Catat redemption (coin_transaction_id di-update setelah coin_transaction dibuat)
  INSERT INTO public.voucher_redemptions (voucher_id, user_id)
  VALUES (v_voucher.id, p_user_id)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',         true,
    'message',         'Voucher diskon berhasil diterapkan',
    'discount_amount', v_discount,
    'final_amount',    p_purchase_amount - v_discount,
    'redemption_id',   v_redemption_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
END;
$$;
