-- ============================================================
-- LDR-Connect: Migration 035 — Atomic Topup Creation
-- ============================================================
-- Masalah yang diperbaiki:
--   Sebelumnya, proses buat topup di app/api/coin/topup/route.ts melakukan
--   2 panggilan terpisah: (1) RPC apply_topup_discount (decrement kuota
--   voucher + insert voucher_redemptions), lalu (2) INSERT coin_transactions
--   dari Next.js. Jika langkah (2) gagal (error DB, koneksi putus, dll),
--   kuota voucher yang sudah didecrement di langkah (1) TIDAK PERNAH
--   di-rollback — karena tidak ada baris coin_transactions untuk dikaitkan,
--   RPC cancel_topup_transaction/expire_old_pending_topups (yang mencari
--   redemption via coin_transaction_id) tidak bisa menemukan apapun untuk
--   direstore. Voucher user hangus permanen tanpa jejak.
--
-- Solusi:
--   Satukan apply-discount + insert coin_transactions + link redemption
--   dalam SATU fungsi PL/pgSQL (create_pending_topup). Karena semua statement
--   di dalam satu pemanggilan function berjalan dalam transaksi implisit yang
--   sama, jika ADA LANGKAH APAPUN yang gagal (exception), SELURUH efek
--   (termasuk decrement uses_remaining voucher) otomatis di-rollback oleh
--   Postgres — tidak ada window kegagalan lagi.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_pending_topup(
  p_user_id              UUID,
  p_coin_package_id      BIGINT,
  p_package_price        INTEGER,
  p_package_coin_amount  INTEGER,
  p_payment_reference    VARCHAR(255),
  p_voucher_code         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher       public.vouchers%ROWTYPE;
  v_discount      INTEGER := 0;
  v_redemption_id BIGINT;
  v_tx            public.coin_transactions;
  v_final_price   INTEGER;
  v_metadata      JSONB;
  v_code          TEXT;
BEGIN
  -- ── Validasi & apply voucher diskon (logic sama seperti apply_topup_discount,
  --    tapi di-inline di sini supaya satu transaksi dengan insert tx di bawah) ──
  IF p_voucher_code IS NOT NULL AND TRIM(p_voucher_code) != '' THEN
    v_code := UPPER(TRIM(p_voucher_code));

    SELECT * INTO v_voucher FROM public.vouchers WHERE code = v_code FOR UPDATE;

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
    IF v_voucher.min_purchase IS NOT NULL AND p_package_price < v_voucher.min_purchase THEN
      RETURN jsonb_build_object('success', false, 'message',
        'Minimum pembelian Rp' || to_char(v_voucher.min_purchase, 'FM999,999,999') ||
        ' untuk voucher ini');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.voucher_redemptions
      WHERE voucher_id = v_voucher.id AND user_id = p_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
    END IF;

    IF v_voucher.discount_type = 'percentage' THEN
      v_discount := FLOOR(p_package_price * v_voucher.discount_value / 100.0);
      IF v_voucher.max_discount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_voucher.max_discount);
      END IF;
    ELSE
      v_discount := LEAST(v_voucher.discount_value, p_package_price);
    END IF;

    UPDATE public.vouchers SET uses_remaining = uses_remaining - 1 WHERE id = v_voucher.id;
  END IF;

  v_final_price := GREATEST(p_package_price - v_discount, 1000); -- minimum Rp1.000 (limit Midtrans)

  v_metadata := CASE WHEN v_discount > 0 THEN
    jsonb_build_object(
      'voucher_code',    v_code,
      'discount_amount', v_discount,
      'original_price',  p_package_price,
      'final_price',     v_final_price
    )
  ELSE NULL END;

  -- ── Insert coin_transactions (pending) — jika gagal, exception akan
  --    rollback juga decrement voucher di atas (satu transaksi implisit). ──
  INSERT INTO public.coin_transactions (
    user_id, coin_package_id, type, amount, payment_status, payment_reference, metadata
  )
  VALUES (
    p_user_id, p_coin_package_id, 'topup', p_package_coin_amount, 'pending', p_payment_reference, v_metadata
  )
  RETURNING * INTO v_tx;

  -- ── Link voucher_redemptions ke transaksi yang baru dibuat, dalam
  --    transaksi yang SAMA (bukan UPDATE terpisah setelah insert seperti
  --    sebelumnya) ──
  IF v_voucher.id IS NOT NULL THEN
    INSERT INTO public.voucher_redemptions (voucher_id, user_id, coin_transaction_id)
    VALUES (v_voucher.id, p_user_id, v_tx.id)
    RETURNING id INTO v_redemption_id;
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'transaction',     to_jsonb(v_tx),
    'discount_amount', v_discount,
    'final_price',     v_final_price,
    'redemption_id',   v_redemption_id
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Bisa terjadi jika payment_reference duplikat (nyaris mustahil, CSPRNG)
    -- atau race voucher_redemptions unique(voucher_id, user_id).
    RETURN jsonb_build_object('success', false,
      'message', 'Gagal membuat transaksi — silakan coba lagi');
END;
$$;

COMMENT ON FUNCTION public.create_pending_topup IS
  'Atomic: apply voucher diskon + insert coin_transactions + link voucher_redemptions dalam satu transaksi. Menggantikan pola 2-langkah (apply_topup_discount lalu insert manual dari API route) yang rawan voucher hangus jika insert gagal di tengah jalan.';
