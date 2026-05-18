-- Migration: Add avatar_url to users table
-- Jalankan di Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Buat bucket Storage untuk avatar (jalankan manual di Dashboard Storage jika gagal via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
