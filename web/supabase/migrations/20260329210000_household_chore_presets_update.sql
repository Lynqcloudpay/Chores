-- Allow household members to rename saved chore shortcut labels.
drop policy if exists "household_chore_presets_update" on public.household_chore_presets;

create policy "household_chore_presets_update"
  on public.household_chore_presets for update
  to authenticated
  using (household_id = public.auth_household_id())
  with check (household_id = public.auth_household_id());
