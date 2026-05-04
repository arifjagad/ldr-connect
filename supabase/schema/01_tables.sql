-- ============================================================
-- LDR-Connect: Schema Fresh — 01 Tables, Indexes, Triggers
--
-- State akhir setelah semua migrasi (001–013):
--   • game_sessions sudah ada board_config + game_state
--   • game_snake_sessions TIDAK ADA (dihapus di migration 006)
--   • rate_limit_events SUDAH ADA (dari migration 010)
--   • 011–013: hanya perubahan functions (lihat 03_functions.sql)
--
-- Urutan jalankan:
--   01_tables.sql → 02_rls.sql → 03_functions.sql → 04_seed_data.sql
--   → kemudian seed question (004 & 005 di folder migrations/)
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: generate_couple_code
-- Buat couple_code unik 10 karakter (diperlukan untuk DEFAULT di tabel users)
-- Harus dibuat SEBELUM tabel users
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_couple_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE couple_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE public.users (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  couple_code VARCHAR(10)  UNIQUE NOT NULL DEFAULT public.generate_couple_code(),
  partner_id  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  status      VARCHAR(10)  NOT NULL DEFAULT 'single'
                CHECK (status IN ('single', 'linked')),
  is_admin    BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_couple_code ON public.users(couple_code);
CREATE INDEX idx_users_partner_id  ON public.users(partner_id);
CREATE INDEX idx_users_status      ON public.users(status);

COMMENT ON COLUMN public.users.couple_code IS 'Kode unik 10 karakter untuk link pasangan';
COMMENT ON COLUMN public.users.partner_id  IS 'Self-referential FK ke users.id';
COMMENT ON COLUMN public.users.status      IS 'single | linked';

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

-- ============================================================
-- TABLE: game_tod_questions
-- ============================================================
CREATE TABLE public.game_tod_questions (
  id          BIGSERIAL    PRIMARY KEY,
  couple_id   UUID,        -- NULL = global (admin), UUID = LEAST(user_id, partner_id)
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('truth', 'dare')),
  category    VARCHAR(255) NOT NULL,
  question    TEXT         NOT NULL,
  source      VARCHAR(10)  NOT NULL DEFAULT 'admin'
                CHECK (source IN ('admin', 'user', 'ai')),
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_by  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tod_q_couple   ON public.game_tod_questions(couple_id);
CREATE INDEX idx_tod_q_type     ON public.game_tod_questions(type);
CREATE INDEX idx_tod_q_category ON public.game_tod_questions(category);
CREATE INDEX idx_tod_q_source   ON public.game_tod_questions(source);
CREATE INDEX idx_tod_q_active   ON public.game_tod_questions(is_active);

COMMENT ON COLUMN public.game_tod_questions.couple_id IS 'NULL = global admin, UUID = couple-specific';
COMMENT ON COLUMN public.game_tod_questions.source    IS 'admin = seeded | user = submitted | ai = dari Gemini';

-- ============================================================
-- TABLE: game_snake_questions
-- ============================================================
CREATE TABLE public.game_snake_questions (
  id         BIGSERIAL    PRIMARY KEY,
  type       VARCHAR(10)  NOT NULL CHECK (type IN ('truth', 'dare')),
  question   TEXT         NOT NULL,
  category   VARCHAR(255) NOT NULL DEFAULT 'umum',
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_snake_q_type   ON public.game_snake_questions(type);
CREATE INDEX idx_snake_q_active ON public.game_snake_questions(is_active);

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
                     CHECK (game_type IN ('tod', 'snake_ladder', 'quiz')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'playing', 'completed', 'expired', 'cancelled')),
  questions        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  board_config     JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- Snake: ular/tangga/tantangan
  game_state       JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- Snake: posisi pion, giliran, pemenang
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
-- TABLE: anniversaries
-- ============================================================
CREATE TABLE public.anniversaries (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  date       DATE         NOT NULL,
  notes      TEXT,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_anniversaries_user_id ON public.anniversaries(user_id);
CREATE INDEX idx_anniversaries_date    ON public.anniversaries(date);

-- ============================================================
-- TABLE: admin_activity_logs
-- ============================================================
CREATE TABLE public.admin_activity_logs (
  id            BIGSERIAL    PRIMARY KEY,
  admin_user_id UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  action        VARCHAR(120) NOT NULL,
  target_type   VARCHAR(255),
  target_id     BIGINT,
  metadata      JSONB,
  ip_address    INET,
  user_agent    VARCHAR(500),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_logs_user   ON public.admin_activity_logs(admin_user_id);
CREATE INDEX idx_admin_logs_target ON public.admin_activity_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_action ON public.admin_activity_logs(action);
CREATE INDEX idx_admin_logs_date   ON public.admin_activity_logs(created_at DESC);

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

-- ============================================================
-- TABLE: rate_limit_events (dari migration 010)
-- ============================================================
CREATE TABLE public.rate_limit_events (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, endpoint, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER FUNCTION: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_coin_packages_updated_at
  BEFORE UPDATE ON public.coin_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_coin_transactions_updated_at
  BEFORE UPDATE ON public.coin_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_game_tod_questions_updated_at
  BEFORE UPDATE ON public.game_tod_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_anniversaries_updated_at
  BEFORE UPDATE ON public.anniversaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_game_settings_updated_at
  BEFORE UPDATE ON public.game_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_admin_logs_updated_at
  BEFORE UPDATE ON public.admin_activity_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create user profile + wallet saat signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, couple_code, status, is_admin)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    public.generate_couple_code(),
    'single',
    false
  );

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_auth_user error for %: % (%)', NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- REALTIME: Aktifkan untuk game_sessions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
