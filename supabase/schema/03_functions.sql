-- ============================================================
-- LDR-Connect: Schema Fresh — 03 Stored Functions
-- Jalankan SETELAH 02_rls.sql
--
-- Berisi STATE AKHIR semua RPC functions yang aktif digunakan (s/d migration 013).
-- Sudah tidak menyertakan fungsi deprecated (create_snake_session,
-- join_snake_session, get_active_snake_session_for_couple).
--
-- Ringkasan perubahan per migration:
--   010: + check_and_record_rate_limit (rate limiting berbasis DB)
--   011: roll_snake_dice + confirm_snake_challenge → tambah cek expires_at
--   012: create_game_session → auto-expire + cek expires_at > NOW()
--   013: get_active_session_for_couple → + param p_game_type + filter expires_at
--   028: + check_login_rate_limit (two-tier brute-force protection per email)
--        + clear_login_rate_limit (reset on successful login)
--
-- Semua function: SECURITY DEFINER (berjalan sebagai postgres,
-- bukan sebagai user yang memanggil).
-- ============================================================

-- ============================================================
-- FUNCTION: get_couple_id
-- Hitung couple_id dari user_id (selalu LEAST(user_id, partner_id))
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
  p_user_id     UUID,
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
  SELECT u.id, u.status
  INTO v_partner_id, v_partner_status
  FROM public.users u
  WHERE u.couple_code = p_couple_code
    AND u.id != p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE'
      USING DETAIL = 'Couple code tidak ditemukan atau kamu mencoba link ke diri sendiri';
  END IF;

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

  UPDATE public.users
  SET partner_id = v_partner_id, status = 'linked', updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.users
  SET partner_id = p_user_id, status = 'linked', updated_at = now()
  WHERE id = v_partner_id;

  RETURN QUERY SELECT p_user_id, v_partner_id, p_couple_code;
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

  UPDATE public.users
  SET partner_id = NULL, status = 'single', updated_at = now()
  WHERE id IN (p_user_id, v_partner_id);
END;
$$;

-- ============================================================
-- FUNCTION: create_game_session
-- Buat sesi game + potong coin (atomic, dengan FOR UPDATE lock)
-- Dipanggil dari: POST /api/game/tod/session/create
--                 POST /api/game/snake/session/create
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_game_session(
  p_host_user_id UUID,
  p_session_code VARCHAR(12),
  p_game_type    VARCHAR(20),
  p_questions    JSONB,
  p_coin_cost    INTEGER,
  p_expires_at   TIMESTAMPTZ,
  p_board_config JSONB DEFAULT '{}'::jsonb,
  p_game_state   JSONB DEFAULT '{}'::jsonb
)
RETURNS public.game_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id     UUID;
  v_couple_id      UUID;
  v_wallet_balance INTEGER;
  v_session        public.game_sessions;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_host_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NO_PARTNER'
      USING DETAIL = 'Kamu belum terhubung dengan pasangan';
  END IF;

  v_couple_id := LEAST(p_host_user_id, v_partner_id);

  -- Auto-expire sesi yang sudah habis waktu sebelum cek aktif
  UPDATE public.game_sessions
  SET status = 'expired', updated_at = now()
  WHERE couple_id = v_couple_id
    AND status IN ('waiting', 'playing')
    AND expires_at <= NOW();

  -- Cek apakah masih ada sesi yang benar-benar aktif (belum habis waktu)
  IF EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE couple_id = v_couple_id
      AND status IN ('waiting', 'playing')
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SESSION'
      USING DETAIL = 'Pasangan kamu sudah memiliki sesi yang sedang berjalan';
  END IF;

  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_host_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;

  IF v_wallet_balance < p_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS'
      USING DETAIL = format('Butuh %s coin, punya %s coin.', p_coin_cost, v_wallet_balance);
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_coin_cost, updated_at = now()
  WHERE user_id = p_host_user_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, payment_status, metadata)
  VALUES (
    p_host_user_id, 'deduct', p_coin_cost, 'paid',
    jsonb_build_object(
      'reason',       'game_session_created',
      'game_type',    p_game_type,
      'session_code', p_session_code
    )
  );

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
-- Partner join sesi yang sudah dibuat host (potong coin partner)
-- Dipanggil dari: POST /api/game/tod/session/join
--                 POST /api/game/snake/session/join
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
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.status != 'waiting' THEN
    RAISE EXCEPTION 'SESSION_NOT_WAITING'
      USING DETAIL = 'Sesi tidak dalam status menunggu';
  END IF;

  IF v_session.host_user_id = p_partner_user_id THEN
    RAISE EXCEPTION 'CANNOT_JOIN_OWN_SESSION'
      USING DETAIL = 'Kamu tidak bisa join sesi milikmu sendiri';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_session.id;

    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Sesi sudah expired';
  END IF;

  SELECT coin_cost, expires_in_minutes
  INTO v_coin_cost, v_expires_in_minutes
  FROM public.game_settings
  WHERE game_type = v_session.game_type;

  v_coin_cost          := COALESCE(v_coin_cost, 1);
  v_expires_in_minutes := COALESCE(v_expires_in_minutes, 10);

  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_partner_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;

  IF v_wallet_balance < v_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS'
      USING DETAIL = format('Butuh %s coin, punya %s coin.', v_coin_cost, v_wallet_balance);
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_coin_cost, updated_at = now()
  WHERE user_id = p_partner_user_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, payment_status, metadata)
  VALUES (
    p_partner_user_id, 'deduct', v_coin_cost, 'paid',
    jsonb_build_object(
      'reason',       'game_session_joined',
      'game_type',    v_session.game_type,
      'session_code', p_session_code
    )
  );

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
-- Tandai pertanyaan ToD selesai + ambil pertanyaan berikutnya
-- Dipanggil dari: POST /api/game/tod/session/{code}/next
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_tod_question(
  p_user_id        UUID,
  p_session_code   VARCHAR(12),
  p_question_order INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session   public.game_sessions;
  v_questions JSONB;
  v_next      JSONB;
  v_all_done  BOOLEAN;
BEGIN
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

  IF v_session.host_user_id != p_user_id AND v_session.partner_user_id != p_user_id THEN
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  v_questions := (
    SELECT jsonb_agg(
      CASE
        WHEN (q->>'order')::int = p_question_order
        THEN q || jsonb_build_object('is_completed', true, 'answered_by', p_user_id::text)
        ELSE q
      END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  SELECT q INTO v_next
  FROM jsonb_array_elements(v_questions) q
  WHERE (q->>'is_completed')::boolean = false
  ORDER BY (q->>'order')::int
  LIMIT 1;

  v_all_done := (v_next IS NULL);

  UPDATE public.game_sessions
  SET questions  = v_questions,
      status     = CASE WHEN v_all_done THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE id = v_session.id;

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
-- Refund coin untuk sesi expired (partner tidak join)
-- Dipanggil dari: API route atau expire_waiting_sessions()
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_expired_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.game_sessions;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.status != 'waiting' THEN
    RAISE EXCEPTION 'NOT_REFUNDABLE'
      USING DETAIL = 'Sesi bukan dalam status waiting';
  END IF;

  IF v_session.coin_refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_REFUNDED';
  END IF;

  UPDATE public.wallets
  SET balance = balance + v_session.coin_deducted, updated_at = now()
  WHERE user_id = v_session.host_user_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, payment_status, metadata)
  VALUES (
    v_session.host_user_id, 'topup', v_session.coin_deducted, 'paid',
    jsonb_build_object(
      'reason',       'session_expired_refund',
      'session_code', v_session.session_code,
      'session_id',   v_session.id
    )
  );

  UPDATE public.game_sessions
  SET status           = 'expired',
      coin_refunded_at = now(),
      updated_at       = now()
  WHERE id = p_session_id;
END;
$$;

-- ============================================================
-- FUNCTION: expire_waiting_sessions
-- Expire semua sesi waiting yang sudah lewat expires_at + refund coin
-- Dipanggil dari: cron job atau API route (setiap beberapa menit)
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
    WHERE status    = 'waiting'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.refund_expired_session(v_session.id);
      expired_session_id := v_session.id;
      refunded           := true;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      expired_session_id := v_session.id;
      refunded           := false;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

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
-- FUNCTION: get_active_session_for_couple
-- Ambil sesi aktif (waiting/playing, belum expired) untuk pasangan
-- p_game_type: opsional, filter by game type ('tod', 'snake_ladder', dll)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_session_for_couple(
  p_user_id   UUID,
  p_game_type VARCHAR DEFAULT NULL
)
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
    AND expires_at > NOW()
    AND (p_game_type IS NULL OR game_type = p_game_type)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_session;
END;
$$;

-- ============================================================
-- FUNCTION: cancel_game_session
-- Batalkan sesi + refund coin ke host (atomic, cegah double refund)
-- Dipanggil dari: POST /api/game/tod/session/[code]/cancel
--                 POST /api/game/snake/session/[code]/cancel
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_game_session(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.game_sessions;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.host_user_id != p_user_id THEN
    RAISE EXCEPTION 'NOT_HOST'
      USING DETAIL = 'Hanya host yang bisa membatalkan sesi';
  END IF;

  -- Idempotent: sudah tidak aktif → return tanpa error
  IF NOT (v_session.status = ANY(ARRAY['waiting'::varchar, 'playing'::varchar])) THEN
    RETURN;
  END IF;

  UPDATE public.game_sessions
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_session.id;

  -- Refund hanya jika: status waiting, belum direfund, ada coin yang dipotong
  IF v_session.status = 'waiting'
     AND v_session.coin_refunded_at IS NULL
     AND v_session.coin_deducted > 0
  THEN
    UPDATE public.wallets
    SET balance = balance + v_session.coin_deducted, updated_at = now()
    WHERE user_id = v_session.host_user_id;

    INSERT INTO public.coin_transactions (user_id, type, amount, payment_status, metadata)
    VALUES (
      v_session.host_user_id, 'topup', v_session.coin_deducted, 'paid',
      jsonb_build_object(
        'reason',       'session_cancelled_refund',
        'session_code', p_session_code,
        'session_id',   v_session.id
      )
    );

    UPDATE public.game_sessions
    SET coin_refunded_at = now()
    WHERE id = v_session.id;
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: roll_snake_dice
-- Lempar dadu Ular Tangga (atomic + cek expiry)
-- Dipanggil dari: POST /api/game/snake/session/[code]/roll
-- ============================================================
CREATE OR REPLACE FUNCTION public.roll_snake_dice(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session   public.game_sessions;
  v_gs        JSONB;
  v_bc        JSONB;
  v_my_role   TEXT;
  v_dice      INTEGER;
  v_current   INTEGER;
  v_landed    INTEGER;
  v_final     INTEGER;
  v_bounced   BOOLEAN;
  v_snake     JSONB;
  v_ladder    JSONB;
  v_challenge JSONB;
  v_last_roll JSONB;
  v_new_gs    JSONB;
  v_next_turn TEXT;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'snake_ladder'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  -- Cek expiry (EXP-01: auto-update status + error spesifik)
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak aktif';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN'
      USING DETAIL = 'Bukan giliranmu';
  END IF;

  IF v_gs->'pending_challenge' IS NOT NULL
     AND v_gs->'pending_challenge' != 'null'::jsonb
  THEN
    RAISE EXCEPTION 'PENDING_CHALLENGE'
      USING DETAIL = 'Selesaikan tantangan dulu';
  END IF;

  v_dice    := floor(random() * 6 + 1)::int;
  v_current := CASE WHEN v_my_role = 'host'
                    THEN (v_gs->>'host_position')::int
                    ELSE (v_gs->>'partner_position')::int
               END;

  v_landed  := v_current + v_dice;
  v_bounced := false;

  IF v_landed > 100 THEN
    v_landed  := 100 - (v_landed - 100);
    v_bounced := true;
  END IF;

  SELECT s INTO v_snake
  FROM jsonb_array_elements(v_bc->'snakes') s
  WHERE (s->>'from')::int = v_landed
  LIMIT 1;

  SELECT l INTO v_ladder
  FROM jsonb_array_elements(v_bc->'ladders') l
  WHERE (l->>'from')::int = v_landed
  LIMIT 1;

  v_final := v_landed;
  IF v_snake IS NOT NULL THEN
    v_final := (v_snake->>'to')::int;
  ELSIF v_ladder IS NOT NULL THEN
    v_final := (v_ladder->>'to')::int;
  END IF;

  v_last_roll := jsonb_build_object(
    'player',      v_my_role,
    'dice',        v_dice,
    'from',        v_current,
    'landed',      v_landed,
    'final',       v_final,
    'snake_from',  CASE WHEN v_snake  IS NOT NULL THEN (v_snake->>'from')::int  ELSE NULL END,
    'ladder_from', CASE WHEN v_ladder IS NOT NULL THEN (v_ladder->>'from')::int ELSE NULL END,
    'bounced',     v_bounced
  );

  v_new_gs := v_gs || jsonb_build_object('last_roll', v_last_roll);
  v_new_gs := v_new_gs || CASE WHEN v_my_role = 'host'
    THEN jsonb_build_object('host_position', v_final)
    ELSE jsonb_build_object('partner_position', v_final)
  END;

  IF v_final = 100 THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'winner', v_my_role, 'current_turn', v_my_role, 'pending_challenge', NULL
    );
    UPDATE public.game_sessions
    SET game_state = v_new_gs, status = 'completed', updated_at = now()
    WHERE id = v_session.id;
    RETURN v_new_gs;
  END IF;

  SELECT c INTO v_challenge
  FROM jsonb_array_elements(v_bc->'challenges') c
  WHERE (c->>'square')::int = v_final
  LIMIT 1;

  IF v_challenge IS NOT NULL THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'pending_challenge', jsonb_build_object(
        'player',    v_my_role,
        'square',    v_final,
        'type',      v_challenge->>'type',
        'question',  v_challenge->>'question',
        'category',  v_challenge->>'category',
        'roll_again', (v_dice = 6 AND NOT v_bounced)
      )
    );
  ELSIF v_dice = 6 AND NOT v_bounced THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'current_turn', v_my_role, 'pending_challenge', NULL
    );
  ELSE
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object(
      'current_turn', v_next_turn, 'pending_challenge', NULL
    );
  END IF;

  UPDATE public.game_sessions
  SET game_state = v_new_gs, updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: confirm_snake_challenge
-- Partner konfirmasi tantangan selesai (atomic + cek expiry)
-- Dipanggil dari: POST /api/game/snake/session/[code]/confirm
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_snake_challenge(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session        public.game_sessions;
  v_gs             JSONB;
  v_challenger     TEXT;
  v_challenger_uid UUID;
  v_roll_again     BOOLEAN;
  v_next_turn      TEXT;
  v_new_gs         JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'snake_ladder'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  -- Cek expiry (EXP-02)
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED'
      USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND'
      USING DETAIL = 'Sesi tidak aktif';
  END IF;

  v_gs := v_session.game_state;

  IF v_gs->'pending_challenge' IS NULL
     OR v_gs->'pending_challenge' = 'null'::jsonb
  THEN
    RAISE EXCEPTION 'NO_PENDING_CHALLENGE'
      USING DETAIL = 'Tidak ada tantangan yang perlu dikonfirmasi';
  END IF;

  v_challenger     := v_gs->'pending_challenge'->>'player';
  v_challenger_uid := CASE WHEN v_challenger = 'host'
                           THEN v_session.host_user_id
                           ELSE v_session.partner_user_id
                      END;

  IF p_user_id = v_challenger_uid THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_OWN'
      USING DETAIL = 'Kamu tidak bisa mengkonfirmasi tantanganmu sendiri';
  END IF;

  IF p_user_id != v_session.host_user_id AND p_user_id != v_session.partner_user_id THEN
    RAISE EXCEPTION 'NOT_IN_SESSION'
      USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  v_roll_again := (v_gs->'pending_challenge'->>'roll_again')::boolean;
  v_next_turn  := CASE WHEN v_roll_again THEN v_challenger
                       WHEN v_challenger = 'host' THEN 'partner'
                       ELSE 'host'
                  END;

  v_new_gs := v_gs || jsonb_build_object(
    'pending_challenge', NULL,
    'current_turn',      v_next_turn
  );

  UPDATE public.game_sessions
  SET game_state = v_new_gs, updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: check_and_record_rate_limit
-- Rate limiting per-user per-endpoint berbasis DB (migration 010)
-- Bekerja di serverless/multi-instance environment
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
  p_user_id        UUID,
  p_endpoint       TEXT,
  p_max_requests   INT,
  p_window_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Advisory lock per user+endpoint untuk mencegah race condition
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_endpoint)
  );

  -- Hapus event lama milik user ini (> 24 jam)
  DELETE FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung event dalam window
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (p_user_id, p_endpoint);

  RETURN TRUE;
END;
$$;

-- ============================================================
-- FUNCTION: check_login_rate_limit (migration 028)
-- Two-tier brute-force protection berbasis email.
-- Tier 1: 5 gagal dalam 1 menit  → return 'tier1'
-- Tier 2: 10 gagal dalam 1 jam   → return 'tier2'
-- Else: catat attempt dan return 'ok'
--
-- Menggunakan uuid_generate_v5 untuk convert email → UUID stabil
-- agar bisa disimpan di rate_limit_events (kolom user_id UUID NOT NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT
)
RETURNS TEXT  -- 'ok' | 'tier1' | 'tier2'
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
  v_endpoint        TEXT := 'auth:login';
  v_count_minute    INT;
  v_count_hour      INT;
BEGIN
  -- Buat UUID deterministik dari email (UUID v5, namespace OID)
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,  -- uuid_ns_oid
    lower(trim(p_email))
  );

  -- Advisory lock per email untuk cegah race condition
  PERFORM pg_advisory_xact_lock(hashtext(p_email));

  -- Hapus events lama (> 24 jam)
  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung kegagalan dalam 1 menit (Tier 1)
  SELECT COUNT(*) INTO v_count_minute
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_count_minute >= 5 THEN
    RETURN 'tier1';  -- blok 1 menit
  END IF;

  -- Hitung kegagalan dalam 1 jam (Tier 2)
  SELECT COUNT(*) INTO v_count_hour
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 10 THEN
    RETURN 'tier2';  -- blok 1 jam
  END IF;

  -- Catat attempt baru
  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (v_pseudo_user_id, v_endpoint);

  RETURN 'ok';
END;
$$;

-- ============================================================
-- FUNCTION: clear_login_rate_limit (migration 028)
-- Reset rate limit counter setelah login berhasil.
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
BEGIN
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,
    lower(trim(p_email))
  );

  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = 'auth:login';
END;
$$;

-- ============================================================
-- DARE DERBY FUNCTIONS (migration 015–018)
-- ============================================================

-- ============================================================
-- FUNCTION: select_dare_derby_minigames (latest: migration 017)
-- Pilih mini-game balanced random untuk sesi Dare Derby.
-- CROSS JOIN LATERAL memungkinkan repetisi jika stok per kategori
-- tidak mencukupi (e.g., hanya 1 brain game tapi butuh 2).
-- Distribusi: 5→(2R,2B,1S) / 7→(3R,2B,2S) / 10→(4R,3B,3S)
-- ============================================================
CREATE OR REPLACE FUNCTION public.select_dare_derby_minigames(p_total_rounds INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reflex_count INTEGER;
  v_brain_count  INTEGER;
  v_skill_count  INTEGER;
  v_result       JSONB;
BEGIN
  CASE p_total_rounds
    WHEN 5  THEN v_reflex_count := 2; v_brain_count := 2; v_skill_count := 1;
    WHEN 7  THEN v_reflex_count := 3; v_brain_count := 2; v_skill_count := 2;
    WHEN 10 THEN v_reflex_count := 4; v_brain_count := 3; v_skill_count := 3;
    ELSE
      RAISE EXCEPTION 'INVALID_ROUND_COUNT'
        USING DETAIL = 'Jumlah ronde harus 5, 7, atau 10';
  END CASE;

  WITH
    reflex_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_reflex_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'reflex' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    brain_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_brain_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'brain' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    skill_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_skill_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'skill' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    all_picks AS (
      SELECT game_id FROM reflex_pick
      UNION ALL SELECT game_id FROM brain_pick
      UNION ALL SELECT game_id FROM skill_pick
    )
  SELECT jsonb_agg(game_id ORDER BY random())
  INTO v_result
  FROM all_picks;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- FUNCTION: ready_up_dare_derby (migration 015)
-- Player tap "Siap!" di lobby. Ketika keduanya ready → phase 'playing'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ready_up_dare_derby(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_my_role       TEXT;
  v_new_gs        JSONB;
  v_host_ready    BOOLEAN;
  v_partner_ready BOOLEAN;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code AND game_type = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE' USING DETAIL = 'Partner belum join sesi';
  END IF;

  v_gs := v_session.game_state;

  IF v_gs->>'phase' != 'lobby' THEN
    RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Game sudah dimulai';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  v_new_gs := v_gs || jsonb_build_object(
    'ready', (v_gs->'ready') || jsonb_build_object(v_my_role, true)
  );

  v_host_ready    := COALESCE((v_new_gs->'ready'->>'host')::boolean, false);
  v_partner_ready := COALESCE((v_new_gs->'ready'->>'partner')::boolean, false);

  IF v_host_ready AND v_partner_ready THEN
    v_new_gs := v_new_gs || jsonb_build_object('phase', 'playing');
  END IF;

  UPDATE public.game_sessions SET game_state = v_new_gs, updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: submit_dare_derby_round (migration 015)
-- Submit skor mini-game. Kedua submit → hitung loser → assign dare.
-- Draw → replay. Draw pada replay → tiebreaker by time_taken.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_dare_derby_round(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_score        INTEGER,
  p_time_taken   INTEGER,
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_dare_level    TEXT;
  v_minigame_id   TEXT;
  v_host_sub      JSONB;
  v_partner_sub   JSONB;
  v_host_score    INTEGER;
  v_partner_score INTEGER;
  v_host_time     INTEGER;
  v_partner_time  INTEGER;
  v_loser         TEXT;
  v_is_replay     BOOLEAN;
  v_dare_id       BIGINT;
  v_dare_content  TEXT;
  v_dare_category TEXT;
  v_round_result  JSONB;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code AND game_type = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    IF v_session.status IN ('playing', 'waiting') THEN
      UPDATE public.game_sessions SET status = 'expired', updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE' USING DETAIL = 'Sesi tidak dalam status playing';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'playing' THEN
    RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Bukan fase mini-game saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  IF v_gs->'round_submissions'->v_my_role IS NOT NULL
     AND v_gs->'round_submissions'->v_my_role != 'null'::jsonb THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED' USING DETAIL = 'Kamu sudah mengirim skor untuk ronde ini';
  END IF;

  v_new_gs := v_gs || jsonb_build_object(
    'round_submissions',
    (v_gs->'round_submissions') || jsonb_build_object(
      v_my_role,
      jsonb_build_object('score', p_score, 'time_taken', p_time_taken,
                         'submitted_at', now()::text, 'metadata', p_metadata)
    )
  );

  v_host_sub    := v_new_gs->'round_submissions'->'host';
  v_partner_sub := v_new_gs->'round_submissions'->'partner';

  IF v_host_sub IS NULL OR v_host_sub = 'null'::jsonb
     OR v_partner_sub IS NULL OR v_partner_sub = 'null'::jsonb THEN
    UPDATE public.game_sessions SET game_state = v_new_gs, updated_at = now()
    WHERE id = v_session.id;
    RETURN jsonb_build_object('waiting_for_partner', true, 'game_state', v_new_gs);
  END IF;

  v_host_score    := (v_host_sub->>'score')::int;
  v_partner_score := (v_partner_sub->>'score')::int;
  v_host_time     := (v_host_sub->>'time_taken')::int;
  v_partner_time  := (v_partner_sub->>'time_taken')::int;
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;
  v_dare_level    := v_bc->>'dare_level';
  v_minigame_id   := v_bc->'minigame_sequence'->>(v_current_round - 1);
  v_is_replay     := COALESCE((v_gs->>'is_replay_round')::boolean, false);

  IF v_host_score > v_partner_score THEN
    v_loser := 'partner';
  ELSIF v_partner_score > v_host_score THEN
    v_loser := 'host';
  ELSIF v_is_replay THEN
    IF v_host_time < v_partner_time THEN
      v_loser := 'partner';
    ELSIF v_partner_time < v_host_time THEN
      v_loser := 'host';
    ELSE
      v_loser := CASE WHEN random() > 0.5 THEN 'host' ELSE 'partner' END;
    END IF;
  ELSE
    v_loser := 'draw';
  END IF;

  IF v_loser != 'draw' THEN
    SELECT dq.id, dq.content, dq.category
    INTO v_dare_id, v_dare_content, v_dare_category
    FROM public.game_dare_questions dq
    WHERE dq.is_active = true
      AND CASE v_dare_level
            WHEN 'sweet_only' THEN dq.category = 'sweet'
            WHEN 'full_chaos' THEN true
            ELSE dq.category IN ('sweet', 'funny', 'bold')
          END
      AND dq.id NOT IN (
        SELECT (r->>'dare_id')::bigint
        FROM jsonb_array_elements(v_session.questions) r
        WHERE r->>'dare_id' IS NOT NULL
      )
    ORDER BY random() LIMIT 1;

    IF NOT FOUND THEN
      SELECT dq.id, dq.content, dq.category
      INTO v_dare_id, v_dare_content, v_dare_category
      FROM public.game_dare_questions dq
      WHERE dq.is_active = true
        AND CASE v_dare_level
              WHEN 'sweet_only' THEN dq.category = 'sweet'
              WHEN 'full_chaos' THEN true
              ELSE dq.category IN ('sweet', 'funny', 'bold')
            END
      ORDER BY random() LIMIT 1;
    END IF;

    v_new_gs := v_new_gs || jsonb_build_object(
      'dare_counts',
      (v_gs->'dare_counts') || jsonb_build_object(
        v_loser, ((v_gs->'dare_counts'->>v_loser)::int + 1)
      )
    );
  END IF;

  v_round_result := jsonb_build_object(
    'round_number',  v_current_round,
    'minigame_id',   v_minigame_id,
    'host_score',    v_host_score,
    'partner_score', v_partner_score,
    'loser',         v_loser,
    'dare_id',       v_dare_id,
    'dare_content',  v_dare_content,
    'dare_category', v_dare_category,
    'dare_status',   CASE WHEN v_loser != 'draw' THEN 'pending' ELSE NULL END,
    'confirmed_at',  NULL
  );

  v_new_questions := v_session.questions || jsonb_build_array(v_round_result);

  IF v_loser = 'draw' THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase', 'playing', 'is_replay_round', true,
      'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
      'last_round_result', v_round_result, 'pending_bonus_for', NULL
    );
  ELSE
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase', 'result', 'is_replay_round', false,
      'last_round_result', v_round_result, 'pending_bonus_for', NULL
    );
  END IF;

  UPDATE public.game_sessions
  SET game_state = v_new_gs, questions = v_new_questions, updated_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object('waiting_for_partner', false,
                            'round_result', v_round_result, 'game_state', v_new_gs);
END;
$$;

-- ============================================================
-- FUNCTION: complete_dare_derby_dare (migration 015)
-- Loser tandai dare selesai → dare_status: pending → awaiting_confirm
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_my_role       TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code AND game_type = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;
  IF v_session.status != 'playing' THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE'; END IF;

  v_gs := v_session.game_state;
  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Bukan fase dare saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN v_my_role := 'partner';
  ELSE RAISE EXCEPTION 'NOT_IN_SESSION'; END IF;

  v_last_result   := v_gs->'last_round_result';
  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;

  IF v_my_role != v_loser THEN
    RAISE EXCEPTION 'NOT_THE_LOSER' USING DETAIL = 'Hanya yang kalah yang bisa menyelesaikan dare';
  END IF;
  IF v_last_result->>'dare_status' != 'pending' THEN
    RAISE EXCEPTION 'DARE_NOT_PENDING' USING DETAIL = 'Dare bukan dalam status pending';
  END IF;

  v_new_questions := (
    SELECT jsonb_agg(
      CASE WHEN (q->>'round_number')::int = v_current_round AND q->>'loser' = v_loser
               AND q->>'dare_status' = 'pending'
           THEN q || jsonb_build_object('dare_status', 'awaiting_confirm')
           ELSE q END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  v_new_gs := v_gs || jsonb_build_object(
    'last_round_result',
    v_last_result || jsonb_build_object('dare_status', 'awaiting_confirm')
  );

  UPDATE public.game_sessions
  SET game_state = v_new_gs, questions = v_new_questions, updated_at = now()
  WHERE id = v_session.id;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: confirm_dare_derby_dare (latest: migration 018)
-- Partner konfirmasi dare. Setelah confirm, masuk 'lobby' dulu
-- agar ready_up meng-update updated_at saat mini-game dimulai.
-- p_confirmed=false → dare dikembalikan ke 'pending'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_confirmed    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code AND game_type = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;
  IF v_session.status != 'playing' THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE'; END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Bukan fase konfirmasi dare';
  END IF;

  v_last_result := v_gs->'last_round_result';
  IF v_last_result->>'dare_status' != 'awaiting_confirm' THEN
    RAISE EXCEPTION 'DARE_NOT_AWAITING'
      USING DETAIL = 'Dare belum ditandai selesai oleh yang kalah';
  END IF;

  IF v_session.host_user_id = p_user_id THEN v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN v_my_role := 'partner';
  ELSE RAISE EXCEPTION 'NOT_IN_SESSION'; END IF;

  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;

  IF v_my_role = v_loser THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_OWN'
      USING DETAIL = 'Kamu tidak bisa konfirmasi dare milikmu sendiri';
  END IF;

  IF p_confirmed THEN
    v_new_questions := (
      SELECT jsonb_agg(
        CASE WHEN (q->>'round_number')::int = v_current_round AND q->>'loser' = v_loser
             THEN q || jsonb_build_object('dare_status', 'completed', 'confirmed_at', now()::text)
             ELSE q END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );

    IF v_current_round >= v_total_rounds THEN
      v_new_gs := v_gs || jsonb_build_object(
        'phase', 'game_over',
        'last_round_result',
        v_last_result || jsonb_build_object('dare_status', 'completed', 'confirmed_at', now()::text)
      );
      UPDATE public.game_sessions
      SET game_state = v_new_gs, questions = v_new_questions,
          status = 'completed', updated_at = now()
      WHERE id = v_session.id;
    ELSE
      -- Masuk lobby agar ready_up menjadi acuan startedAt mini-game
      v_new_gs := v_gs || jsonb_build_object(
        'phase', 'lobby',
        'current_round', v_current_round + 1,
        'is_replay_round', false,
        'ready', jsonb_build_object('host', false, 'partner', false),
        'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
        'last_round_result',
        v_last_result || jsonb_build_object('dare_status', 'completed', 'confirmed_at', now()::text)
      );
      UPDATE public.game_sessions
      SET game_state = v_new_gs, questions = v_new_questions, updated_at = now()
      WHERE id = v_session.id;
    END IF;
  ELSE
    v_new_questions := (
      SELECT jsonb_agg(
        CASE WHEN (q->>'round_number')::int = v_current_round AND q->>'loser' = v_loser
             THEN q || jsonb_build_object('dare_status', 'pending')
             ELSE q END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );
    v_new_gs := v_gs || jsonb_build_object(
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'pending')
    );
    UPDATE public.game_sessions
    SET game_state = v_new_gs, questions = v_new_questions, updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: skip_dare_derby_dare (migration 015)
-- Loser skip dare. Skip ke-2 → lawan bonus. Skip ke-3 → forfeit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.skip_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_opponent_role TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_skip_count    INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
  v_is_last_round BOOLEAN;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code AND game_type = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;
  IF v_session.status != 'playing' THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE'; END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Bukan fase dare saat ini';
  END IF;

  IF v_session.host_user_id = p_user_id THEN v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN v_my_role := 'partner';
  ELSE RAISE EXCEPTION 'NOT_IN_SESSION'; END IF;

  v_last_result   := v_gs->'last_round_result';
  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;
  v_opponent_role := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
  v_is_last_round := v_current_round >= v_total_rounds;

  IF v_my_role != v_loser THEN
    RAISE EXCEPTION 'NOT_THE_LOSER' USING DETAIL = 'Hanya yang kalah yang bisa skip dare';
  END IF;
  IF v_last_result->>'dare_status' NOT IN ('pending', 'awaiting_confirm') THEN
    RAISE EXCEPTION 'DARE_NOT_SKIPPABLE';
  END IF;

  v_skip_count := (v_gs->'skip_counts'->>v_my_role)::int + 1;

  v_new_questions := (
    SELECT jsonb_agg(
      CASE WHEN (q->>'round_number')::int = v_current_round AND q->>'loser' = v_loser
           THEN q || jsonb_build_object('dare_status', 'skipped')
           ELSE q END
    )
    FROM jsonb_array_elements(v_session.questions) q
  );

  v_new_gs := v_gs || jsonb_build_object(
    'skip_counts',
    (v_gs->'skip_counts') || jsonb_build_object(v_my_role, v_skip_count)
  );

  IF v_skip_count >= 3 THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase', 'game_over', 'forfeit_by', v_my_role,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );
    UPDATE public.game_sessions
    SET game_state = v_new_gs, questions = v_new_questions,
        status = 'completed', updated_at = now()
    WHERE id = v_session.id;
  ELSIF v_is_last_round THEN
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase', 'game_over', 'pending_bonus_for', NULL,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );
    UPDATE public.game_sessions
    SET game_state = v_new_gs, questions = v_new_questions,
        status = 'completed', updated_at = now()
    WHERE id = v_session.id;
  ELSE
    v_new_gs := v_new_gs || jsonb_build_object(
      'phase', 'playing',
      'current_round', v_current_round + 1,
      'is_replay_round', false,
      'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
      'pending_bonus_for', CASE WHEN v_skip_count = 2 THEN v_opponent_role ELSE NULL END,
      'last_round_result', v_last_result || jsonb_build_object('dare_status', 'skipped')
    );
    UPDATE public.game_sessions
    SET game_state = v_new_gs, questions = v_new_questions, updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- VOUCHER FUNCTIONS (migration 020+021)
-- ============================================================

-- ============================================================
-- FUNCTION: redeem_voucher (latest: migration 021)
-- Redeem voucher coin_credit → langsung kredit ke wallet.
-- Tolak voucher topup_discount (harus lewat apply_topup_discount).
-- Race condition protection: SELECT FOR UPDATE pada baris voucher.
-- Double-use protection: UNIQUE(voucher_id, user_id) sebagai safety net.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_voucher(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher public.vouchers%ROWTYPE;
  v_tx_id   BIGINT;
BEGIN
  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_voucher FROM public.vouchers WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voucher tidak ditemukan');
  END IF;

  IF v_voucher.type = 'topup_discount' THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Voucher ini hanya berlaku saat pembelian paket coin');
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
    RETURN jsonb_build_object('success', false,
      'message', 'Kamu sudah pernah menggunakan voucher ini');
  END IF;

  UPDATE public.vouchers SET uses_remaining = uses_remaining - 1 WHERE id = v_voucher.id;
  UPDATE public.wallets SET balance = balance + v_voucher.coin_value WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (
    user_id, type, amount, payment_status, payment_reference, paid_at, metadata
  ) VALUES (
    p_user_id, 'topup', v_voucher.coin_value, 'paid',
    'VOUCHER-' || v_voucher.code, NOW(),
    jsonb_build_object('reason', 'voucher_redemption',
                       'voucher_code', v_voucher.code, 'voucher_id', v_voucher.id)
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.voucher_redemptions (voucher_id, user_id, coin_transaction_id)
  VALUES (v_voucher.id, p_user_id, v_tx_id);

  RETURN jsonb_build_object(
    'success', true, 'message', 'Voucher berhasil digunakan!',
    'coin_value', v_voucher.coin_value
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Kamu sudah pernah menggunakan voucher ini');
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
-- FUNCTION: quoridor_has_path (migration 026)
-- BFS dari (p_start_r, p_start_c) menuju baris p_target_row.
-- Return TRUE jika jalur ada, FALSE jika diblokir total.
-- ============================================================
CREATE OR REPLACE FUNCTION public.quoridor_has_path(
  p_start_r    INTEGER,
  p_start_c    INTEGER,
  p_target_row INTEGER,
  p_walls      JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_visited  BOOLEAN[9][9];
  v_queue    INTEGER[];
  v_head     INTEGER;
  v_tail     INTEGER;
  v_node     INTEGER;
  v_r        INTEGER;
  v_c        INTEGER;
BEGIN
  v_visited := ARRAY_FILL(FALSE, ARRAY[9, 9]);
  v_visited[p_start_r + 1][p_start_c + 1] := TRUE;

  v_queue := ARRAY[p_start_r * 9 + p_start_c];
  v_head  := 1;
  v_tail  := 1;

  WHILE v_head <= v_tail LOOP
    v_node  := v_queue[v_head];
    v_head  := v_head + 1;
    v_r     := v_node / 9;
    v_c     := v_node % 9;

    IF v_r = p_target_row THEN
      RETURN TRUE;
    END IF;

    -- Atas
    IF v_r > 0 AND NOT v_visited[v_r][v_c + 1] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_r - 1
          AND ((w->>'c')::int = v_c OR (w->>'c')::int = v_c - 1)
      ) THEN
        v_visited[v_r][v_c + 1] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, (v_r - 1) * 9 + v_c);
      END IF;
    END IF;

    -- Bawah
    IF v_r < 8 AND NOT v_visited[v_r + 2][v_c + 1] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'H'
          AND (w->>'r')::int = v_r
          AND ((w->>'c')::int = v_c OR (w->>'c')::int = v_c - 1)
      ) THEN
        v_visited[v_r + 2][v_c + 1] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, (v_r + 1) * 9 + v_c);
      END IF;
    END IF;

    -- Kiri
    IF v_c > 0 AND NOT v_visited[v_r + 1][v_c] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_c - 1
          AND ((w->>'r')::int = v_r OR (w->>'r')::int = v_r - 1)
      ) THEN
        v_visited[v_r + 1][v_c] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, v_r * 9 + (v_c - 1));
      END IF;
    END IF;

    -- Kanan
    IF v_c < 8 AND NOT v_visited[v_r + 1][v_c + 2] THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_walls) w
        WHERE (w->>'orientation') = 'V'
          AND (w->>'c')::int = v_c
          AND ((w->>'r')::int = v_r OR (w->>'r')::int = v_r - 1)
      ) THEN
        v_visited[v_r + 1][v_c + 2] := TRUE;
        v_tail  := v_tail + 1;
        v_queue := array_append(v_queue, v_r * 9 + (v_c + 1));
      END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- FUNCTION: quoridor_action (state akhir — migration 027)
-- Atomic move + wall placement untuk game Quoridor.
-- Dipanggil dari: POST /api/game/quoridor/session/[code]/action
--
-- p_action_type: 'move' | 'wall'
-- p_payload:
--   move: { "r": int, "c": int }
--   wall: { "orientation": "H"|"V", "r": int, "c": int }
-- ============================================================
CREATE OR REPLACE FUNCTION public.quoridor_action(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_action_type  VARCHAR(10),
  p_payload      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session    public.game_sessions;
  v_gs         JSONB;
  v_my_role    TEXT;
  v_new_gs     JSONB;
  v_next_turn  TEXT;

  v_host_pos   JSONB;
  v_part_pos   JSONB;
  v_my_pos     JSONB;
  v_opp_pos    JSONB;

  v_walls      JSONB;
  v_walls_left JSONB;
  v_my_walls   INTEGER;
  v_new_wall   JSONB;
  v_wall_elem  JSONB;
  v_overlap    BOOLEAN := FALSE;

  v_my_r       INTEGER;
  v_my_c       INTEGER;
  v_opp_r      INTEGER;
  v_opp_c      INTEGER;
  v_new_r      INTEGER;
  v_new_c      INTEGER;
  v_diff_r     INTEGER;
  v_diff_c     INTEGER;

  v_step_r     INTEGER;
  v_step_c     INTEGER;

  v_blocked        BOOLEAN := FALSE;
  v_jump_blocked   BOOLEAN := FALSE;
  v_valid_move     BOOLEAN := FALSE;

  v_winner      TEXT := NULL;
  v_target_row  INTEGER;
  v_last_action JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak ditemukan';
  END IF;

  IF v_session.status != 'playing' THEN
    IF v_session.status = 'completed' THEN
      RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Game sudah selesai';
    END IF;
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi tidak aktif';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.game_sessions SET status = 'expired', updated_at = now() WHERE id = v_session.id;
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  v_gs := v_session.game_state;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  IF (v_gs->>'current_turn') != v_my_role THEN
    RAISE EXCEPTION 'NOT_YOUR_TURN' USING DETAIL = 'Bukan giliranmu';
  END IF;

  v_host_pos   := v_gs->'host_pos';
  v_part_pos   := v_gs->'partner_pos';
  v_walls      := COALESCE(v_gs->'walls', '[]'::jsonb);
  v_walls_left := v_gs->'walls_left';

  IF v_my_role = 'host' THEN
    v_my_pos := v_host_pos; v_opp_pos := v_part_pos;
  ELSE
    v_my_pos := v_part_pos; v_opp_pos := v_host_pos;
  END IF;

  v_my_r  := (v_my_pos->>'r')::int;
  v_my_c  := (v_my_pos->>'c')::int;
  v_opp_r := (v_opp_pos->>'r')::int;
  v_opp_c := (v_opp_pos->>'c')::int;

  -- ══ MOVE ══════════════════════════════════════════════════════════════════
  IF p_action_type = 'move' THEN
    v_new_r := (p_payload->>'r')::int;
    v_new_c := (p_payload->>'c')::int;

    IF v_new_r < 0 OR v_new_r > 8 OR v_new_c < 0 OR v_new_c > 8 THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi di luar papan';
    END IF;
    IF v_new_r = v_my_r AND v_new_c = v_my_c THEN
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Posisi tujuan sama dengan posisi saat ini';
    END IF;

    v_diff_r := v_new_r - v_my_r;
    v_diff_c := v_new_c - v_my_c;

    -- KASUS A: Gerak 1 langkah
    IF (ABS(v_diff_r) = 1 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 1) THEN
      IF v_new_r = v_opp_r AND v_new_c = v_opp_c THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Tidak bisa bergerak ke posisi lawan';
      END IF;
      v_blocked := FALSE;
      IF v_diff_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_diff_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_diff_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      ELSIF v_diff_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_blocked, FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur diblokir oleh tembok'; END IF;
      v_valid_move := TRUE;

    -- KASUS B: Lompatan lurus 2 langkah
    ELSIF (ABS(v_diff_r) = 2 AND v_diff_c = 0) OR (v_diff_r = 0 AND ABS(v_diff_c) = 2) THEN
      v_step_r := v_diff_r / 2;
      v_step_c := v_diff_c / 2;
      IF v_opp_r != v_my_r + v_step_r OR v_opp_c != v_my_c + v_step_c THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Tidak ada lawan di jalur lompatan lurus';
      END IF;
      v_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_blocked, FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL = 'Jalur menuju lawan diblokir tembok'; END IF;
      v_jump_blocked := FALSE;
      IF v_step_r = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
      ELSIF v_step_r = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
      ELSIF v_step_c = 1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
      ELSIF v_step_c = -1 THEN
        SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
      END IF;
      IF COALESCE(v_jump_blocked, FALSE) THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Lompatan lurus diblokir tembok di belakang lawan — gunakan diagonal';
      END IF;
      v_valid_move := TRUE;

    -- KASUS C: Lompatan diagonal
    ELSIF ABS(v_diff_r) = 1 AND ABS(v_diff_c) = 1 THEN
      v_valid_move := FALSE;

      IF v_opp_r = v_my_r + v_diff_r AND v_opp_c = v_my_c THEN
        IF v_new_r = v_opp_r AND v_new_c = v_opp_c + v_diff_c THEN
          v_blocked := FALSE;
          IF v_diff_r = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_my_r-1 AND ((w->>'c')::int=v_my_c OR (w->>'c')::int=v_my_c-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur menuju lawan diblokir tembok'; END IF;
          v_jump_blocked := FALSE;
          IF v_opp_r+v_diff_r < 0 OR v_opp_r+v_diff_r > 8 THEN v_jump_blocked := TRUE;
          ELSIF v_diff_r = 1 THEN SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1; END IF;
          IF NOT COALESCE(v_jump_blocked,FALSE) THEN RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL='Lompatan lurus tersedia, tidak bisa diagonal'; END IF;
          v_blocked := FALSE;
          IF v_diff_c = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur diagonal diblokir tembok'; END IF;
          v_valid_move := TRUE;
        END IF;

      ELSIF v_opp_r = v_my_r AND v_opp_c = v_my_c + v_diff_c THEN
        IF v_new_r = v_opp_r + v_diff_r AND v_new_c = v_opp_c THEN
          v_blocked := FALSE;
          IF v_diff_c = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_my_c-1 AND ((w->>'r')::int=v_my_r OR (w->>'r')::int=v_my_r-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur menuju lawan diblokir tembok'; END IF;
          v_jump_blocked := FALSE;
          IF v_opp_c+v_diff_c < 0 OR v_opp_c+v_diff_c > 8 THEN v_jump_blocked := TRUE;
          ELSIF v_diff_c = 1 THEN SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_jump_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='V' AND (w->>'c')::int=v_opp_c-1 AND ((w->>'r')::int=v_opp_r OR (w->>'r')::int=v_opp_r-1) LIMIT 1; END IF;
          IF NOT COALESCE(v_jump_blocked,FALSE) THEN RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL='Lompatan lurus tersedia, tidak bisa diagonal'; END IF;
          v_blocked := FALSE;
          IF v_diff_r = 1 THEN SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1;
          ELSE SELECT TRUE INTO v_blocked FROM jsonb_array_elements(v_walls) w WHERE (w->>'orientation')='H' AND (w->>'r')::int=v_opp_r-1 AND ((w->>'c')::int=v_opp_c OR (w->>'c')::int=v_opp_c-1) LIMIT 1; END IF;
          IF COALESCE(v_blocked,FALSE) THEN RAISE EXCEPTION 'BLOCKED_BY_WALL' USING DETAIL='Jalur diagonal diblokir tembok'; END IF;
          v_valid_move := TRUE;
        END IF;
      END IF;

      IF NOT v_valid_move THEN
        RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Gerakan diagonal tidak valid';
      END IF;

    ELSE
      RAISE EXCEPTION 'INVALID_MOVE' USING DETAIL = 'Gerakan tidak valid (terlalu jauh atau diagonal tak wajar)';
    END IF;

    v_last_action := jsonb_build_object('player', v_my_role, 'type', 'move', 'payload', jsonb_build_object('r', v_new_r, 'c', v_new_c));

    IF v_my_role = 'host' THEN
      v_new_gs := v_gs || jsonb_build_object('host_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c), 'last_action', v_last_action);
      IF v_new_r = 8 THEN v_winner := 'host'; END IF;
    ELSE
      v_new_gs := v_gs || jsonb_build_object('partner_pos', jsonb_build_object('r', v_new_r, 'c', v_new_c), 'last_action', v_last_action);
      IF v_new_r = 0 THEN v_winner := 'partner'; END IF;
    END IF;

  -- ══ WALL ══════════════════════════════════════════════════════════════════
  ELSIF p_action_type = 'wall' THEN
    v_my_walls := CASE WHEN v_my_role = 'host' THEN (v_walls_left->>'host')::int ELSE (v_walls_left->>'partner')::int END;
    IF v_my_walls <= 0 THEN RAISE EXCEPTION 'NO_WALLS_LEFT' USING DETAIL = 'Kamu sudah tidak punya tembok'; END IF;

    v_new_wall := jsonb_build_object('orientation', p_payload->>'orientation', 'r', (p_payload->>'r')::int, 'c', (p_payload->>'c')::int);

    IF (v_new_wall->>'r')::int < 0 OR (v_new_wall->>'r')::int > 7 OR (v_new_wall->>'c')::int < 0 OR (v_new_wall->>'c')::int > 7 THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Posisi tembok di luar papan';
    END IF;
    IF (v_new_wall->>'orientation') NOT IN ('H', 'V') THEN
      RAISE EXCEPTION 'INVALID_WALL' USING DETAIL = 'Orientasi tembok tidak valid (H atau V)';
    END IF;

    -- Cek wall overlap
    v_overlap := FALSE;
    FOR v_wall_elem IN SELECT * FROM jsonb_array_elements(v_walls) LOOP
      IF (v_wall_elem->>'orientation') = 'H' AND (v_new_wall->>'orientation') = 'H' THEN
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int AND ABS((v_wall_elem->>'c')::int - (v_new_wall->>'c')::int) <= 1 THEN v_overlap := TRUE; END IF;
      ELSIF (v_wall_elem->>'orientation') = 'V' AND (v_new_wall->>'orientation') = 'V' THEN
        IF (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int AND ABS((v_wall_elem->>'r')::int - (v_new_wall->>'r')::int) <= 1 THEN v_overlap := TRUE; END IF;
      ELSE
        IF (v_wall_elem->>'r')::int = (v_new_wall->>'r')::int AND (v_wall_elem->>'c')::int = (v_new_wall->>'c')::int THEN v_overlap := TRUE; END IF;
      END IF;
      IF v_overlap THEN RAISE EXCEPTION 'WALL_OVERLAP' USING DETAIL = 'Posisi tembok sudah terpakai atau bertabrakan'; END IF;
    END LOOP;

    v_walls := v_walls || jsonb_build_array(v_new_wall);

    -- BFS path check
    IF NOT public.quoridor_has_path((v_host_pos->>'r')::int, (v_host_pos->>'c')::int, 8, v_walls)
       OR NOT public.quoridor_has_path((v_part_pos->>'r')::int, (v_part_pos->>'c')::int, 0, v_walls) THEN
      RAISE EXCEPTION 'WALL_BLOCKS_PATH' USING DETAIL = 'Tembok ini memblokir total jalur salah satu pemain';
    END IF;

    IF v_my_role = 'host' THEN
      v_walls_left := v_walls_left || jsonb_build_object('host', v_my_walls - 1);
    ELSE
      v_walls_left := v_walls_left || jsonb_build_object('partner', v_my_walls - 1);
    END IF;

    v_last_action := jsonb_build_object('player', v_my_role, 'type', 'wall', 'payload', v_new_wall);
    v_new_gs := v_gs || jsonb_build_object('walls', v_walls, 'walls_left', v_walls_left, 'last_action', v_last_action);

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION' USING DETAIL = 'action_type harus move atau wall';
  END IF;

  -- Ganti giliran
  IF v_winner IS NOT NULL THEN
    v_new_gs := v_new_gs || jsonb_build_object('winner', v_winner, 'current_turn', v_my_role);
    UPDATE public.game_sessions SET game_state = v_new_gs, status = 'completed', updated_at = now() WHERE id = v_session.id;
  ELSE
    v_next_turn := CASE WHEN v_my_role = 'host' THEN 'partner' ELSE 'host' END;
    v_new_gs := v_new_gs || jsonb_build_object('current_turn', v_next_turn, 'winner', NULL);
    UPDATE public.game_sessions SET game_state = v_new_gs, updated_at = now() WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;

-- ============================================================
-- FUNCTION: check_login_rate_limit (migration 028)
-- Two-tier brute-force protection berbasis email.
-- Tier 1: 5 gagal dalam 1 menit  → return 'tier1' (blok 1 menit)
-- Tier 2: 10 gagal dalam 1 jam   → return 'tier2' (blok 1 jam)
-- Else: catat attempt dan return 'ok'
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT
)
RETURNS TEXT  -- 'ok' | 'tier1' | 'tier2'
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
  v_endpoint        TEXT := 'auth:login';
  v_count_minute    INT;
  v_count_hour      INT;
BEGIN
  -- Buat UUID deterministik dari email (UUID v5, namespace OID)
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,
    lower(trim(p_email))
  );

  -- Advisory lock per email untuk cegah race condition
  PERFORM pg_advisory_xact_lock(hashtext(p_email));

  -- Hapus events lama (> 24 jam)
  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Hitung kegagalan dalam 1 menit (Tier 1)
  SELECT COUNT(*) INTO v_count_minute
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_count_minute >= 5 THEN
    RETURN 'tier1';  -- blok 1 menit
  END IF;

  -- Hitung kegagalan dalam 1 jam (Tier 2)
  SELECT COUNT(*) INTO v_count_hour
  FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = v_endpoint
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 10 THEN
    RETURN 'tier2';  -- blok 1 jam
  END IF;

  -- Catat attempt baru
  INSERT INTO public.rate_limit_events (user_id, endpoint)
  VALUES (v_pseudo_user_id, v_endpoint);

  RETURN 'ok';
END;
$$;

-- ============================================================
-- FUNCTION: clear_login_rate_limit (migration 028)
-- Reset rate limit counter setelah login berhasil.
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pseudo_user_id UUID;
BEGIN
  v_pseudo_user_id := uuid_generate_v5(
    '6ba7b812-9dad-11d1-80b4-00c04fd430c8'::uuid,
    lower(trim(p_email))
  );

  DELETE FROM public.rate_limit_events
  WHERE user_id  = v_pseudo_user_id
    AND endpoint = 'auth:login';
END;
$$;
