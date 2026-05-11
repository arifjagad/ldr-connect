-- 020_vouchers.sql
-- Sistem voucher coin: tabel, RLS, dan stored procedure atomic
-- PENTING: stored procedure pakai SELECT FOR UPDATE untuk mencegah race condition
-- saat banyak user meredeemkan voucher terbatas secara bersamaan.

-- =====================================================================
-- TABEL
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.vouchers (
  id             BIGSERIAL PRIMARY KEY,
  code           VARCHAR(50) UNIQUE NOT NULL,              -- kode voucher (uppercase)
  coin_value     INTEGER NOT NULL CHECK (coin_value BETWEEN 1 AND 1000),
  max_uses       INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses_remaining INTEGER NOT NULL CHECK (uses_remaining >= 0),
  valid_from     TIMESTAMPTZ DEFAULT NOW(),
  valid_until    TIMESTAMPTZ,                              -- NULL = tidak ada batas waktu
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uses_remaining_lte_max CHECK (uses_remaining <= max_uses)
);

-- Log setiap pengguna yang memakai voucher
CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id                  BIGSERIAL PRIMARY KEY,
  voucher_id          BIGINT NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id             UUID   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coin_transaction_id BIGINT REFERENCES public.coin_transactions(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (voucher_id, user_id)   -- satu user hanya boleh redeem voucher yang sama sekali
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher ON public.voucher_redemptions (voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_user    ON public.voucher_redemptions (user_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.vouchers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions  ENABLE ROW LEVEL SECURITY;

-- Hanya admin yang bisa baca/tulis vouchers via RLS
-- (API routes menggunakan service role, jadi RLS tidak berdampak di sana)
CREATE POLICY "vouchers_admin_all" ON public.vouchers
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- User hanya bisa lihat redemption mereka sendiri
CREATE POLICY "voucher_redemptions_own_select" ON public.voucher_redemptions
  FOR SELECT USING (user_id = auth.uid());

-- Admin bisa lihat semua redemption
CREATE POLICY "voucher_redemptions_admin_select" ON public.voucher_redemptions
  FOR SELECT USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- =====================================================================
-- STORED PROCEDURE: redeem_voucher
-- Atomic dengan SELECT FOR UPDATE — mencegah race condition
-- Skenario: 100 user berebut 10 slot voucher secara bersamaan
--   → FOR UPDATE mengunci baris voucher selama transaksi berlangsung
--   → Hanya satu goroutine yang berjalan pada satu waktu per baris
--   → UNIQUE(voucher_id, user_id) sebagai jaring pengaman terakhir
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
  -- Normalisasi kode
  p_code := UPPER(TRIM(p_code));

  -- Kunci baris voucher agar tidak ada proses lain yang membaca
  -- uses_remaining sebelum proses ini selesai (race condition prevention)
  SELECT * INTO v_voucher
  FROM public.vouchers
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
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

  -- Cek kuota (setelah lock, nilai ini pasti up-to-date)
  IF v_voucher.uses_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher sudah habis digunakan');
  END IF;

  -- Cek double redemption oleh user yang sama
  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = v_voucher.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  -- Kurangi sisa penggunaan
  UPDATE public.vouchers
  SET uses_remaining = uses_remaining - 1
  WHERE id = v_voucher.id;

  -- Tambah saldo wallet
  UPDATE public.wallets
  SET balance = balance + v_voucher.coin_value
  WHERE user_id = p_user_id;

  -- Catat di coin_transactions
  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, payment_reference, paid_at, metadata
  ) VALUES (
    p_user_id,
    'topup',
    v_voucher.coin_value,
    'paid',
    'VOUCHER-' || v_voucher.code,
    NOW(),
    jsonb_build_object(
      'reason',       'voucher_redemption',
      'voucher_code', v_voucher.code,
      'voucher_id',   v_voucher.id
    )
  )
  RETURNING id INTO v_tx_id;

  -- Catat redemption (UNIQUE constraint sebagai safety net terakhir)
  INSERT INTO public.voucher_redemptions (voucher_id, user_id, coin_transaction_id)
  VALUES (v_voucher.id, p_user_id, v_tx_id);

  RETURN jsonb_build_object(
    'success',    true,
    'message',    'Voucher berhasil digunakan!',
    'coin_value', v_voucher.coin_value
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Jaring pengaman: race condition yang melewati cek EXISTS di atas
    RETURN jsonb_build_object('success', false, 'message', 'Kamu sudah pernah menggunakan voucher ini');
END;
$$;
