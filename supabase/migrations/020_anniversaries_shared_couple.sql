-- Migration 020: Anniversaries visible to both partners
--
-- Problem: anniversaries_select_own only allows user_id = auth.uid(),
-- so partners cannot see each other's anniversaries.
--
-- Fix: Replace SELECT policy so a user can also see anniversaries
-- created by their partner (partner_id in users table).
-- INSERT / UPDATE / DELETE remain owner-only.

DROP POLICY IF EXISTS "anniversaries_select_own" ON public.anniversaries;

CREATE POLICY "anniversaries_select_couple"
  ON public.anniversaries FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    user_id = (
      SELECT partner_id FROM public.users WHERE id = auth.uid()
    )
  );
