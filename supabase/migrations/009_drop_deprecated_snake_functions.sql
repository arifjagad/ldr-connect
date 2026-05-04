-- ============================================================
-- LDR-Connect: Migration 009 — Drop deprecated snake functions
-- Jalankan SETELAH 008_atomic_snake_and_cancel.sql
--
-- Fungsi-fungsi ini merujuk ke game_snake_sessions yang sudah
-- dihapus di migration 006. Tidak ada kode yang memanggilnya.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_snake_session(UUID, VARCHAR, JSONB, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.join_snake_session(UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.get_active_snake_session_for_couple(UUID);
