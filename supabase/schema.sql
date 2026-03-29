-- Equity Engine — run in Supabase SQL editor (once per project).

create extension if not exists "pgcrypto";

-- Households & pairing
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text default 'Home',
  invite_code text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz default now()
);

alter table public.households add column if not exists created_by uuid references auth.users (id);
alter table public.households add column if not exists chore_presets_onboarded_at timestamptz;
alter table public.households add column if not exists chore_vp_low numeric;
alter table public.households add column if not exists chore_vp_medium numeric;
alter table public.households add column if not exists chore_vp_high numeric;
alter table public.households add column if not exists chore_vp_pending_low numeric;
alter table public.households add column if not exists chore_vp_pending_medium numeric;
alter table public.households add column if not exists chore_vp_pending_high numeric;

alter table public.contributions add column if not exists proof_storage_path text;
alter table public.contributions add column if not exists proof_captured_at timestamptz;
alter table public.contributions add column if not exists proof_after_storage_path text;
alter table public.contributions add column if not exists proof_after_captured_at timestamptz;
alter table public.contributions add column if not exists effort_revision_pending boolean not null default false;
alter table public.contributions add column if not exists pending_effort text;
alter table public.contributions add column if not exists pending_vp numeric;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  member_slot text not null check (member_slot in ('a', 'b')),
  created_at timestamptz default now(),
  unique (household_id, member_slot)
);

alter table public.households add column if not exists chore_vp_pending_requested_by uuid references public.profiles (id) on delete set null;

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('provision', 'chore')),
  amount_cents int,
  effort text check (effort in ('high', 'medium', 'low')),
  vp numeric not null,
  note text,
  week_start date not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  chore_source text check (chore_source is null or chore_source in ('preset', 'custom')),
  proof_storage_path text,
  proof_captured_at timestamptz,
  effort_revision_pending boolean not null default false,
  pending_effort text,
  pending_vp numeric,
  created_at timestamptz default now(),
  constraint contributions_provision_cents check (
    kind <> 'provision' or amount_cents is not null
  ),
  constraint contributions_chore_effort check (
    kind <> 'chore' or effort is not null
  ),
  constraint contributions_pending_effort_check check (
    pending_effort is null or pending_effort in ('low', 'medium', 'high')
  )
);

create index if not exists contributions_household_week on public.contributions (household_id, week_start);
create index if not exists contributions_created on public.contributions (created_at desc);

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

-- RLS helper: current user’s household (bypasses RLS inside function body)
create or replace function public.auth_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from public.profiles where id = auth.uid() limit 1;
$$;

revoke all on function public.auth_household_id() from public;
grant execute on function public.auth_household_id() to authenticated;
grant execute on function public.auth_household_id() to anon;

-- Invite join: resolve code without SELECT on households under RLS
create or replace function public.household_id_by_invite(p_code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.households
  where upper(trim(invite_code)) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.household_id_by_invite(text) from public;
grant execute on function public.household_id_by_invite(text) to authenticated;
grant execute on function public.household_id_by_invite(text) to anon;

-- Effective chore VP per tier (defaults 15 / 30 / 50 when override is null).
create or replace function public.effective_chore_vp_for_household(p_household uuid, p_effort text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case p_effort
    when 'low' then coalesce(
      (select h.chore_vp_low from public.households h where h.id = p_household),
      15::numeric
    )
    when 'medium' then coalesce(
      (select h.chore_vp_medium from public.households h where h.id = p_household),
      30::numeric
    )
    when 'high' then coalesce(
      (select h.chore_vp_high from public.households h where h.id = p_household),
      50::numeric
    )
  end;
$$;

revoke all on function public.effective_chore_vp_for_household(uuid, text) from public;
grant execute on function public.effective_chore_vp_for_household(uuid, text) to authenticated;

-- Join flow: slot choice before caller has a profile (cannot read profiles yet)
create or replace function public.next_member_slot(p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  has_a boolean;
begin
  select count(*)::int into n from public.profiles where household_id = p_household;
  if n >= 2 then
    return null;
  end if;
  select exists(
    select 1 from public.profiles
    where household_id = p_household and member_slot = 'a'
  ) into has_a;
  if has_a then return 'b'; else return 'a'; end if;
end;
$$;

revoke all on function public.next_member_slot(uuid) from public;
grant execute on function public.next_member_slot(uuid) to authenticated;
grant execute on function public.next_member_slot(uuid) to anon;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.contributions enable row level security;
alter table public.household_chore_presets enable row level security;

drop policy if exists "households_member_select" on public.households;
drop policy if exists "households_authenticated_insert" on public.households;
drop policy if exists "households_member_update" on public.households;
drop policy if exists "profiles_select_household" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "contributions_select_household" on public.contributions;
drop policy if exists "contributions_insert_self" on public.contributions;
drop policy if exists "contributions_partner_review" on public.contributions;
drop policy if exists "household_chore_presets_select" on public.household_chore_presets;
drop policy if exists "household_chore_presets_insert" on public.household_chore_presets;
drop policy if exists "household_chore_presets_delete" on public.household_chore_presets;

-- created_by lets the creator read the row returned by insert().select() before profile exists
create policy "households_member_select"
  on public.households for select
  using (
    id = public.auth_household_id()
    or created_by = auth.uid()
  );

create policy "households_authenticated_insert"
  on public.households for insert
  to authenticated
  with check (true);

create policy "households_member_update"
  on public.households for update
  to authenticated
  using (id = public.auth_household_id())
  with check (id = public.auth_household_id());

create policy "profiles_select_household"
  on public.profiles for select
  using (
    id = auth.uid()
    or household_id = public.auth_household_id()
  );

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "contributions_select_household"
  on public.contributions for select
  using (household_id = public.auth_household_id());

create policy "contributions_insert_self"
  on public.contributions for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and household_id = public.auth_household_id()
    and status in ('pending', 'approved')
  );

create policy "contributions_partner_review"
  on public.contributions for update
  to authenticated
  using (
    household_id = public.auth_household_id()
    and profile_id <> auth.uid()
    and status = 'pending'
  )
  with check (
    household_id = public.auth_household_id()
    and status in ('approved', 'rejected')
  );

create policy "household_chore_presets_select"
  on public.household_chore_presets for select
  using (household_id = public.auth_household_id());

create policy "household_chore_presets_insert"
  on public.household_chore_presets for insert
  to authenticated
  with check (household_id = public.auth_household_id());

create policy "household_chore_presets_delete"
  on public.household_chore_presets for delete
  to authenticated
  using (household_id = public.auth_household_id());

-- Proof files (camera + receipt / bank statement) — private bucket, path: {household_id}/{contribution_id}.ext
insert into storage.buckets (id, name, public, file_size_limit)
values ('contribution-proofs', 'contribution-proofs', false, 10485760)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "contribution_proofs_select" on storage.objects;
drop policy if exists "contribution_proofs_insert" on storage.objects;
drop policy if exists "contribution_proofs_update" on storage.objects;
drop policy if exists "contribution_proofs_delete" on storage.objects;

create policy "contribution_proofs_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contribution-proofs'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "contribution_proofs_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contribution-proofs'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "contribution_proofs_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'contribution-proofs'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.profiles where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'contribution-proofs'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "contribution_proofs_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contribution-proofs'
    and (storage.foldername(name))[1] = (
      select household_id::text from public.profiles where id = auth.uid()
    )
  );

-- Effort revision on approved chores (partner approves)
create or replace function public.request_effort_revision(p_contribution uuid, p_new_effort text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.contributions%rowtype;
  v_household uuid;
  new_vp numeric;
begin
  if p_new_effort not in ('low', 'medium', 'high') then
    raise exception 'invalid effort';
  end if;

  select * into r from public.contributions where id = p_contribution for update;
  if not found then
    raise exception 'not found';
  end if;
  if r.profile_id is distinct from auth.uid() then
    raise exception 'not owner';
  end if;
  if r.kind <> 'chore' or r.status <> 'approved' then
    raise exception 'invalid state';
  end if;
  if coalesce(r.effort_revision_pending, false) then
    raise exception 'already pending';
  end if;
  select household_id into v_household from public.profiles where id = auth.uid();
  if v_household is null or r.household_id is distinct from v_household then
    raise exception 'wrong household';
  end if;
  if r.effort = p_new_effort then
    raise exception 'same effort';
  end if;

  new_vp := public.effective_chore_vp_for_household(r.household_id, p_new_effort);

  update public.contributions
  set
    pending_effort = p_new_effort,
    pending_vp = new_vp,
    effort_revision_pending = true
  where id = p_contribution;
end;
$$;

create or replace function public.cancel_effort_revision(p_contribution uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.contributions
  set
    pending_effort = null,
    pending_vp = null,
    effort_revision_pending = false
  where id = p_contribution
    and profile_id = auth.uid()
    and coalesce(effort_revision_pending, false) = true
  returning id into v_id;

  if v_id is null then
    raise exception 'not found or not pending';
  end if;
end;
$$;

create or replace function public.resolve_effort_revision(p_contribution uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.contributions%rowtype;
  v_partner uuid;
begin
  select * into r from public.contributions where id = p_contribution for update;
  if not found then
    raise exception 'not found';
  end if;
  if not coalesce(r.effort_revision_pending, false) then
    raise exception 'no pending revision';
  end if;

  v_partner := auth.uid();
  if r.profile_id = v_partner then
    raise exception 'owner cannot resolve';
  end if;
  if r.household_id <> (select household_id from public.profiles where id = v_partner limit 1) then
    raise exception 'wrong household';
  end if;

  if p_approve then
    update public.contributions
    set
      effort = r.pending_effort,
      vp = r.pending_vp,
      pending_effort = null,
      pending_vp = null,
      effort_revision_pending = false,
      reviewed_by = v_partner,
      reviewed_at = now()
    where id = p_contribution;
  else
    update public.contributions
    set
      pending_effort = null,
      pending_vp = null,
      effort_revision_pending = false,
      reviewed_by = v_partner,
      reviewed_at = now()
    where id = p_contribution;
  end if;
end;
$$;

revoke all on function public.request_effort_revision(uuid, text) from public;
revoke all on function public.cancel_effort_revision(uuid) from public;
revoke all on function public.resolve_effort_revision(uuid, boolean) from public;

grant execute on function public.request_effort_revision(uuid, text) to authenticated;
grant execute on function public.cancel_effort_revision(uuid) to authenticated;
grant execute on function public.resolve_effort_revision(uuid, boolean) to authenticated;

-- Household chore VP overrides (partner approves when two members).
create or replace function public.propose_household_chore_vp(
  p_low numeric,
  p_medium numeric,
  p_high numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_count int;
  v_me uuid := auth.uid();
begin
  v_household := public.auth_household_id();
  if v_household is null then
    raise exception 'no household';
  end if;

  if p_low < 1 or p_low > 999 or p_medium < 1 or p_medium > 999 or p_high < 1 or p_high > 999 then
    raise exception 'each VP must be between 1 and 999';
  end if;

  select count(*)::int into v_count from public.profiles where household_id = v_household;

  if v_count <= 1 then
    update public.households
    set
      chore_vp_low = case when p_low = 15 then null else p_low end,
      chore_vp_medium = case when p_medium = 30 then null else p_medium end,
      chore_vp_high = case when p_high = 50 then null else p_high end,
      chore_vp_pending_low = null,
      chore_vp_pending_medium = null,
      chore_vp_pending_high = null,
      chore_vp_pending_requested_by = null
    where id = v_household;
    return;
  end if;

  if exists (
    select 1 from public.households h
    where h.id = v_household
      and h.chore_vp_pending_low is not null
  ) then
    raise exception 'a chore VP change is already waiting for approval';
  end if;

  update public.households
  set
    chore_vp_pending_low = p_low,
    chore_vp_pending_medium = p_medium,
    chore_vp_pending_high = p_high,
    chore_vp_pending_requested_by = v_me
  where id = v_household;
end;
$$;

create or replace function public.cancel_household_chore_vp_proposal()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_me uuid := auth.uid();
  v_id uuid;
begin
  v_household := public.auth_household_id();
  if v_household is null then
    raise exception 'no household';
  end if;

  update public.households
  set
    chore_vp_pending_low = null,
    chore_vp_pending_medium = null,
    chore_vp_pending_high = null,
    chore_vp_pending_requested_by = null
  where id = v_household
    and chore_vp_pending_requested_by = v_me
    and chore_vp_pending_low is not null
  returning id into v_id;

  if v_id is null then
    raise exception 'nothing to cancel';
  end if;
end;
$$;

create or replace function public.resolve_household_chore_vp(p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_me uuid := auth.uid();
  h public.households%rowtype;
begin
  v_household := public.auth_household_id();
  if v_household is null then
    raise exception 'no household';
  end if;

  select * into h from public.households where id = v_household for update;
  if h.chore_vp_pending_low is null then
    raise exception 'no pending proposal';
  end if;
  if h.chore_vp_pending_requested_by is null or h.chore_vp_pending_requested_by = v_me then
    raise exception 'partner must approve or reject';
  end if;

  if p_approve then
    update public.households
    set
      chore_vp_low = case when h.chore_vp_pending_low = 15 then null else h.chore_vp_pending_low end,
      chore_vp_medium = case when h.chore_vp_pending_medium = 30 then null else h.chore_vp_pending_medium end,
      chore_vp_high = case when h.chore_vp_pending_high = 50 then null else h.chore_vp_pending_high end,
      chore_vp_pending_low = null,
      chore_vp_pending_medium = null,
      chore_vp_pending_high = null,
      chore_vp_pending_requested_by = null
    where id = v_household;
  else
    update public.households
    set
      chore_vp_pending_low = null,
      chore_vp_pending_medium = null,
      chore_vp_pending_high = null,
      chore_vp_pending_requested_by = null
    where id = v_household;
  end if;
end;
$$;

revoke all on function public.propose_household_chore_vp(numeric, numeric, numeric) from public;
revoke all on function public.cancel_household_chore_vp_proposal() from public;
revoke all on function public.resolve_household_chore_vp(boolean) from public;

grant execute on function public.propose_household_chore_vp(numeric, numeric, numeric) to authenticated;
grant execute on function public.cancel_household_chore_vp_proposal() to authenticated;
grant execute on function public.resolve_household_chore_vp(boolean) to authenticated;

-- Full reset: contributions, delegations, presets, household VP overrides (proof files removed client-side).
create or replace function public.reset_household_equity_data(p_confirm text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  if upper(trim(p_confirm)) <> 'RESET' then
    raise exception 'confirmation required';
  end if;

  v_household := public.auth_household_id();
  if v_household is null then
    raise exception 'no household';
  end if;

  delete from public.contributions where household_id = v_household;
  delete from public.delegation_requests where household_id = v_household;
  delete from public.household_chore_presets where household_id = v_household;

  update public.households
  set
    chore_vp_low = null,
    chore_vp_medium = null,
    chore_vp_high = null,
    chore_vp_pending_low = null,
    chore_vp_pending_medium = null,
    chore_vp_pending_high = null,
    chore_vp_pending_requested_by = null,
    chore_presets_onboarded_at = null
  where id = v_household;
end;
$$;

revoke all on function public.reset_household_equity_data(text) from public;
grant execute on function public.reset_household_equity_data(text) to authenticated;

-- Leave current household (delete own profile; cascades remove your contributions).
create or replace function public.leave_household(p_confirm text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(trim(p_confirm)) <> 'LEAVE' then
    raise exception 'type LEAVE to confirm';
  end if;

  delete from public.profiles where id = auth.uid();
end;
$$;

revoke all on function public.leave_household(text) from public;
grant execute on function public.leave_household(text) to authenticated;
