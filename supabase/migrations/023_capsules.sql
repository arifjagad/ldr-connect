-- Migration 023: Kapsul Waktu Digital (Time Capsule)
-- Pesan/surat yang dikunci sampai tanggal tertentu

CREATE TABLE public.capsules (
  id           BIGSERIAL    PRIMARY KEY,
  sender_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id    UUID         NOT NULL,           -- LEAST(sender_id, receiver_id)

  message      TEXT         NOT NULL,           -- isi pesan (terenkripsi di sisi client nanti)
  opens_at     DATE         NOT NULL,           -- tanggal kapsul bisa dibuka

  -- Status: locked → delivered → opened
  status       VARCHAR(10)  NOT NULL DEFAULT 'locked'
                 CHECK (status IN ('locked', 'delivered', 'opened')),

  delivered_at TIMESTAMPTZ,                     -- kapan cron deliver (push notif)
  opened_at    TIMESTAMPTZ,                     -- kapan receiver buka

  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_capsules_sender_id   ON public.capsules(sender_id);
CREATE INDEX idx_capsules_receiver_id ON public.capsules(receiver_id);
CREATE INDEX idx_capsules_couple_id   ON public.capsules(couple_id);
CREATE INDEX idx_capsules_opens_at    ON public.capsules(opens_at) WHERE status = 'locked';
CREATE INDEX idx_capsules_status      ON public.capsules(status);

-- Auto update updated_at
CREATE TRIGGER trg_capsules_updated_at
  BEFORE UPDATE ON public.capsules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.capsules ENABLE ROW LEVEL SECURITY;

-- Sender & receiver bisa lihat
CREATE POLICY "capsules_select_couple"
  ON public.capsules FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Hanya sender yang bisa buat
CREATE POLICY "capsules_insert_sender"
  ON public.capsules FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND receiver_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
    AND couple_id = LEAST(
      auth.uid(),
      (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
    AND opens_at > CURRENT_DATE  -- harus di masa depan
  );

-- Update: receiver bisa ubah status ke 'opened', sender tidak bisa baca isi milik receiver
CREATE POLICY "capsules_update_open"
  ON public.capsules FOR UPDATE
  USING (receiver_id = auth.uid() AND status = 'delivered');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.capsules;
