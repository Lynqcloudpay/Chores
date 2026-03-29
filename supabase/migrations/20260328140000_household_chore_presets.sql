-- Approved custom chores become household-specific preset options.

alter table public.contributions
  add column if not exists chore_source text
    check (chore_source is null or chore_source in ('preset', 'custom'));

create table if not exists public.household_chore_presets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  effort text not null check (effort in ('low', 'medium', 'high')),
  label text not null,
  created_at timestamptz default now(),
  unique (household_id, effort, label)
);

create index if not exists household_chore_presets_household_effort
  on public.household_chore_presets (household_id, effort);

alter table public.household_chore_presets enable row level security;

drop policy if exists "household_chore_presets_select" on public.household_chore_presets;
drop policy if exists "household_chore_presets_insert" on public.household_chore_presets;

create policy "household_chore_presets_select"
  on public.household_chore_presets for select
  using (household_id = public.auth_household_id());

create policy "household_chore_presets_insert"
  on public.household_chore_presets for insert
  to authenticated
  with check (household_id = public.auth_household_id());
