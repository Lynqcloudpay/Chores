-- Partner "asks": only the VP leader can assign a chore to the other; missed = 2x VP penalty.

create table if not exists public.delegation_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  effort text not null check (effort in ('low', 'medium', 'high')),
  chore_label text not null,
  base_vp numeric not null,
  penalty_vp numeric not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'penalized', 'cancelled')),
  completed_contribution_id uuid,
  penalty_contribution_id uuid,
  created_at timestamptz default now(),
  constraint delegation_different_people check (requested_by <> assigned_to)
);

create index if not exists delegation_requests_household_week
  on public.delegation_requests (household_id, week_start);

create index if not exists delegation_requests_pending
  on public.delegation_requests (household_id, status)
  where status = 'pending';

alter table public.contributions
  add column if not exists delegation_request_id uuid references public.delegation_requests (id) on delete set null;

alter table public.delegation_requests drop constraint if exists delegation_requests_completed_contribution_fk;
alter table public.delegation_requests drop constraint if exists delegation_requests_penalty_contribution_fk;

alter table public.delegation_requests
  add constraint delegation_requests_completed_contribution_fk
    foreign key (completed_contribution_id) references public.contributions (id) on delete set null;

alter table public.delegation_requests
  add constraint delegation_requests_penalty_contribution_fk
    foreign key (penalty_contribution_id) references public.contributions (id) on delete set null;

alter table public.delegation_requests enable row level security;

drop policy if exists "delegation_requests_select_household" on public.delegation_requests;

create policy "delegation_requests_select_household"
  on public.delegation_requests for select
  using (household_id = public.auth_household_id());

-- --- RPCs ---

create or replace function public.approved_vp_this_week(p_household uuid, p_week date, p_profile uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(c.vp), 0)::numeric
  from public.contributions c
  where c.household_id = p_household
    and c.week_start = p_week
    and c.profile_id = p_profile
    and coalesce(c.status, 'approved') = 'approved';
$$;

revoke all on function public.approved_vp_this_week(uuid, date, uuid) from public;
grant execute on function public.approved_vp_this_week(uuid, date, uuid) to authenticated;

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

  v_base := case p_effort
    when 'low' then 15
    when 'medium' then 30
    when 'high' then 45
  end;
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

revoke all on function public.create_delegation_request(uuid, text, text, date) from public;
grant execute on function public.create_delegation_request(uuid, text, text, date) to authenticated;

create or replace function public.cancel_delegation_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.delegation_requests%rowtype;
begin
  select * into r from public.delegation_requests where id = p_request for update;
  if not found then
    raise exception 'not found';
  end if;
  if r.requested_by is distinct from auth.uid() then
    raise exception 'only requester can cancel';
  end if;
  if r.status <> 'pending' then
    raise exception 'not pending';
  end if;
  if r.household_id <> public.auth_household_id() then
    raise exception 'wrong household';
  end if;

  update public.delegation_requests
  set status = 'cancelled'
  where id = p_request;
end;
$$;

revoke all on function public.cancel_delegation_request(uuid) from public;
grant execute on function public.cancel_delegation_request(uuid) to authenticated;

create or replace function public.finalize_delegation_completion(p_request uuid, p_contribution uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.delegation_requests%rowtype;
  c public.contributions%rowtype;
begin
  select * into r from public.delegation_requests where id = p_request for update;
  if not found then
    raise exception 'request not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'not pending';
  end if;
  if r.assigned_to is distinct from auth.uid() then
    raise exception 'only assignee can complete';
  end if;

  select * into c from public.contributions where id = p_contribution;
  if not found then
    raise exception 'contribution not found';
  end if;

  if c.profile_id is distinct from r.assigned_to then
    raise exception 'wrong profile on contribution';
  end if;
  if c.household_id is distinct from r.household_id then
    raise exception 'wrong household';
  end if;
  if c.week_start is distinct from r.week_start then
    raise exception 'wrong week';
  end if;
  if c.kind <> 'chore' then
    raise exception 'must be chore';
  end if;
  if c.effort is distinct from r.effort then
    raise exception 'effort mismatch';
  end if;
  if c.vp is distinct from r.base_vp then
    raise exception 'vp mismatch';
  end if;
  if coalesce(c.status, 'approved') <> 'approved' then
    raise exception 'contribution must be approved';
  end if;

  update public.contributions
  set delegation_request_id = p_request
  where id = p_contribution;

  update public.delegation_requests
  set
    status = 'completed',
    completed_contribution_id = p_contribution
  where id = p_request;
end;
$$;

revoke all on function public.finalize_delegation_completion(uuid, uuid) from public;
grant execute on function public.finalize_delegation_completion(uuid, uuid) to authenticated;

create or replace function public.apply_delegation_penalties(p_current_week_start date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  rec record;
  v_pen_id uuid;
  n int := 0;
begin
  v_household := public.auth_household_id();
  if v_household is null then
    return 0;
  end if;

  for rec in
    select *
    from public.delegation_requests dr
    where dr.household_id = v_household
      and dr.status = 'pending'
      and dr.week_start < p_current_week_start
    for update
  loop
    insert into public.contributions (
      household_id,
      profile_id,
      kind,
      effort,
      vp,
      note,
      week_start,
      status,
      chore_source
    ) values (
      rec.household_id,
      rec.assigned_to,
      'chore',
      rec.effort,
      -rec.penalty_vp,
      'Penalty · missed partner ask: ' || rec.chore_label,
      p_current_week_start,
      'approved',
      'preset'
    )
    returning id into v_pen_id;

    update public.delegation_requests
    set
      status = 'penalized',
      penalty_contribution_id = v_pen_id
    where id = rec.id;

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.apply_delegation_penalties(date) from public;
grant execute on function public.apply_delegation_penalties(date) to authenticated;
