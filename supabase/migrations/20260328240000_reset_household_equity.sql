-- Nuclear option: wipe household equity history (contributions, delegations, presets, VP overrides).
-- Proof files are removed client-side after this RPC (storage list/remove).

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
