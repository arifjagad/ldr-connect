-- ============================================================
-- LDR-Connect: Migration 034 — Photobooth Storage Bucket
-- ============================================================
-- Isi:
--   1. Buat bucket storage 'photobooth' (public = true)
--   2. Storage policies untuk read (public) dan write (admin/service)
-- ============================================================

-- 1. Create public bucket 'photobooth'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photobooth',
  'photobooth',
  true,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 10485760,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- 2. Storage Policies
-- Siapa saja (termasuk unauthenticated/public) bisa melihat/mendownload gambar frame
DROP POLICY IF EXISTS "photobooth_public_read" ON storage.objects;
CREATE POLICY "photobooth_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photobooth');

-- Hanya admin / service role yang dapat mengunggah file frame
DROP POLICY IF EXISTS "photobooth_admin_insert" ON storage.objects;
CREATE POLICY "photobooth_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));

-- Hanya admin / service role yang dapat mengupdate file frame
DROP POLICY IF EXISTS "photobooth_admin_update" ON storage.objects;
CREATE POLICY "photobooth_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));

-- Hanya admin / service role yang dapat menghapus file frame
DROP POLICY IF EXISTS "photobooth_admin_delete" ON storage.objects;
CREATE POLICY "photobooth_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photobooth' AND (public.is_admin() OR auth.role() = 'service_role'));
