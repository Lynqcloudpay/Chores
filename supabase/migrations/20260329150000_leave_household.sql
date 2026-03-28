-- Remove your profile row so you can join another household (contributions for your user cascade away).

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
