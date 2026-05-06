-- ============================================================
-- Migration 018: Fix confirm_dare_derby_dare — gunakan lobby phase
--
-- Bug: setelah dare dikonfirmasi, ronde berikutnya langsung masuk
-- phase='playing'. updated_at di-set saat dare confirm, bukan saat
-- mini-game benar-benar dimulai. Jika dare-phase > durasi mini-game,
-- timer mini-game langsung 0 saat halaman di-render.
--
-- Fix: setelah dare confirm, masuk phase='lobby' dengan
-- ready={host:false, partner:false}. Mini-game baru mulai setelah
-- kedua player tekan "Siap!" via ready_up_dare_derby, yang
-- meng-update updated_at saat itu (menjadi acuan startedAt).
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_dare_derby_dare(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_confirmed    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session       public.game_sessions;
  v_gs            JSONB;
  v_bc            JSONB;
  v_my_role       TEXT;
  v_last_result   JSONB;
  v_loser         TEXT;
  v_current_round INTEGER;
  v_total_rounds  INTEGER;
  v_new_gs        JSONB;
  v_new_questions JSONB;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type    = 'dare_derby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  v_gs := v_session.game_state;
  v_bc := v_session.board_config;

  IF v_gs->>'phase' != 'result' THEN
    RAISE EXCEPTION 'WRONG_PHASE'
      USING DETAIL = 'Bukan fase konfirmasi dare';
  END IF;

  v_last_result := v_gs->'last_round_result';

  IF v_last_result->>'dare_status' != 'awaiting_confirm' THEN
    RAISE EXCEPTION 'DARE_NOT_AWAITING'
      USING DETAIL = 'Dare belum ditandai selesai oleh yang kalah';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_my_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_my_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION';
  END IF;

  v_loser         := v_last_result->>'loser';
  v_current_round := (v_gs->>'current_round')::int;
  v_total_rounds  := (v_bc->>'total_rounds')::int;

  IF v_my_role = v_loser THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_OWN'
      USING DETAIL = 'Kamu tidak bisa konfirmasi dare milikmu sendiri';
  END IF;

  IF p_confirmed THEN
    -- Dare diterima → tandai selesai
    v_new_questions := (
      SELECT jsonb_agg(
        CASE
          WHEN (q->>'round_number')::int = v_current_round
               AND q->>'loser' = v_loser
          THEN q || jsonb_build_object(
                 'dare_status',  'completed',
                 'confirmed_at', now()::text
               )
          ELSE q
        END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );

    IF v_current_round >= v_total_rounds THEN
      -- Game over
      v_new_gs := v_gs || jsonb_build_object(
        'phase',             'game_over',
        'last_round_result', v_last_result || jsonb_build_object(
          'dare_status', 'completed', 'confirmed_at', now()::text
        )
      );

      UPDATE public.game_sessions
      SET game_state = v_new_gs,
          questions  = v_new_questions,
          status     = 'completed',
          updated_at = now()
      WHERE id = v_session.id;
    ELSE
      -- Lanjut ke ronde berikutnya — masuk LOBBY dulu agar ready_up
      -- meng-update updated_at saat mini-game benar-benar dimulai.
      v_new_gs := v_gs || jsonb_build_object(
        'phase',             'lobby',
        'current_round',     v_current_round + 1,
        'is_replay_round',   false,
        'ready',             jsonb_build_object('host', false, 'partner', false),
        'round_submissions', jsonb_build_object('host', NULL, 'partner', NULL),
        'last_round_result', v_last_result || jsonb_build_object(
          'dare_status', 'completed', 'confirmed_at', now()::text
        )
      );

      UPDATE public.game_sessions
      SET game_state = v_new_gs,
          questions  = v_new_questions,
          updated_at = now()
      WHERE id = v_session.id;
    END IF;
  ELSE
    -- Dare ditolak → loser harus ulangi (kembali ke 'pending')
    v_new_questions := (
      SELECT jsonb_agg(
        CASE
          WHEN (q->>'round_number')::int = v_current_round
               AND q->>'loser' = v_loser
          THEN q || jsonb_build_object('dare_status', 'pending')
          ELSE q
        END
      )
      FROM jsonb_array_elements(v_session.questions) q
    );

    v_new_gs := v_gs || jsonb_build_object(
      'last_round_result',
      v_last_result || jsonb_build_object('dare_status', 'pending')
    );

    UPDATE public.game_sessions
    SET game_state = v_new_gs,
        questions  = v_new_questions,
        updated_at = now()
    WHERE id = v_session.id;
  END IF;

  RETURN v_new_gs;
END;
$$;
