-- Allow changing effort on approved chores; partner must approve via RPCs.

alter table public.contributions
  add column if not exists effort_revision_pending boolean not null default false;

alter table public.contributions
  add column if not exists pending_effort text;

alter table public.contributions
  add column if not exists pending_vp numeric;

alter table public.contributions drop constraint if exists contributions_pending_effort_check;

alter table public.contributions
  add constraint contributions_pending_effort_check
    check (pending_effort is null or pending_effort in ('low', 'medium', 'high'));

create index if not exists contributions_effort_revision_pending
  on public.contributions (household_id, effort_revision_pending)
  where effort_revision_pending = true;

-- Request (owner only): propose new effort; keeps current VP until partner approves.
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
  new_vp := case p_new_effort
    when 'low' then 15
    when 'medium' then 30
    when 'high' then 45
  end;

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
