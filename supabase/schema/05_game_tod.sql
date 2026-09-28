-- ============================================================
-- LDR-Connect Schema — 05 Game — Truth or Dare
-- Jalankan SETELAH 04_games_core.sql
--
-- Pool pertanyaan ToD + answer_tod_question.
-- ============================================================

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

CREATE TRIGGER trg_game_tod_questions_updated_at
  BEFORE UPDATE ON public.game_tod_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.game_tod_questions     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- game_tod_questions
-- ============================================================

-- Baca pertanyaan global (admin seed)
CREATE POLICY "game_tod_questions_select_global"
  ON public.game_tod_questions FOR SELECT
  USING (is_active = true AND couple_id IS NULL);

-- Baca pertanyaan couple sendiri
CREATE POLICY "game_tod_questions_select_own_couple"
  ON public.game_tod_questions FOR SELECT
  USING (
    is_active = true
    AND couple_id = LEAST(auth.uid(), public.get_my_partner_id())
  );

-- User submit pertanyaan (is_active HARUS false, source HARUS 'user')
CREATE POLICY "game_tod_questions_insert_user"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND is_active = false
    AND source = 'user'
    AND couple_id IS NOT NULL
  );

-- Admin: baca semua (termasuk pending)
CREATE POLICY "game_tod_questions_select_admin"
  ON public.game_tod_questions FOR SELECT
  USING (public.is_admin());

-- Admin: approve/reject
CREATE POLICY "game_tod_questions_update_admin"
  ON public.game_tod_questions FOR UPDATE
  USING (public.is_admin());

-- Admin: seed pertanyaan global
CREATE POLICY "game_tod_questions_insert_admin"
  ON public.game_tod_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- FUNCTION: answer_tod_question
-- Tandai pertanyaan ToD selesai + ambil pertanyaan berikutnya
-- Dipanggil dari: POST /api/game/tod/session/{code}/next
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_tod_question(
  p_user_id        UUID,
  p_session_code   VARCHAR(12),
  p_question_order INTEGER,
  p_skip           BOOLEAN DEFAULT false
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

  -- p_skip=true (dipanggil dari "Skip"): tandai selesai TAPI answered_by tetap
  -- NULL dan is_skipped=true, supaya progres tetap persist ke DB (tidak desync
  -- antar-partner) namun kartu ini tidak terhitung "dijawab" di statistik.
  v_questions := (
    SELECT jsonb_agg(
      CASE
        WHEN (q->>'order')::int = p_question_order
        THEN q || jsonb_build_object(
          'is_completed', true,
          'is_skipped',   p_skip,
          'answered_by',  CASE WHEN p_skip THEN NULL ELSE p_user_id::text END
        )
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
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.answer_tod_question(UUID, VARCHAR, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
