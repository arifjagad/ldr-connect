-- =====================================================================
-- FIX BUG REDEEM VOUCHER: UNIQUE CONSTRAINT ON payment_reference
-- =====================================================================
-- Bug: Tabel coin_transactions memiliki constraint UNIQUE pada payment_reference.
-- Pada function redeem_voucher lama, payment_reference diisi 'VOUCHER-' || v_voucher.code (statis).
-- Ketika user ke-2 mencoba redeem voucher yang sama, INSERT ke coin_transactions
-- melempar unique_violation karena payment_reference sudah ada dari user ke-1.
-- Di EXCEPTION handler, error unique_violation tersebut ditangkap dan mengembalikan pesan:
-- "Kamu sudah pernah menggunakan voucher ini".
--
-- Solusi: Gunakan payment_reference yang unik per transaksi (misal: 'VOUCHER-' || v_voucher.code || '-' || p_user_id || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT).
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
  v_ref       TEXT;
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

  -- Buat payment_reference unik per user & waktu agar tidak bentrok dengan UNIQUE(payment_reference)
  v_ref := 'VOUCHER-' || v_voucher.code || '-' || SUBSTRING(p_user_id::text, 1, 8) || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;

  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, payment_reference, paid_at, metadata
  ) VALUES (
    p_user_id, 'topup', v_voucher.coin_value, 'paid',
    v_ref, NOW(),
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
