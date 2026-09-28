-- ============================================================
-- LDR-Connect Schema — 00 Utilitas bersama
-- Jalankan PERTAMA (setelah project Supabase dibuat)
--
-- Fungsi trigger updated_at yang dipakai hampir semua tabel.
-- ============================================================

-- ============================================================
-- TRIGGER FUNCTION: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
