-- ============================================================
-- LDR-Connect: Migration 038 — Audit Bug Fixes (Game: Truth or Dare)
-- Jalankan SETELAH 037_couple_features_hardening.sql
-- ============================================================
-- Isi (ditemukan saat audit menyeluruh game ToD, berlaku juga untuk
-- game lain yang memakai create_game_session/refund_expired_session
-- karena fungsinya dipakai bersama — snake_ladder, dare_derby, quoridor,
-- photobooth):
--
--   1. Race condition create_game_session — dua create bersamaan (double
--      klik, dua tab, dsb.) untuk couple yang sama bisa lolos cek EXISTS
--      sebelum salah satu meng-INSERT, menghasilkan 2 sesi aktif sekaligus.
--      Fix: pg_advisory_xact_lock per couple_id sebelum cek/insert.
--
--   2. Coin hilang tanpa refund — auto-expire sesi lama di
--      create_game_session (dan di setiap route session/create) langsung
--      UPDATE status='expired' tanpa memanggil refund_expired_session.
--      Begitu status bukan 'waiting' lagi, expire_waiting_sessions() (yang
--      seharusnya me-refund) tidak akan menyentuhnya lagi -> coin host
--      hilang permanen untuk sesi yang partner-nya tidak sempat join.
--      Fix: create_game_session sekarang memanggil refund_expired_session
--      untuk tiap sesi 'waiting' yang expired sebelum membuat sesi baru.
--
--   3. expire_waiting_sessions() TIDAK PERNAH dipanggil siapa pun — tidak
--      ada entry di vercel.json, tidak ada API route yang memanggilnya.
--      Akibatnya sesi 'waiting' yang ditelantarkan (host tutup tab tanpa
--      cancel, TIDAK membuat sesi baru lagi) tidak pernah di-refund sama
--      sekali kecuali lewat jalur no.2 di atas (yang sebelum fix ini malah
--      skip refund). Fix: tambah cron endpoint baru
--      GET /api/cron/expire-sessions (lihat kode aplikasi) + daftar di
--      vercel.json, jadwal 1x/hari (Vercel Hobby limit) mengikuti pola
--      expire-topup. Migration ini HANYA berisi perubahan SQL; endpoint
--      barunya ada di app/api/cron/expire-sessions/route.ts.
--
--   4. answer_tod_question — tambah parameter p_skip agar tombol "Skip"
--      di ToD bisa PERSIST progres ke DB (sebelumnya /next hanya baca,
--      tidak menulis, menyebabkan desync progress antar-partner dan sesi
--      tidak pernah pindah ke status 'completed' walau semua kartu sudah
--      di-skip). Kartu yang di-skip ditandai is_completed=true,
--      is_skipped=true, answered_by=NULL (tidak terhitung "dijawab").
-- ============================================================

-- ============================================================
-- 1 & 2. FUNCTION: create_game_session (advisory lock + refund saat auto-expire)
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
-- 4. FUNCTION: answer_tod_question (+ parameter p_skip)
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
