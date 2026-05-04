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
