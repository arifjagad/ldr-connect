-- =====================================================================
-- CANCEL & AUTO-EXPIRE TOP-UP TRANSACTIONS (60 MINUTES)
-- =====================================================================
-- 1. function cancel_topup_transaction:
--    Membatalkan transaksi top-up yang masih 'pending' oleh user pemiliknya.
--    Jika ada voucher diskon yang terkait, kembalikan kuota voucher & hapus voucher_redemption.
--
-- 2. function expire_old_pending_topups:
--    Membatalkan semua transaksi top-up 'pending' yang sudah berumur > 60 menit.
--    Juga mengembalikan kuota voucher jika transaksi menggunakan voucher diskon.
-- =====================================================================

-- 1. Cancel Top-Up Transaction
CREATE OR REPLACE FUNCTION public.cancel_topup_transaction(
  p_transaction_id BIGINT,
  p_user_id        UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx         public.coin_transactions%ROWTYPE;
  v_redemption public.voucher_redemptions%ROWTYPE;
BEGIN
  -- Lock row transaksi
  SELECT * INTO v_tx
  FROM public.coin_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaksi tidak ditemukan');
  END IF;

  -- Pastikan transaksi milik user yang bersangkutan
  IF v_tx.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu tidak memiliki akses ke transaksi ini');
  END IF;

  -- Hanya transaksi 'pending' dan bertipe 'topup' yang bisa dibatalkan
  IF v_tx.type != 'topup' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya transaksi top-up yang dapat dibatalkan');
  END IF;

  IF v_tx.payment_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaksi sudah tidak dalam status menunggu pembayaran');
  END IF;

  -- Update status transaksi menjadi failed (cancelled)
  UPDATE public.coin_transactions
  SET payment_status = 'failed',
      metadata       = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cancelled_at', NOW(), 'cancelled_by', 'user'),
      updated_at     = NOW()
  WHERE id = v_tx.id;

  -- Rollback voucher diskon jika ada
  SELECT * INTO v_redemption
  FROM public.voucher_redemptions
  WHERE coin_transaction_id = v_tx.id
  FOR UPDATE;

  IF FOUND THEN
    -- Kembalikan uses_remaining voucher
    UPDATE public.vouchers
    SET uses_remaining = uses_remaining + 1
    WHERE id = v_redemption.voucher_id;

    -- Hapus record redemption agar user bisa memakai voucher lagi jika ingin
    DELETE FROM public.voucher_redemptions
    WHERE id = v_redemption.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Transaksi top up berhasil dibatalkan');
END;
$$;

-- 2. Expire Old Pending Top-Ups (> 60 minutes)
CREATE OR REPLACE FUNCTION public.expire_old_pending_topups()
RETURNS TABLE (
  expired_tx_id BIGINT,
  user_id UUID,
  voucher_restored BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx         public.coin_transactions%ROWTYPE;
  v_redemption public.voucher_redemptions%ROWTYPE;
  v_restored   BOOLEAN;
BEGIN
  FOR v_tx IN
    SELECT *
    FROM public.coin_transactions
    WHERE type = 'topup'
      AND payment_status = 'pending'
      AND created_at < (NOW() - INTERVAL '60 minutes')
    FOR UPDATE SKIP LOCKED
  LOOP
    v_restored := false;

    -- Update status jadi failed (expired)
    UPDATE public.coin_transactions
    SET payment_status = 'failed',
        metadata       = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('expired_at', NOW(), 'reason', 'auto_expired_60m'),
        updated_at     = NOW()
    WHERE id = v_tx.id;

    -- Kembalikan voucher jika ada
    SELECT * INTO v_redemption
    FROM public.voucher_redemptions
    WHERE coin_transaction_id = v_tx.id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.vouchers
      SET uses_remaining = uses_remaining + 1
      WHERE id = v_redemption.voucher_id;

      DELETE FROM public.voucher_redemptions
      WHERE id = v_redemption.id;

      v_restored := true;
    END IF;

    expired_tx_id    := v_tx.id;
    user_id          := v_tx.user_id;
    voucher_restored := v_restored;
    RETURN NEXT;
  END LOOP;
END;
$$;
