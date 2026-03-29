-- Let households mark chore list onboarding done and replace presets during setup.

alter table public.households
  add column if not exists chore_presets_onboarded_at timestamptz;

drop policy if exists "households_member_update" on public.households;

create policy "households_member_update"
  on public.households for update
  to authenticated
  using (id = public.auth_household_id())
  with check (id = public.auth_household_id());

drop policy if exists "household_chore_presets_delete" on public.household_chore_presets;

create policy "household_chore_presets_delete"
  on public.household_chore_presets for delete
  to authenticated
  using (household_id = public.auth_household_id());
