-- Migration 021: Allow couple members to update each other's anniversaries
--
-- SELECT was already opened to couple in migration 020.
-- This extends UPDATE in the same way so both partners can edit.
-- DELETE remains owner-only to prevent accidental removal.

DROP POLICY IF EXISTS "anniversaries_update_own" ON public.anniversaries;

CREATE POLICY "anniversaries_update_couple"
  ON public.anniversaries FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
  );
