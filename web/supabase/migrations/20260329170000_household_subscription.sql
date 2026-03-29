-- Stripe Pro subscription + optional ZIP for local service links (client-editable).

alter table public.households
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro'));

alter table public.households
  add column if not exists stripe_customer_id text;

alter table public.households
  add column if not exists stripe_subscription_id text;

alter table public.households
  add column if not exists pro_access_until timestamptz;

alter table public.households
  add column if not exists service_area_zip text;

comment on column public.households.subscription_tier is 'free | pro — updated by Stripe webhook (service role), not by clients.';
comment on column public.households.service_area_zip is 'Optional ZIP/postal code for “near you” hire-help links; editable by household members.';

-- Block authenticated users from editing billing fields (webhook uses service role; auth.uid() is null).
create or replace function public.households_block_client_subscription_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if (
    new.subscription_tier is distinct from old.subscription_tier
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.pro_access_until is distinct from old.pro_access_until
  ) then
    if auth.uid() is not null then
      raise exception 'subscription is managed by billing';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists households_block_client_subscription_writes on public.households;
create trigger households_block_client_subscription_writes
  before update on public.households
  for each row
  execute function public.households_block_client_subscription_writes();
