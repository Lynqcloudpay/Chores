-- Partner disputes: freeze VP until resolved; fraud → 2× VP penalty against submitter.

alter table public.contributions
  add column if not exists dispute_status text
    check (dispute_status is null or dispute_status in ('open', 'resolved_valid', 'resolved_fraud'));

alter table public.contributions
  add column if not exists dispute_opened_by uuid references public.profiles (id) on delete set null;

alter table public.contributions
  add column if not exists dispute_opened_at timestamptz;

alter table public.contributions
  add column if not exists dispute_note text;

alter table public.contributions
  add column if not exists dispute_resolved_by uuid references public.profiles (id) on delete set null;

alter table public.contributions
  add column if not exists dispute_resolved_at timestamptz;

create index if not exists contributions_dispute_open
  on public.contributions (household_id, week_start)
  where dispute_status = 'open';

-- Partner (not submitter) flags an approved entry; VP excluded until resolved.
create or replace function public.open_contribution_dispute(p_contribution uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.contributions%rowtype;
  v_me uuid := auth.uid();
begin
  select * into r from public.contributions where id = p_contribution for update;
  if not found then
    raise exception 'not found';
  end if;
  if r.profile_id = v_me then
    raise exception 'cannot dispute your own entry';
  end if;
  if r.household_id is distinct from public.auth_household_id() then
    raise exception 'wrong household';
  end if;
  if coalesce(r.status, 'approved') <> 'approved' then
    raise exception 'only approved entries can be disputed';
  end if;
  if r.dispute_status is not null then
    raise exception 'already disputed or resolved';
  end if;

  update public.contributions
  set
    dispute_status = 'open',
    dispute_opened_by = v_me,
    dispute_opened_at = now(),
    dispute_note = nullif(trim(p_note), '')
  where id = p_contribution;
end;
$$;

-- Only the partner who opened the dispute may resolve (valid vs fraud).
create or replace function public.resolve_contribution_dispute(p_contribution uuid, p_proof_valid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.contributions%rowtype;
  v_me uuid := auth.uid();
  v_penalty numeric;
  v_label text;
begin
  select * into r from public.contributions where id = p_contribution for update;
  if not found then
    raise exception 'not found';
  end if;
  if r.dispute_status is distinct from 'open' then
    raise exception 'no open dispute';
  end if;
  if r.dispute_opened_by is distinct from v_me then
    raise exception 'only the partner who opened the dispute can resolve it';
  end if;
  if r.household_id is distinct from public.auth_household_id() then
    raise exception 'wrong household';
  end if;

  if p_proof_valid then
    update public.contributions
    set
      dispute_status = 'resolved_valid',
      dispute_resolved_by = v_me,
      dispute_resolved_at = now()
    where id = p_contribution;
    return;
  end if;

  -- Fraud: reject original and apply 2× VP penalty (same week, submitter).
  v_penalty := -2 * abs(r.vp);
  v_label := coalesce(nullif(trim(r.note), ''), case when r.kind = 'provision' then 'Financial' else 'Chore' end);

  update public.contributions
  set
    status = 'rejected',
    dispute_status = 'resolved_fraud',
    dispute_resolved_by = v_me,
    dispute_resolved_at = now(),
    reviewed_by = v_me,
    reviewed_at = now()
  where id = p_contribution;

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
    r.household_id,
    r.profile_id,
    'chore',
    coalesce(r.effort, 'low'),
    v_penalty,
    'Dispute penalty · fraudulent proof: ' || v_label,
    r.week_start,
    'approved',
    'preset'
  );
end;
$$;

revoke all on function public.open_contribution_dispute(uuid, text) from public;
revoke all on function public.resolve_contribution_dispute(uuid, boolean) from public;

grant execute on function public.open_contribution_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_contribution_dispute(uuid, boolean) to authenticated;

-- Delegation VP: exclude contributions in an open dispute.
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
    and coalesce(c.status, 'approved') = 'approved'
    and (c.dispute_status is null or c.dispute_status = 'resolved_valid');
$$;
