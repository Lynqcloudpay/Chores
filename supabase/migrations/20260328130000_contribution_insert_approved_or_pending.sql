-- Allow self-insert as approved (financial + preset chores) or pending (custom chore only).

drop policy if exists "contributions_insert_self" on public.contributions;

create policy "contributions_insert_self"
  on public.contributions for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and household_id = public.auth_household_id()
    and status in ('pending', 'approved')
  );
