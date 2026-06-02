-- Migration 029: Tabel capsules (kapsul waktu digital)
-- Jalankan di Supabase SQL Editor jika tabel belum ada

-- ============================================================
-- TABLE: capsules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.capsules (
  id           BIGSERIAL    PRIMARY KEY,
  sender_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id    UUID         NOT NULL,

  message      TEXT         NOT NULL,
  opens_at     DATE         NOT NULL,

  status       VARCHAR(10)  NOT NULL DEFAULT 'locked'
                 CHECK (status IN ('locked', 'delivered', 'opened')),

  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,

  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capsules_sender_id   ON public.capsules(sender_id);
CREATE INDEX IF NOT EXISTS idx_capsules_receiver_id ON public.capsules(receiver_id);
CREATE INDEX IF NOT EXISTS idx_capsules_couple_id   ON public.capsules(couple_id);
CREATE INDEX IF NOT EXISTS idx_capsules_opens_at    ON public.capsules(opens_at) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS idx_capsules_status      ON public.capsules(status);

CREATE OR REPLACE TRIGGER trg_capsules_updated_at
  BEFORE UPDATE ON public.capsules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.capsules;

-- ============================================================
-- RLS: capsules
-- ============================================================
ALTER TABLE public.capsules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capsules_select_couple" ON public.capsules;
CREATE POLICY "capsules_select_couple"
  ON public.capsules FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "capsules_insert_sender" ON public.capsules;
CREATE POLICY "capsules_insert_sender"
  ON public.capsules FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND receiver_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
    AND couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
    AND opens_at > CURRENT_DATE
  );

DROP POLICY IF EXISTS "capsules_update_open" ON public.capsules;
CREATE POLICY "capsules_update_open"
  ON public.capsules FOR UPDATE
  USING (receiver_id = auth.uid() AND status = 'delivered');
