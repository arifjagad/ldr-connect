-- ============================================================
-- LDR-Connect: Migration 006 — Snake & Ladder pakai game_sessions
--
-- Masalah: game_snake_sessions adalah tabel terpisah yang salah.
-- Solusi: pakai game_sessions (1 tabel untuk semua game type),
--         tambah kolom board_config + game_state untuk snake.
-- ============================================================

-- 1. Tambah kolom board_config + game_state ke game_sessions
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS board_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS game_state   JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.game_sessions.board_config IS 'Snake & Ladder: konfigurasi ular, tangga, kotak tantangan (JSON)';
COMMENT ON COLUMN public.game_sessions.game_state   IS 'Snake & Ladder: posisi pion, giliran, tantangan pending, pemenang (JSON)';

-- 2. Update RPC create_game_session: tambah parameter board_config & game_state
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
  SELECT partner_id INTO v_partner_id
  FROM public.users WHERE id = p_host_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NO_PARTNER' USING DETAIL = 'Kamu belum terhubung dengan pasangan';
  END IF;

  v_couple_id := LEAST(p_host_user_id, v_partner_id);

  IF EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE couple_id = v_couple_id AND status IN ('waiting', 'playing')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_SESSION' USING DETAIL = 'Pasangan kamu sudah memiliki sesi yang sedang berjalan';
  END IF;

  SELECT balance INTO v_wallet_balance
  FROM public.wallets WHERE user_id = p_host_user_id FOR UPDATE;

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
      'reason', 'game_session_created',
      'game_type', p_game_type,
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

-- 3. Hapus tabel game_snake_sessions (tidak dipakai lagi)
DROP TABLE IF EXISTS public.game_snake_sessions CASCADE;

-- 4. Hapus RPC yang terkait game_snake_sessions
DROP FUNCTION IF EXISTS public.create_snake_session(UUID, TEXT, JSONB, INT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.join_snake_session(UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_active_snake_session_for_couple(UUID);
