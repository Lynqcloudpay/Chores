-- Allow deleting your own contributions shortly after insert (e.g. rollback when partner-ask finalize fails).

drop policy if exists "contributions_delete_own_fresh" on public.contributions;

create policy "contributions_delete_own_fresh"
  on public.contributions for delete
  to authenticated
  using (
    profile_id = auth.uid()
    and household_id = public.auth_household_id()
    and created_at > now() - interval '30 minutes'
  );
