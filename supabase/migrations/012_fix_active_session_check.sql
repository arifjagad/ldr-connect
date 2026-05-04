-- ============================================================
-- Migration 012: Fix ACTIVE_SESSION check di create_game_session
--
-- Masalah: RPC hanya cek status IN ('waiting','playing') tanpa
-- cek expires_at, sehingga sesi yang sudah habis waktu tapi
-- belum diupdate statusnya dianggap masih aktif.
--
-- Fix: Tambah AND expires_at > NOW() pada pengecekan sesi aktif.
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
