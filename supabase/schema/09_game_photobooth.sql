-- ============================================================
-- LDR-Connect Schema — 09 Game — Virtual Photobooth
-- Jalankan SETELAH 08_game_quoridor.sql
--
-- Template frame, bucket Storage (frame publik & foto privat), photobooth_action.
-- ============================================================

-- ============================================================
-- TABLE: game_photobooth_templates (migration 033)
-- Frame PNG transparan + koordinat slot foto.
-- ============================================================
CREATE TABLE public.game_photobooth_templates (
  id            BIGSERIAL    PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  image_url     TEXT         NOT NULL,
  thumbnail_url TEXT,
  aspect_ratio  VARCHAR(20)  NOT NULL DEFAULT '2:6', -- '2:6', '4:6', '1:1', dll
  canvas_width  INTEGER      NOT NULL DEFAULT 600,
  canvas_height INTEGER      NOT NULL DEFAULT 1800,
  photo_count   INTEGER      NOT NULL DEFAULT 3 CHECK (photo_count > 0),
  slots         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_photobooth_templates_is_active ON public.game_photobooth_templates(is_active);

COMMENT ON TABLE  public.game_photobooth_templates               IS 'Template frame PNG transparan untuk photobooth couple';
COMMENT ON COLUMN public.game_photobooth_templates.slots         IS 'Array koordinat slot foto: [{"index": 1, "x": 40, "y": 60, "width": 520, "height": 500, "rounded": 12}, ...]';
COMMENT ON COLUMN public.game_photobooth_templates.canvas_width  IS 'Lebar kanvas render resolusi tinggi (pixel)';
COMMENT ON COLUMN public.game_photobooth_templates.canvas_height IS 'Tinggi kanvas render resolusi tinggi (pixel)';

-- RLS: user login melihat template aktif, admin kelola semua.
ALTER TABLE public.game_photobooth_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_photobooth_templates_select"
  ON public.game_photobooth_templates FOR SELECT
  USING (is_active = true OR public.is_admin());

CREATE POLICY "game_photobooth_templates_admin_all"
  ON public.game_photobooth_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_photobooth_templates;

-- ============================================================
-- STORAGE: bucket photobooth — frame template, publik (migration 034)
-- Baca publik; tulis/hapus hanya admin atau service role.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photobooth',
  'photobooth',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public             = true,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "photobooth_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photobooth');

CREATE POLICY "photobooth_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));

CREATE POLICY "photobooth_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));

CREATE POLICY "photobooth_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));

-- ============================================================
-- STORAGE: bucket photobooth-captures — foto webcam pemain, PRIVAT (migration 041)
-- Tanpa policy anon/authenticated: hanya service role yang baca/tulis,
-- client melihat foto lewat signed URL dari API route setelah cek peserta.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photobooth-captures',
  'photobooth-captures',
  false,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = false,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- FUNCTION: photobooth_action (migration 040, foto ke Storage sejak 041)
-- Atomic gameplay photobooth: select_template | trigger_countdown |
-- submit_photo | retake | complete. SELECT ... FOR UPDATE mencegah foto
-- host/partner saling timpa (keduanya submit hampir bersamaan tiap slot)
-- dan bypass kuota retakes_left via request paralel.
-- Dipanggil dari: app/api/game/photobooth/session/[code]/* via
-- lib/games/photobooth/action.ts
-- ============================================================
CREATE OR REPLACE FUNCTION public.photobooth_action(
  p_session_code VARCHAR(12),
  p_user_id      UUID,
  p_action       VARCHAR(20),
  p_payload      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session    public.game_sessions;
  v_gs         JSONB;
  v_role       TEXT;
  v_phase      TEXT;
  v_now_ms     BIGINT := (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT;
  v_total      INTEGER;
  v_photos     JSONB;
  v_capture    JSONB;
  v_slot       INTEGER;
  v_next_slot  INTEGER;
  v_photo      JSONB;
  v_retakes    INTEGER;
  v_template   public.game_photobooth_templates;
  v_status     TEXT := 'playing';
  i            INTEGER;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE session_code = p_session_code
    AND game_type = 'photobooth'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING DETAIL = 'Sesi photobooth tidak ditemukan';
  END IF;

  IF v_session.host_user_id = p_user_id THEN
    v_role := 'host';
  ELSIF v_session.partner_user_id = p_user_id THEN
    v_role := 'partner';
  ELSE
    RAISE EXCEPTION 'NOT_IN_SESSION' USING DETAIL = 'Kamu bukan peserta sesi ini';
  END IF;

  IF v_session.status != 'playing' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE' USING DETAIL = 'Sesi tidak aktif';
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED' USING DETAIL = 'Waktu sesi sudah habis';
  END IF;

  v_gs      := COALESCE(v_session.game_state, '{}'::jsonb);
  v_phase   := COALESCE(v_gs->>'phase', 'ready');
  v_photos  := CASE WHEN jsonb_typeof(v_gs->'photos') = 'object' THEN v_gs->'photos' ELSE '{}'::jsonb END;
  v_capture := CASE WHEN jsonb_typeof(v_gs->'capture') = 'object' THEN v_gs->'capture' END;
  v_total   := COALESCE((v_session.board_config->'template'->>'photo_count')::INTEGER, 3);

  -- ══ SELECT TEMPLATE ═════════════════════════════════════════════════════
  IF p_action = 'select_template' THEN
    IF v_phase NOT IN ('selecting_template', 'ready') OR v_photos != '{}'::jsonb THEN
      RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Template hanya bisa diganti sebelum foto diambil';
    END IF;

    SELECT * INTO v_template
    FROM public.game_photobooth_templates
    WHERE id = (p_payload->>'template_id')::INTEGER
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TEMPLATE_NOT_FOUND' USING DETAIL = 'Template tidak ditemukan';
    END IF;

    v_session.board_config := jsonb_build_object('template', to_jsonb(v_template));
    v_gs := v_gs || jsonb_build_object(
      'template_id',          v_template.id,
      'phase',                'ready',
      'current_slot',         1,
      'countdown_started_at', NULL,
      'capture',              NULL,
      'photos',               '{}'::jsonb,
      'retakes_left',         COALESCE((v_gs->>'retakes_left')::INTEGER, 3)
    );

  -- ══ TRIGGER COUNTDOWN ═══════════════════════════════════════════════════
  ELSIF p_action = 'trigger_countdown' THEN
    IF jsonb_typeof(v_session.board_config->'template') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Pilih template terlebih dahulu';
    END IF;

    -- 'taking' yang macet (> 15 detik, misal kedua client gagal capture)
    -- boleh dipicu ulang supaya game tidak terkunci.
    IF NOT (
      v_phase = 'ready'
      OR (v_phase = 'taking'
          AND COALESCE((v_gs->>'countdown_started_at')::BIGINT, 0) < v_now_ms - 15000)
    ) THEN
      RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Countdown tidak bisa dimulai sekarang';
    END IF;

    v_slot := COALESCE((v_gs->>'current_slot')::INTEGER, 1);
    IF v_slot < 1 OR v_slot > v_total THEN
      v_slot := 1;
    END IF;

    v_gs := v_gs || jsonb_build_object(
      'phase',                'taking',
      'current_slot',         v_slot,
      'countdown_started_at', v_now_ms,
      'capture', jsonb_build_object(
        'slot',       v_slot,
        'started_at', v_now_ms,
        'submitted',  '[]'::jsonb
      )
    );

  -- ══ SUBMIT PHOTO ════════════════════════════════════════════════════════
  ELSIF p_action = 'submit_photo' THEN
    v_slot := (p_payload->>'slot_index')::INTEGER;

    IF v_capture IS NULL
       OR v_slot IS DISTINCT FROM (v_capture->>'slot')::INTEGER
       OR (v_capture->>'started_at')::BIGINT < v_now_ms - 60000 THEN
      RAISE EXCEPTION 'CAPTURE_CLOSED' USING DETAIL = 'Tidak ada sesi foto aktif untuk slot ini';
    END IF;

    IF (v_capture->'submitted') ? v_role THEN
      RAISE EXCEPTION 'ALREADY_SUBMITTED' USING DETAIL = 'Foto kamu untuk slot ini sudah terkirim';
    END IF;

    IF COALESCE(p_payload->>'image_path', '') !~ ('^' || p_session_code || '/') THEN
      RAISE EXCEPTION 'INVALID_IMAGE' USING DETAIL = 'Path foto tidak valid';
    END IF;

    -- Hapus *_image_url lama (base64 dari sebelum migration 041) supaya row
    -- tidak membengkak lagi.
    v_photo := (COALESCE(v_photos->(v_slot::TEXT), jsonb_build_object('slot_index', v_slot))
                - (v_role || '_image_url'))
      || jsonb_build_object(
        v_role || '_image_path', p_payload->>'image_path',
        'captured_at',           to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
    v_photos  := v_photos || jsonb_build_object(v_slot::TEXT, v_photo);
    v_capture := jsonb_set(v_capture, '{submitted}', (v_capture->'submitted') || to_jsonb(v_role));

    v_gs := v_gs || jsonb_build_object('photos', v_photos, 'capture', v_capture);

    -- Submit pertama di ronde ini yang memajukan phase. Submit kedua hanya
    -- melengkapi foto slot yang sama.
    IF v_phase = 'taking' THEN
      v_next_slot := NULL;
      FOR i IN 1..v_total LOOP
        IF NOT (v_photos ? i::TEXT) THEN
          v_next_slot := i;
          EXIT;
        END IF;
      END LOOP;

      IF v_next_slot IS NULL THEN
        v_gs := v_gs || jsonb_build_object(
          'phase', 'review_retake', 'current_slot', v_total, 'countdown_started_at', NULL
        );
      ELSE
        v_gs := v_gs || jsonb_build_object(
          'phase', 'ready', 'current_slot', v_next_slot, 'countdown_started_at', NULL
        );
      END IF;
    END IF;

  -- ══ RETAKE ══════════════════════════════════════════════════════════════
  ELSIF p_action = 'retake' THEN
    IF v_phase != 'review_retake' THEN
      RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Retake hanya bisa dilakukan saat review';
    END IF;

    v_slot := (p_payload->>'slot_index')::INTEGER;
    IF v_slot IS NULL OR v_slot < 1 OR v_slot > v_total THEN
      RAISE EXCEPTION 'INVALID_SLOT' USING DETAIL = 'Slot foto tidak valid';
    END IF;

    v_retakes := COALESCE((v_gs->>'retakes_left')::INTEGER, 3);
    IF v_retakes <= 0 THEN
      RAISE EXCEPTION 'NO_RETAKES_LEFT' USING DETAIL = 'Kuota retake foto sudah habis';
    END IF;

    v_gs := v_gs || jsonb_build_object(
      'phase',                'ready',
      'current_slot',         v_slot,
      'retakes_left',         v_retakes - 1,
      'countdown_started_at', NULL,
      'capture',              NULL
    );

  -- ══ COMPLETE ════════════════════════════════════════════════════════════
  ELSIF p_action = 'complete' THEN
    IF v_phase != 'review_retake' THEN
      RAISE EXCEPTION 'WRONG_PHASE' USING DETAIL = 'Selesaikan semua foto terlebih dahulu';
    END IF;

    v_status := 'completed';
    v_gs := v_gs || jsonb_build_object(
      'phase',                'completed',
      'completed_by',         v_role,
      'countdown_started_at', NULL,
      'capture',              NULL
    );

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION' USING DETAIL = 'Jenis aksi tidak dikenali';
  END IF;

  UPDATE public.game_sessions
  SET game_state   = v_gs,
      board_config = v_session.board_config,
      status       = v_status,
      updated_at   = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN to_jsonb(v_session);
END;
$$;

-- ============================================================
-- AKSES: RPC server-only (migration 039)
-- Hanya dipanggil dari API route via service role. SECURITY DEFINER tanpa
-- cek auth.uid(), jadi WAJIB di-REVOKE dari client — jangan di-GRANT balik.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.photobooth_action(VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
