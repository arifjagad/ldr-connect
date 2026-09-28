-- ============================================================
-- LDR-Connect: Migration 043 — Bucket Storage `avatars`
-- Jalankan SETELAH 042_unlink_sessions_and_signup_atomic.sql
-- ============================================================
-- Bug: migration `add_avatar_url.sql` hanya menambah kolom users.avatar_url;
-- INSERT bucket-nya dibiarkan sebagai komentar ("jalankan manual di
-- Dashboard") dan tidak pernah dibuat. Per migration ini production tidak
-- punya bucket `avatars`, jadi POST /api/user/avatar selalu gagal dengan
-- "Bucket not found" (belum ada satu pun user dengan avatar_url).
--
-- Konfigurasi mengikuti app/api/user/avatar/route.ts:
--   - public = true  → route memakai getPublicUrl()
--   - 3 MB           → MAX_SIZE_MB = 3
--   - JPG/PNG/WebP/GIF → ALLOWED_TYPES
-- Tulis/hapus hanya lewat service role di API route, jadi tidak perlu policy
-- INSERT/UPDATE/DELETE untuk anon/authenticated.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  3145728, -- 3 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public             = true,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
