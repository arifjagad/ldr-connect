-- ============================================================
-- LDR-Connect: Migration 014 — Dare Derby Tables
-- Jalankan SETELAH 013_fix_active_session_gametype.sql
--
-- Perubahan:
--   1. Tambah 'dare_derby' ke CHECK constraint game_sessions.game_type
--   2. CREATE TABLE game_dare_questions  (pool dare dari admin)
--   3. CREATE TABLE game_minigame_configs (metadata mini-game)
--   4. RLS untuk kedua tabel baru
-- ============================================================

-- ============================================================
-- 1. Update CHECK constraint game_sessions.game_type
-- ============================================================
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN ('tod', 'snake_ladder', 'quiz', 'dare_derby'));

-- ============================================================
-- 2. TABLE: game_dare_questions
--    Pool dare yang ditampilkan ke loser tiap ronde.
--    Diisi via migration seed (016) dan admin dashboard.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_dare_questions (
  id         BIGSERIAL   PRIMARY KEY,
  category   VARCHAR(20) NOT NULL
               CHECK (category IN ('sweet', 'funny', 'bold', 'challenge')),
  content    TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dare_q_category ON public.game_dare_questions(category);
CREATE INDEX IF NOT EXISTS idx_dare_q_active   ON public.game_dare_questions(is_active);

COMMENT ON TABLE  public.game_dare_questions          IS 'Pool dare untuk game Dare Derby';
COMMENT ON COLUMN public.game_dare_questions.category IS 'sweet | funny | bold | challenge';

-- RLS: hanya service role yang bisa write; authenticated bisa read aktif
ALTER TABLE public.game_dare_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dare_questions_select_active"
  ON public.game_dare_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "dare_questions_all_admin"
  ON public.game_dare_questions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 3. TABLE: game_minigame_configs
--    Metadata untuk setiap mini-game: id, nama, kategori,
--    durasi, dan config tambahan (difficulty, dll).
--    Diisi via migration seed (016).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_minigame_configs (
  id         BIGSERIAL    PRIMARY KEY,
  game_id    VARCHAR(50)  UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  category   VARCHAR(10)  NOT NULL
               CHECK (category IN ('reflex', 'brain', 'skill')),
  duration   INTEGER      NOT NULL CHECK (duration > 0),  -- detik
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  config     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minigame_category  ON public.game_minigame_configs(category);
CREATE INDEX IF NOT EXISTS idx_minigame_is_active ON public.game_minigame_configs(is_active);

COMMENT ON TABLE  public.game_minigame_configs          IS 'Metadata mini-game Dare Derby';
COMMENT ON COLUMN public.game_minigame_configs.game_id  IS 'ID unik: tap_timing, memory_seq, dll';
COMMENT ON COLUMN public.game_minigame_configs.duration IS 'Durasi max mini-game dalam detik';
COMMENT ON COLUMN public.game_minigame_configs.config   IS 'Config tambahan: difficulty, dll (JSONB)';

-- RLS: semua authenticated bisa read; hanya admin yang bisa write
ALTER TABLE public.game_minigame_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_configs_select_active"
  ON public.game_minigame_configs FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "minigame_configs_all_admin"
  ON public.game_minigame_configs FOR ALL
  USING (public.is_admin());
