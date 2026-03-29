-- Optional second image for chore proof (before / after).

alter table public.contributions
  add column if not exists proof_after_storage_path text;

alter table public.contributions
  add column if not exists proof_after_captured_at timestamptz;
