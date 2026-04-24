-- Run this once on the existing Supabase project (SQL editor or psql).
alter table public.words
  add column if not exists flagged_incorrect boolean not null default false;

create index if not exists words_flagged_incorrect_idx
  on public.words(flagged_incorrect) where flagged_incorrect;
