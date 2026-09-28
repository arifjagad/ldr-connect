-- ============================================================
-- LDR-Connect Schema — 02 Coin, pembayaran & voucher
-- Jalankan SETELAH 01_accounts_couple.sql
--
-- wallets, coin_packages, coin_transactions, vouchers, voucher_redemptions,
-- RPC topup/verifikasi Midtrans/voucher, realtime saldo.
-- ============================================================

-- ============================================================
-- TABLE: wallets
-- ============================================================
CREATE TABLE public.wallets (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance    INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);

COMMENT ON COLUMN public.wallets.balance IS 'Saldo coin, bukan rupiah. Integer >= 0.';

-- ============================================================
-- TABLE: coin_packages
-- ============================================================
CREATE TABLE public.coin_packages (
  id          BIGSERIAL    PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  coin_amount INTEGER      NOT NULL CHECK (coin_amount > 0),
  price       INTEGER      NOT NULL CHECK (price > 0),  -- dalam IDR
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_packages_is_active ON public.coin_packages(is_active);

COMMENT ON COLUMN public.coin_packages.price IS 'Harga dalam Rupiah (IDR)';

-- ============================================================
-- TABLE: coin_transactions
-- ============================================================
CREATE TABLE public.coin_transactions (
  id                BIGSERIAL    PRIMARY KEY,
  user_id           UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coin_package_id   BIGINT       REFERENCES public.coin_packages(id) ON DELETE SET NULL,
  type              VARCHAR(10)  NOT NULL CHECK (type IN ('topup', 'deduct')),
  amount            INTEGER      NOT NULL CHECK (amount > 0),
  payment_status    VARCHAR(10)  NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_reference VARCHAR(255) UNIQUE,  -- Midtrans order ID
  metadata          JSONB,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_tx_user_id   ON public.coin_transactions(user_id);
CREATE INDEX idx_coin_tx_reference ON public.coin_transactions(payment_reference);
CREATE INDEX idx_coin_tx_status    ON public.coin_transactions(payment_status);
CREATE INDEX idx_coin_tx_type      ON public.coin_transactions(type);
CREATE INDEX idx_coin_tx_created   ON public.coin_transactions(created_at DESC);

COMMENT ON COLUMN public.coin_transactions.type             IS 'topup = beli coin | deduct = pakai coin';
COMMENT ON COLUMN public.coin_transactions.payment_status   IS 'pending | paid | failed';
COMMENT ON COLUMN public.coin_transactions.payment_reference IS 'Midtrans order ID';

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_coin_packages_updated_at
  BEFORE UPDATE ON public.coin_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_coin_transactions_updated_at
  BEFORE UPDATE ON public.coin_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: vouchers (migration 020+021)
-- Voucher coin gratis (coin_credit) atau diskon topup (topup_discount)
-- ============================================================
CREATE TABLE public.vouchers (
  id             BIGSERIAL    PRIMARY KEY,
  code           VARCHAR(50)  UNIQUE NOT NULL,
  type           VARCHAR(20)  NOT NULL DEFAULT 'coin_credit'
                   CHECK (type IN ('coin_credit', 'topup_discount')),
  coin_value     INTEGER,     -- NULL untuk topup_discount; 1–1000 untuk coin_credit
  discount_type  VARCHAR(15), -- 'percentage' | 'fixed' | NULL
  discount_value INTEGER,     -- % (1-100) atau IDR; NULL untuk coin_credit
  max_discount   INTEGER,     -- batas atas diskon dalam IDR; NULL = tidak dibatasi
  min_purchase   INTEGER,     -- minimum pembelian dalam IDR; NULL = tidak ada syarat
  max_uses       INTEGER      NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses_remaining INTEGER      NOT NULL CHECK (uses_remaining >= 0),
  valid_from     TIMESTAMPTZ  DEFAULT NOW(),
  valid_until    TIMESTAMPTZ,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_by     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uses_remaining_lte_max CHECK (uses_remaining <= max_uses),
  CONSTRAINT voucher_type_fields_check CHECK (
    (type = 'coin_credit'
      AND discount_type IS NULL
      AND discount_value IS NULL)
    OR
    (type = 'topup_discount'
      AND discount_type IN ('percentage', 'fixed')
      AND discount_value > 0
      AND (discount_type != 'percentage' OR discount_value BETWEEN 1 AND 100)
    )
  )
);

CREATE INDEX idx_vouchers_code    ON public.vouchers(UPPER(code));
CREATE INDEX idx_vouchers_active  ON public.vouchers(is_active);
CREATE INDEX idx_vouchers_type    ON public.vouchers(type);

COMMENT ON COLUMN public.vouchers.type           IS 'coin_credit = dapat coin gratis | topup_discount = diskon harga topup';
COMMENT ON COLUMN public.vouchers.coin_value     IS 'Jumlah coin yang diberikan (hanya coin_credit, 1–1000)';
COMMENT ON COLUMN public.vouchers.discount_type  IS 'percentage atau fixed IDR (hanya topup_discount)';
COMMENT ON COLUMN public.vouchers.uses_remaining IS 'Sisa slot; dilindungi race condition via SELECT FOR UPDATE';

-- ============================================================
-- TABLE: voucher_redemptions (migration 020)
-- Log setiap penggunaan voucher per user
-- UNIQUE(voucher_id, user_id) — safety net untuk double-use
-- ============================================================
CREATE TABLE public.voucher_redemptions (
  id                  BIGSERIAL   PRIMARY KEY,
  voucher_id          BIGINT      NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coin_transaction_id BIGINT      REFERENCES public.coin_transactions(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (voucher_id, user_id)
);

CREATE INDEX idx_vr_voucher_id ON public.voucher_redemptions(voucher_id);
CREATE INDEX idx_vr_user_id    ON public.voucher_redemptions(user_id);

ALTER TABLE public.wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions    ENABLE ROW LEVEL SECURITY;

-- INSERT dihandle oleh trigger handle_new_auth_user() (SECURITY DEFINER)

-- ============================================================
-- wallets
-- ============================================================
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "wallets_select_partner"
  ON public.wallets FOR SELECT
  USING (user_id = public.get_my_partner_id());

-- UPDATE & INSERT hanya via service role

-- ============================================================
-- coin_packages
-- ============================================================
CREATE POLICY "coin_packages_select_active"
  ON public.coin_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- coin_transactions
-- ============================================================
CREATE POLICY "coin_transactions_select_own"
  ON public.coin_transactions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- vouchers (migration 020+021)
-- ============================================================

-- Semua authenticated bisa baca voucher aktif (untuk cek kode)
CREATE POLICY "vouchers_select_active"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin bisa baca semua (termasuk nonaktif)
CREATE POLICY "vouchers_select_admin"
  ON public.vouchers FOR SELECT
  USING (public.is_admin());

-- Admin bisa insert, update, delete
CREATE POLICY "vouchers_write_admin"
  ON public.vouchers FOR ALL
  USING (public.is_admin());

-- ============================================================
-- voucher_redemptions (migration 020)
-- ============================================================

-- User bisa baca redemption milik sendiri
CREATE POLICY "vr_select_own"
  ON public.voucher_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE hanya via service role (redeem_voucher + apply_topup_discount RPC)
-- Admin bisa baca semua
CREATE POLICY "vr_select_admin"
  ON public.voucher_redemptions FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- FUNCTION: update_payment_status
-- Update status pembayaran Midtrans + kredit saldo wallet
-- Dipanggil dari: POST /api/coin/webhook & /api/coin/verify
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_payment_reference VARCHAR(255),
  p_new_status        VARCHAR(10),   -- 'paid' | 'failed'
  p_paid_at           TIMESTAMPTZ    DEFAULT NULL,
  p_metadata          JSONB          DEFAULT NULL
)
RETURNS public.coin_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx public.coin_transactions;
BEGIN
  SELECT * INTO v_tx
  FROM public.coin_transactions
  WHERE payment_reference = p_payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND';
  END IF;

  IF v_tx.payment_status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_PAID';
  END IF;

  IF v_tx.payment_status = 'failed' AND p_new_status = 'paid' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION'
      USING DETAIL = 'Tidak bisa mengubah status dari failed ke paid';
  END IF;

  UPDATE public.coin_transactions
  SET payment_status = p_new_status,
      paid_at        = CASE WHEN p_new_status = 'paid' THEN COALESCE(p_paid_at, now()) ELSE paid_at END,
      metadata       = CASE WHEN p_metadata IS NOT NULL THEN metadata || p_metadata ELSE metadata END,
      updated_at     = now()
  WHERE id = v_tx.id
  RETURNING * INTO v_tx;

  IF p_new_status = 'paid' THEN
    UPDATE public.wallets
    SET balance = balance + v_tx.amount, updated_at = now()
    WHERE user_id = v_tx.user_id;
  END IF;

  RETURN v_tx;
END;
$$;

-- ============================================================
-- FUNCTION: get_pending_topup_count
-- Hitung topup pending dalam 15 menit terakhir (rate limiting topup)
-- Dipanggil dari: POST /api/coin/topup
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pending_topup_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.coin_transactions
  WHERE user_id        = p_user_id
    AND type           = 'topup'
    AND payment_status = 'pending'
    AND created_at     >= now() - INTERVAL '15 minutes';

  RETURN v_count;
END;
$$;

-- ============================================================
-- FUNCTION: redeem_voucher (latest: migration 029_fix_voucher_redemption_ref)
-- Redeem voucher coin_credit. payment_reference unik per user & waktu —
-- versi lama memakai 'VOUCHER-' || code statis sehingga user kedua selalu
-- ditolak oleh UNIQUE(payment_reference).
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_voucher(p_user_id UUID, p_code TEXT)
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

-- ============================================================
-- FUNCTION: apply_topup_discount (migration 021)
-- Atomic apply voucher diskon saat checkout. FOR UPDATE mencegah
-- race condition banyak user berebut slot voucher terbatas.
-- Menyimpan redemption dengan coin_transaction_id NULL dulu
-- (diupdate setelah coin_transaction dibuat di API route).
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_topup_discount(
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
  v_voucher       public.vouchers%ROWTYPE;
  v_discount      INTEGER;
  v_redemption_id BIGINT;
BEGIN
  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_voucher FROM public.vouchers WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
  END IF;
  IF v_voucher.type != 'topup_discount' THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Voucher ini bukan voucher diskon pembelian');
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
    RETURN jsonb_build_object('success', false, 'message',
      'Minimum pembelian Rp' || to_char(v_voucher.min_purchase, 'FM999,999,999') ||
      ' untuk voucher ini');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = v_voucher.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  IF v_voucher.discount_type = 'percentage' THEN
    v_discount := FLOOR(p_purchase_amount * v_voucher.discount_value / 100.0);
    IF v_voucher.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_voucher.max_discount);
    END IF;
  ELSE
    v_discount := LEAST(v_voucher.discount_value, p_purchase_amount);
  END IF;

  UPDATE public.vouchers SET uses_remaining = uses_remaining - 1 WHERE id = v_voucher.id;

  INSERT INTO public.voucher_redemptions (voucher_id, user_id)
  VALUES (v_voucher.id, p_user_id)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true, 'message', 'Voucher diskon berhasil diterapkan',
    'discount_amount', v_discount,
    'final_amount',    p_purchase_amount - v_discount,
    'redemption_id',   v_redemption_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Kamu sudah pernah menggunakan voucher ini');
END;
$$;

-- ============================================================
-- FUNCTION: create_pending_topup (migration 035)
-- Atomic: apply voucher diskon + insert coin_transactions + link
-- voucher_redemptions dalam SATU transaksi implisit. Menggantikan pola
-- 2-langkah (apply_topup_discount lalu insert manual dari API route) yang
-- rawan voucher hangus permanen jika insert coin_transactions gagal di
-- tengah jalan (tidak ada baris tx untuk dikaitkan balik saat rollback).
-- Dipanggil dari: POST /api/coin/topup
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

  v_final_price := GREATEST(p_package_price - v_discount, 1000);

  v_metadata := CASE WHEN v_discount > 0 THEN
    jsonb_build_object(
      'voucher_code',    v_code,
      'discount_amount', v_discount,
      'original_price',  p_package_price,
      'final_price',     v_final_price
    )
  ELSE NULL END;

  INSERT INTO public.coin_transactions (
    user_id, coin_package_id, type, amount, payment_status, payment_reference, metadata
  )
  VALUES (
    p_user_id, p_coin_package_id, 'topup', p_package_coin_amount, 'pending', p_payment_reference, v_metadata
  )
  RETURNING * INTO v_tx;

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
    RETURN jsonb_build_object('success', false,
      'message', 'Gagal membuat transaksi — silakan coba lagi');
END;
$$;

-- ============================================================
-- FUNCTION: cancel_topup_transaction (migration 031)
-- Membatalkan transaksi top-up yang masih 'pending' oleh user pemiliknya.
-- Jika ada voucher diskon yang terkait, kembalikan kuota voucher & hapus voucher_redemption.
-- Dipanggil dari: POST /api/coin/cancel-topup
-- ============================================================
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

    -- Hapus record redemption agar user bisa memakai voucher lagi
    DELETE FROM public.voucher_redemptions
    WHERE id = v_redemption.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Transaksi top up berhasil dibatalkan');
END;
$$;

-- ============================================================
-- FUNCTION: expire_old_pending_topups (migration 031)
-- Membatalkan semua transaksi top-up 'pending' yang sudah berumur > 60 menit.
-- Mengembalikan kuota voucher jika transaksi menggunakan voucher diskon.
-- ============================================================
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

-- ============================================================
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.update_payment_status(VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pending_topup_count(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_voucher(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_topup_discount(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_pending_topup(UUID, BIGINT, INTEGER, INTEGER, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_topup_transaction(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_pending_topups() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- REALTIME: saldo & riwayat transaksi (migration 032)
-- Header navbar & halaman coin subscribe ke perubahan wallets/coin_transactions.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_transactions;
