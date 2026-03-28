-- App defaults: low 15, medium 30, high 50. Households may override via partner-approved proposal.

alter table public.households
  add column if not exists chore_vp_low numeric,
  add column if not exists chore_vp_medium numeric,
  add column if not exists chore_vp_high numeric,
  add column if not exists chore_vp_pending_low numeric,
  add column if not exists chore_vp_pending_medium numeric,
  add column if not exists chore_vp_pending_high numeric,
  add column if not exists chore_vp_pending_requested_by uuid references public.profiles (id) on delete set null;

comment on column public.households.chore_vp_low is 'Override VP for low effort; null = app default (15)';
comment on column public.households.chore_vp_medium is 'Override VP for medium effort; null = app default (30)';
comment on column public.households.chore_vp_high is 'Override VP for high effort; null = app default (50)';

-- Effective VP for a household tier (defaults 15 / 30 / 50).
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

-- Effort revision: use household effective VP for pending tier.
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

-- Delegation asks: base VP from household settings.
create or replace function public.create_delegation_request(
  p_assigned_to uuid,
  p_effort text,
  p_chore_label text,
  p_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_household uuid;
  v_requester_vp numeric;
  v_assignee_vp numeric;
  v_base numeric;
  v_penalty numeric;
  v_id uuid;
begin
  if p_effort not in ('low', 'medium', 'high') then
    raise exception 'invalid effort';
  end if;
  if length(trim(p_chore_label)) < 1 then
    raise exception 'chore label required';
  end if;

  select household_id into v_household from public.profiles where id = v_me;
  if v_household is null then
    raise exception 'no profile';
  end if;

  if p_assigned_to = v_me then
    raise exception 'cannot assign to self';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_assigned_to and p.household_id = v_household
  ) then
    raise exception 'assignee not in household';
  end if;

  v_requester_vp := public.approved_vp_this_week(v_household, p_week_start, v_me);
  v_assignee_vp := public.approved_vp_this_week(v_household, p_week_start, p_assigned_to);

  if v_requester_vp <= v_assignee_vp then
    raise exception 'only the partner with more VP this week can send an ask';
  end if;

  v_base := public.effective_chore_vp_for_household(v_household, p_effort);
  v_penalty := v_base * 2;

  insert into public.delegation_requests (
    household_id,
    week_start,
    requested_by,
    assigned_to,
    effort,
    chore_label,
    base_vp,
    penalty_vp,
    status
  ) values (
    v_household,
    p_week_start,
    v_me,
    p_assigned_to,
    p_effort,
    trim(p_chore_label),
    v_base,
    v_penalty,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Propose new low/medium/high VP for the home (partner must approve if two members).
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
