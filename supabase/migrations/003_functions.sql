-- ============================================================
-- LDR-Connect: Migration 003 — Stored Functions (Business Logic)
-- Jalankan SETELAH 002_rls_policies.sql
-- ============================================================
-- Semua function ini SECURITY DEFINER = berjalan dengan hak
-- pemilik function (postgres), bukan hak user yang memanggil.
-- Dipanggil dari Next.js API Routes via supabase.rpc('nama_function', {...})
-- menggunakan SERVICE ROLE KEY untuk bypass RLS.
-- ============================================================

-- ============================================================
-- FUNCTION: get_couple_id
-- Helper: hitung couple_id dari satu user_id
-- Convention: selalu LEAST(user_id, partner_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_couple_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN LEAST(p_user_id, v_partner_id);
END;
$$;

-- ============================================================
-- FUNCTION: link_couple
-- Hubungkan dua user sebagai pasangan (atomic)
-- Dipanggil dari: POST /api/couple/link
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_couple(
  p_user_id    UUID,
  p_couple_code VARCHAR(10)
)
RETURNS TABLE (
  user_id     UUID,
  partner_id  UUID,
  couple_code VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id     UUID;
  v_user_status    VARCHAR(10);
  v_partner_status VARCHAR(10);
BEGIN
  -- Cari partner berdasarkan couple_code
  -- (tidak boleh link ke diri sendiri)
  SELECT u.id, u.status
  INTO v_partner_id, v_partner_status
  FROM public.users u
  WHERE u.couple_code = p_couple_code
    AND u.id != p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE'
      USING DETAIL = 'Couple code tidak ditemukan atau kamu mencoba link ke diri sendiri';
  END IF;

  -- Cek status user sendiri
  SELECT status INTO v_user_status
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_status = 'linked' THEN
    RAISE EXCEPTION 'ALREADY_LINKED'
      USING DETAIL = 'Kamu sudah terhubung dengan pasangan';
  END IF;

  IF v_partner_status = 'linked' THEN
    RAISE EXCEPTION 'PARTNER_ALREADY_LINKED'
      USING DETAIL = 'Kode ini sudah dipakai oleh orang lain';
  END IF;

  -- Link keduanya (bidirectional, atomic dalam satu transaksi)
  UPDATE public.users
  SET partner_id = v_partner_id,
      status     = 'linked',
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.users
  SET partner_id = p_user_id,
      status     = 'linked',
      updated_at = now()
  WHERE id = v_partner_id;

  -- Return info couple yang baru dibentuk
  RETURN QUERY
  SELECT p_user_id, v_partner_id, p_couple_code;
END;
$$;

-- ============================================================
-- FUNCTION: unlink_couple
-- Putuskan hubungan pasangan (atomic)
-- Dipanggil dari: POST /api/couple/unlink
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlink_couple(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NOT_LINKED'
      USING DETAIL = 'Kamu tidak sedang terhubung dengan siapapun';
  END IF;

  -- Putus keduanya sekaligus
  UPDATE public.users
  SET partner_id = NULL,
      status     = 'single',
      updated_at = now()
  WHERE id IN (p_user_id, v_partner_id);
END;
$$;

-- ============================================================
-- FUNCTION: create_game_session
-- Buat sesi game + potong coin (atomic)
-- Dipanggil dari: POST /api/game/tod/session/create
--
-- Flow:
-- 1. Validasi partner ada
-- 2. Hitung couple_id
-- 3. Cek tidak ada sesi aktif
-- 4. Cek saldo cukup (SELECT FOR UPDATE → lock wallet)
-- 5. Deduct coin dari wallet
-- 6. Catat coin_transaction type=deduct
-- 7. Buat game_session
-- 8. Return session yang baru dibuat
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_game_session(
  p_host_user_id  UUID,
  p_session_code  VARCHAR(12),
  p_game_type     VARCHAR(20),
  p_questions     JSONB,
  p_coin_cost     INTEGER,
  p_expires_at    TIMESTAMPTZ,
  p_board_config  JSONB DEFAULT '{}'::jsonb,
  p_game_state    JSONB DEFAULT '{}'::jsonb
)
RETURNS public.game_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id    UUID;
  v_couple_id     UUID;
  v_wallet_balance INTEGER;
  v_session       public.game_sessions;
BEGIN
  -- 1. Ambil partner_id
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_host_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NO_PARTNER'
      USING DETAIL = 'Kamu belum terhubung dengan pasangan';
  END IF;

  -- 2. Hitung couple_id
  v_couple_id := LEAST(p_host_user_id, v_partner_id);

  -- 3. Cek sesi aktif
  IF EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE couple_id = v_couple_id
      AND status IN ('waiting', 'playing')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SESSION'
      USING DETAIL = 'Pasangan kamu sudah memiliki sesi yang sedang berjalan';
  END IF;

  -- 4. Cek + lock wallet (FOR UPDATE mencegah race condition)
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_host_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET'
      USING DETAIL = 'Wallet tidak ditemukan';
  END IF;

  IF v_wallet_balance < p_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS'
      USING DETAIL = format('Saldo coin tidak cukup. Butuh %s coin, punya %s coin.', p_coin_cost, v_wallet_balance);
  END IF;

  -- 5. Deduct coin
  UPDATE public.wallets
  SET balance    = balance - p_coin_cost,
      updated_at = now()
  WHERE user_id = p_host_user_id;

  -- 6. Catat transaksi deduct
  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, metadata
  ) VALUES (
    p_host_user_id,
    'deduct',
    p_coin_cost,
    'paid',
    jsonb_build_object(
      'reason',       'game_session_created',
      'game_type',    p_game_type,
      'session_code', p_session_code
    )
  );

  -- 7. Buat sesi game
  INSERT INTO public.game_sessions (
    couple_id, host_user_id, session_code, game_type,
    status, questions, board_config, game_state,
    coin_deducted, expires_at
  ) VALUES (
    v_couple_id, p_host_user_id, p_session_code, p_game_type,
    'waiting', p_questions, p_board_config, p_game_state,
    p_coin_cost, p_expires_at
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- ============================================================
-- FUNCTION: join_game_session
-- Partner join sesi yang sudah dibuat host
-- Dipanggil dari: POST /api/game/tod/session/join
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_game_session(
  p_partner_user_id UUID,
  p_session_code    VARCHAR(12)
)
RETURNS public.game_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session            public.game_sessions;
  v_coin_cost          INTEGER;
  v_wallet_balance     INTEGER;
  v_expires_in_minutes INTEGER;
BEGIN
  -- Ambil + lock sesi
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  -- Validasi status
  IF v_session.status != 'waiting' THEN
    RAISE EXCEPTION 'SESSION_NOT_WAITING'
      USING DETAIL = 'Sesi tidak dalam status menunggu';
  END IF;

  -- Validasi partner tidak bisa join sesi sendiri
  IF v_session.host_user_id = p_partner_user_id THEN
    RAISE EXCEPTION 'CANNOT_JOIN_OWN_SESSION'
      USING DETAIL = 'Kamu tidak bisa join sesi milikmu sendiri';
  END IF;

  -- Cek apakah sudah expired
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_session.id;

    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Sesi sudah expired';
  END IF;

  -- Ambil coin_cost + expires_in_minutes dari game_settings
  SELECT coin_cost, expires_in_minutes
  INTO v_coin_cost, v_expires_in_minutes
  FROM public.game_settings
  WHERE game_type = v_session.game_type;

  v_coin_cost          := COALESCE(v_coin_cost, 1);
  v_expires_in_minutes := COALESCE(v_expires_in_minutes, 10);

  -- Cek + lock wallet partner
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_partner_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET'
      USING DETAIL = 'Wallet tidak ditemukan';
  END IF;

  IF v_wallet_balance < v_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS'
      USING DETAIL = format('Saldo coin tidak cukup. Butuh %s coin, punya %s coin.', v_coin_cost, v_wallet_balance);
  END IF;

  -- Deduct coin dari partner
  UPDATE public.wallets
  SET balance    = balance - v_coin_cost,
      updated_at = now()
  WHERE user_id = p_partner_user_id;

  -- Catat transaksi deduct partner
  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, metadata
  ) VALUES (
    p_partner_user_id,
    'deduct',
    v_coin_cost,
    'paid',
    jsonb_build_object(
      'reason',       'game_session_joined',
      'game_type',    v_session.game_type,
      'session_code', p_session_code
    )
  );

  -- Update ke playing + set expires_at baru (game timer mulai dari sini)
  UPDATE public.game_sessions
  SET status            = 'playing',
      partner_user_id   = p_partner_user_id,
      partner_joined_at = now(),
      expires_at        = now() + (v_expires_in_minutes || ' minutes')::INTERVAL,
      updated_at        = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- ============================================================
-- FUNCTION: answer_tod_question
-- Tandai pertanyaan selesai + ambil pertanyaan berikutnya
-- Dipanggil dari: POST /api/game/tod/session/{code}/done
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_tod_question(
  p_user_id      UUID,
  p_session_code VARCHAR(12),
  p_question_order INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session     public.game_sessions;
  v_questions   JSONB;
  v_next        JSONB;
  v_all_done    BOOLEAN;
BEGIN
  -- Ambil + lock sesi
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_PLAYING';
  END IF;

  -- Validasi user adalah bagian dari sesi
  IF v_session.host_user_id != p_user_id AND v_session.partner_user_id != p_user_id THEN
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  -- Update pertanyaan yang selesai
  v_questions := (
    SELECT jsonb_agg(
      CASE
        WHEN (q->>'order')::int = p_question_order
        THEN q || jsonb_build_object(
          'is_completed', true,
          'answered_by', p_user_id::text
        )
        ELSE q
      END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  -- Cari pertanyaan berikutnya (is_completed = false)
  SELECT q INTO v_next
  FROM jsonb_array_elements(v_questions) q
  WHERE (q->>'is_completed')::boolean = false
  ORDER BY (q->>'order')::int
  LIMIT 1;

  -- Cek apakah semua selesai
  v_all_done := (v_next IS NULL);

  -- Update sesi
  UPDATE public.game_sessions
  SET questions  = v_questions,
      status     = CASE WHEN v_all_done THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE id = v_session.id;

  -- Return hasil
  RETURN jsonb_build_object(
    'completed_question', (
      SELECT q FROM jsonb_array_elements(v_questions) q
      WHERE (q->>'order')::int = p_question_order
    ),
    'next_question', v_next,
    'is_finished',   v_all_done
  );
END;
$$;

-- ============================================================
-- FUNCTION: refund_expired_session
-- Refund coin untuk sesi yang expired (partner tidak join)
-- Dipanggil dari: API route atau cron job
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_expired_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.game_sessions;
BEGIN
  -- Ambil + lock sesi
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- Hanya refund jika masih 'waiting'
  IF v_session.status != 'waiting' THEN
    RAISE EXCEPTION 'NOT_REFUNDABLE'
      USING DETAIL = 'Sesi bukan dalam status waiting, tidak bisa direfund';
  END IF;

  -- Cegah double refund
  IF v_session.coin_refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_REFUNDED'
      USING DETAIL = 'Coin sudah pernah direfund';
  END IF;

  -- Kembalikan coin ke host
  UPDATE public.wallets
  SET balance    = balance + v_session.coin_deducted,
      updated_at = now()
  WHERE user_id = v_session.host_user_id;

  -- Catat transaksi refund
  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, metadata
  ) VALUES (
    v_session.host_user_id,
    'topup',
    v_session.coin_deducted,
    'paid',
    jsonb_build_object(
      'reason',       'session_expired_refund',
      'session_code', v_session.session_code,
      'session_id',   v_session.id
    )
  );

  -- Update status sesi
  UPDATE public.game_sessions
  SET status           = 'expired',
      coin_refunded_at = now(),
      updated_at       = now()
  WHERE id = p_session_id;
END;
$$;

-- ============================================================
-- FUNCTION: expire_waiting_sessions
-- Cek + expire semua sesi yang sudah lewat expires_at
-- Dipanggil dari: cron job atau API route (setiap menit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_waiting_sessions()
RETURNS TABLE (expired_session_id BIGINT, refunded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  FOR v_session IN
    SELECT id FROM public.game_sessions
    WHERE status = 'waiting'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED  -- skip locked rows (concurrency safe)
  LOOP
    BEGIN
      PERFORM public.refund_expired_session(v_session.id);
      expired_session_id := v_session.id;
      refunded := true;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Log error tapi lanjut ke sesi berikutnya
      expired_session_id := v_session.id;
      refunded := false;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: update_payment_status
-- Update status pembayaran + tambah saldo setelah Midtrans webhook
-- Dipanggil dari: POST /api/coin/webhook (service role)
--
-- Flow:
-- 1. Cari transaksi by payment_reference
-- 2. Validasi belum paid (cegah double credit)
-- 3. Update coin_transactions.payment_status
-- 4. Jika paid → increment wallets.balance
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
  v_tx   public.coin_transactions;
BEGIN
  -- Ambil + lock transaksi
  SELECT * INTO v_tx
  FROM public.coin_transactions
  WHERE payment_reference = p_payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'
      USING DETAIL = 'Transaksi dengan reference ini tidak ditemukan';
  END IF;

  -- Cegah transisi dari paid ke apapun (no downgrade)
  IF v_tx.payment_status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_PAID'
      USING DETAIL = 'Transaksi sudah berstatus paid, tidak bisa diubah';
  END IF;

  -- Cegah transisi dari failed ke paid (fraud prevention)
  IF v_tx.payment_status = 'failed' AND p_new_status = 'paid' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION'
      USING DETAIL = 'Tidak bisa mengubah status dari failed ke paid';
  END IF;

  -- Update status transaksi
  UPDATE public.coin_transactions
  SET payment_status = p_new_status,
      paid_at        = CASE WHEN p_new_status = 'paid' THEN COALESCE(p_paid_at, now()) ELSE paid_at END,
      metadata       = CASE WHEN p_metadata IS NOT NULL THEN metadata || p_metadata ELSE metadata END,
      updated_at     = now()
  WHERE id = v_tx.id
  RETURNING * INTO v_tx;

  -- Jika paid → tambah saldo wallet
  IF p_new_status = 'paid' THEN
    UPDATE public.wallets
    SET balance    = balance + v_tx.amount,
        updated_at = now()
    WHERE user_id = v_tx.user_id;
  END IF;

  RETURN v_tx;
END;
$$;

-- ============================================================
-- FUNCTION: get_pending_topup_count
-- Cek berapa banyak topup pending dalam 15 menit terakhir
-- Untuk rate limiting: max 3 pending per 15 menit
-- Dipanggil dari: POST /api/coin/topup (sebelum buat transaksi baru)
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
  WHERE user_id       = p_user_id
    AND type          = 'topup'
    AND payment_status = 'pending'
    AND created_at    >= now() - INTERVAL '15 minutes';

  RETURN v_count;
END;
$$;

-- ============================================================
-- FUNCTION: get_active_session_for_couple
-- Ambil sesi aktif (waiting/playing) untuk pasangan
-- Dipanggil dari: GET /api/game/tod/session (check before create)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_session_for_couple(p_user_id UUID)
RETURNS public.game_sessions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id UUID;
  v_session   public.game_sessions;
BEGIN
  v_couple_id := public.get_couple_id(p_user_id);

  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE couple_id = v_couple_id
    AND status IN ('waiting', 'playing')
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session;
END;
$$;

-- ============================================================
-- CATATAN: create_snake_session, join_snake_session, dan
-- get_active_snake_session_for_couple DIHAPUS.
-- Snake & Ladder sekarang pakai game_sessions (game_type='snake_ladder')
-- dan create_game_session yang sudah diupdate di atas.
-- ============================================================
-- (placeholder agar tidak ada fungsi orphan)
-- ============================================================
-- FUNCTION: create_snake_session (DEPRECATED - dihapus di 006)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_snake_session(
  p_host_user_id  UUID,
  p_session_code  VARCHAR(12),
  p_board_config  JSONB,
  p_coin_cost     INTEGER,
  p_expires_at    TIMESTAMPTZ
)
RETURNS public.game_snake_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id     UUID;
  v_couple_id      UUID;
  v_wallet_balance INTEGER;
  v_session        public.game_snake_sessions;
BEGIN
  -- Ambil partner_id, pastikan sudah linked
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_host_user_id AND status = 'linked';

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NO_PARTNER'
      USING DETAIL = 'Kamu belum terhubung dengan pasangan';
  END IF;

  -- Hitung couple_id (selalu LEAST)
  v_couple_id := LEAST(p_host_user_id, v_partner_id);

  -- Cek tidak ada sesi snake aktif
  IF EXISTS (
    SELECT 1 FROM public.game_snake_sessions
    WHERE couple_id = v_couple_id
      AND status IN ('waiting', 'playing')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SESSION'
      USING DETAIL = 'Pasangan kamu sudah memiliki sesi Ular Tangga yang sedang berjalan';
  END IF;

  -- Cek + lock wallet
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_host_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET'
      USING DETAIL = 'Wallet tidak ditemukan';
  END IF;

  IF v_wallet_balance < p_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS'
      USING DETAIL = format('Saldo coin tidak cukup. Butuh %s coin, punya %s coin.', p_coin_cost, v_wallet_balance);
  END IF;

  -- Deduct coin
  UPDATE public.wallets
  SET balance    = balance - p_coin_cost,
      updated_at = now()
  WHERE user_id = p_host_user_id;

  -- Catat transaksi deduct
  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, metadata
  ) VALUES (
    p_host_user_id,
    'deduct',
    p_coin_cost,
    'paid',
    jsonb_build_object(
      'reason',       'snake_session_created',
      'game_type',    'snake_ladder',
      'session_code', p_session_code
    )
  );

  -- Buat sesi dengan initial game_state
  INSERT INTO public.game_snake_sessions (
    session_code,
    couple_id,
    host_user_id,
    partner_user_id,
    status,
    board_config,
    game_state,
    coin_deducted,
    expires_at
  ) VALUES (
    p_session_code,
    v_couple_id,
    p_host_user_id,
    NULL,
    'waiting',
    p_board_config,
    jsonb_build_object(
      'host_position',     0,
      'partner_position',  0,
      'current_turn',      'host',
      'pending_challenge', NULL,
      'last_roll',         NULL,
      'winner',            NULL
    ),
    p_coin_cost,
    p_expires_at
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- ============================================================
-- FUNCTION: join_snake_session
-- Partner bergabung ke sesi Ular Tangga yang sudah dibuat host
-- Dipanggil dari: POST /api/game/snake/session/join
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_snake_session(
  p_partner_user_id UUID,
  p_session_code    VARCHAR(12),
  p_expires_at      TIMESTAMPTZ
)
RETURNS public.game_snake_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.game_snake_sessions;
BEGIN
  -- Update sesi: set partner + ubah status ke playing
  UPDATE public.game_snake_sessions
  SET
    partner_user_id   = p_partner_user_id,
    status            = 'playing',
    partner_joined_at = now(),
    expires_at        = p_expires_at,
    updated_at        = now()
  WHERE session_code  = p_session_code
    AND status        = 'waiting'
    AND host_user_id != p_partner_user_id  -- tidak bisa join sesi sendiri
  RETURNING * INTO v_session;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan, sudah penuh, atau kode salah';
  END IF;

  RETURN v_session;
END;
$$;

-- ============================================================
-- FUNCTION: get_active_snake_session_for_couple
-- Ambil sesi Ular Tangga aktif (waiting/playing) untuk pasangan
-- Dipanggil dari: GET /api/game/snake/session/active
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_snake_session_for_couple(p_user_id UUID)
RETURNS public.game_snake_sessions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_couple_id  UUID;
  v_session    public.game_snake_sessions;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_couple_id := LEAST(p_user_id, v_partner_id);

  SELECT * INTO v_session
  FROM public.game_snake_sessions
  WHERE couple_id = v_couple_id
    AND status IN ('waiting', 'playing')
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session;
END;
$$;
