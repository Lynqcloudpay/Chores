-- Partner approval for contributions: pending → approved/rejected by the other household member.

alter table public.contributions
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected'));

alter table public.contributions
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;

alter table public.contributions
  add column if not exists reviewed_at timestamptz;

-- Existing rows remain approved via default.

drop policy if exists "contributions_insert_self" on public.contributions;

create policy "contributions_insert_self"
  on public.contributions for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and household_id = public.auth_household_id()
    and status = 'pending'
  );

drop policy if exists "contributions_partner_review" on public.contributions;

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
