-- =====================================================================
-- REALTIME SUBSCRIPTION FOR WALLETS & COIN TRANSACTIONS
-- =====================================================================
-- Memastikan tabel public.wallets dan public.coin_transactions masuk
-- ke publication supabase_realtime agar event postgres_changes
-- dapat didengar oleh client realtime subscription.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coin_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_transactions;
  END IF;
END $$;
