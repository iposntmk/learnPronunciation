-- Run this once on the existing Supabase project (SQL editor or psql).
-- Adds a language enum column to words and updates the unique constraint
-- so the same spelling can coexist across languages (e.g. "casa" in IT vs ES).

do $$ begin
  create type public.word_language as enum ('english', 'spanish', 'italian', 'french');
exception when duplicate_object then null;
end $$;

alter table public.words
  add column if not exists language public.word_language not null default 'english';

alter table public.words
  drop constraint if exists words_normalized_word_category_key_key;

alter table public.words
  drop constraint if exists words_normalized_word_category_key_language_key;

alter table public.words
  add constraint words_normalized_word_category_key_language_key
  unique (normalized_word, category_key, language);

create index if not exists words_language_idx on public.words(language);
