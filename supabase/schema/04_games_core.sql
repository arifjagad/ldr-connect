-- ============================================================
-- LDR-Connect Schema — 04 Game — inti sesi
-- Jalankan SETELAH 03_rate_limiting.sql
--
-- game_settings, game_sessions (satu tabel untuk semua game), create/join/
-- cancel/refund/expire sesi, cari sesi aktif couple.
-- ============================================================

-- ============================================================
-- TABLE: game_sessions
-- State akhir: sudah ada board_config + game_state (dari migration 006)
-- ============================================================
CREATE TABLE public.game_sessions (
  id               BIGSERIAL    PRIMARY KEY,
  couple_id        UUID         NOT NULL,  -- LEAST(host_user_id, partner_user_id)
  host_user_id     UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_user_id  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  session_code     VARCHAR(12)  UNIQUE NOT NULL,
  game_type        VARCHAR(20)  NOT NULL DEFAULT 'tod'
                     CHECK (game_type IN ('tod', 'snake_ladder', 'quiz', 'dare_derby', 'quoridor', 'photobooth')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'playing', 'completed', 'expired', 'cancelled')),
  questions        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  board_config     JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- Snake: ular/tangga/tantangan; Quoridor: board config
  game_state       JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- Snake: posisi pion, giliran, pemenang; Quoridor: posisi pion, tembok
  coin_deducted    INTEGER      NOT NULL DEFAULT 0,
  partner_joined_at TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  coin_refunded_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_gs_couple_id   ON public.game_sessions(couple_id);
CREATE INDEX idx_gs_session_code ON public.game_sessions(session_code);
CREATE INDEX idx_gs_status       ON public.game_sessions(status);
CREATE INDEX idx_gs_host         ON public.game_sessions(host_user_id);

CREATE INDEX idx_gs_expires      ON public.game_sessions(expires_at)
  WHERE status IN ('waiting', 'playing');

COMMENT ON COLUMN public.game_sessions.couple_id    IS 'Selalu LEAST(host_user_id, partner_user_id)';
COMMENT ON COLUMN public.game_sessions.session_code IS '12 karakter random, dipakai sebagai channel Supabase Realtime';
COMMENT ON COLUMN public.game_sessions.board_config IS 'Snake & Ladder: konfigurasi ular, tangga, kotak tantangan (JSON)';
COMMENT ON COLUMN public.game_sessions.game_state   IS 'Snake & Ladder: posisi pion, giliran, tantangan pending, pemenang (JSON)';

-- ============================================================
-- TABLE: game_settings
-- ============================================================
CREATE TABLE public.game_settings (
  id                 BIGSERIAL    PRIMARY KEY,
  game_type          VARCHAR(20)  UNIQUE NOT NULL,
  display_name       VARCHAR(255) NOT NULL,
  description        TEXT,
  coin_cost          INTEGER      NOT NULL DEFAULT 5 CHECK (coin_cost >= 0),
  expires_in_minutes INTEGER      NOT NULL DEFAULT 10 CHECK (expires_in_minutes > 0),
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_game_settings_updated_at
  BEFORE UPDATE ON public.game_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- REALTIME: Aktifkan untuk game_sessions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;

ALTER TABLE public.game_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- game_sessions
-- ============================================================

-- Baca sesi milik sendiri (host atau partner)
CREATE POLICY "game_sessions_select_own"
  ON public.game_sessions FOR SELECT
  USING (
    host_user_id = auth.uid()
    OR partner_user_id = auth.uid()
  );

-- ============================================================
-- game_settings
-- ============================================================
CREATE POLICY "game_settings_select_authenticated"
  ON public.game_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "game_settings_update_admin"
  ON public.game_settings FOR UPDATE
  USING (public.is_admin());

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
  v_stale_session  RECORD;
BEGIN
  SELECT partner_id INTO v_partner_id
  FROM public.users
  WHERE id = p_host_user_id;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'NO_PARTNER'
      USING DETAIL = 'Kamu belum terhubung dengan pasangan';
  END IF;

  v_couple_id := LEAST(p_host_user_id, v_partner_id);

  -- Serialisasi create_game_session per couple — mencegah race condition di
  -- mana host & partner (atau dua tab/device yang sama) menekan "buat sesi"
  -- hampir bersamaan dan keduanya lolos cek EXISTS di bawah sebelum salah
  -- satu meng-INSERT baris barunya (menghasilkan 2 sesi aktif untuk 1 couple).
  PERFORM pg_advisory_xact_lock(hashtext('game_session_create:' || v_couple_id::text));

  -- Auto-expire sesi lama milik couple yang sudah habis waktu, sebelum cek aktif.
  -- Sesi 'waiting' yang expired di-refund ke host (partner tidak pernah join —
  -- lihat refund_expired_session). Sesi 'playing' yang expired TIDAK direfund
  -- (kedua pihak sudah "memakai" coin untuk bermain, sesuai desain yang sama
  -- dengan cancel_game_session).
  FOR v_stale_session IN
    SELECT id, status FROM public.game_sessions
    WHERE couple_id = v_couple_id
      AND status IN ('waiting', 'playing')
      AND expires_at <= NOW()
    FOR UPDATE
  LOOP
    IF v_stale_session.status = 'waiting' THEN
      PERFORM public.refund_expired_session(v_stale_session.id);
    ELSE
      UPDATE public.game_sessions
      SET status = 'expired', updated_at = now()
      WHERE id = v_stale_session.id;
    END IF;
  END LOOP;

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
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.create_game_session(UUID, VARCHAR, VARCHAR, JSONB, INTEGER, TIMESTAMPTZ, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_game_session(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_expired_session(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_waiting_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_session_for_couple(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_game_session(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
