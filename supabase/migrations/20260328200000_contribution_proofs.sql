-- Proof images/PDFs for contributions (camera capture + timestamp metadata).

alter table public.contributions
  add column if not exists proof_storage_path text,
  add column if not exists proof_captured_at timestamptz;

comment on column public.contributions.proof_storage_path is 'Path in storage bucket contribution-proofs: {household_id}/{contribution_id}.ext';
comment on column public.contributions.proof_captured_at is 'When proof was captured or sealed (burned into image or upload time).';

-- Private bucket for household-scoped proofs
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
