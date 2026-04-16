-- ============================================================
-- LDR-Connect: Migration 007 — Fix ambiguous create_game_session
--
-- Masalah: Ada 2 overloaded version dari create_game_session:
--   1. Versi lama (003): 6 param — tanpa p_board_config & p_game_state
--   2. Versi baru (006): 8 param — dengan p_board_config & p_game_state (ber-default)
--
-- PostgreSQL tidak bisa memilih antara keduanya saat dipanggil
-- dengan 6 named param → "could not choose the best candidate function"
--
-- Solusi: drop versi lama yang 6-param, cukup pakai yang 8-param
-- (yang lama sudah ter-replace oleh 003 tapi dengan signature berbeda,
--  jadi masih ada dua versi di pg_proc)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_game_session(
  UUID,
  VARCHAR(12),
  VARCHAR(20),
  JSONB,
  INTEGER,
  TIMESTAMPTZ
);
