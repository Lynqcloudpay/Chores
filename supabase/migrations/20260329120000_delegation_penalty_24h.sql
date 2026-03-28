-- Partner asks: penalty if not completed with proof within 24 hours of the request (not end-of-week).

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
      and dr.created_at + interval '24 hours' <= now()
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

  if now() > r.created_at + interval '24 hours' then
    raise exception 'deadline passed — partner ask must be completed with proof within 24 hours';
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
