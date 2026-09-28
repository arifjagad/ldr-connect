-- ============================================================
-- LDR-Connect Schema — 06 Game — Ular Tangga
-- Jalankan SETELAH 05_game_tod.sql
--
-- Pool pertanyaan tantangan + roll dadu & konfirmasi tantangan (atomik).
-- ============================================================

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

ALTER TABLE public.game_snake_questions   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- game_snake_questions
-- ============================================================
CREATE POLICY "snake_questions_select_active"
  ON public.game_snake_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

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
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.roll_snake_dice(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_snake_challenge(VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
