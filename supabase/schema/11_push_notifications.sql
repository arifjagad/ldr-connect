-- ============================================================
-- LDR-Connect Schema — 11 Web push
-- Jalankan SETELAH 10_couple_features.sql
--
-- push_subscriptions (endpoint VAPID per device).
-- ============================================================

-- ============================================================
-- TABLE: push_subscriptions
-- Web Push API subscriptions (untuk notifikasi browser)
-- ============================================================
CREATE TABLE public.push_subscriptions (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- push_subscriptions
-- ============================================================

-- User hanya bisa akses subscription miliknya sendiri
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bisa baca semua (untuk server-side push sending)
CREATE POLICY "push_subscriptions_service_role"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
