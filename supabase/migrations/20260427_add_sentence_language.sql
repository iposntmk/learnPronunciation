-- Adds language support to sentence content, matching words.

do $$ begin
  create type public.word_language as enum ('english', 'spanish', 'italian', 'french');
exception when duplicate_object then null;
end $$;

alter table if exists public.sentences
  add column if not exists language public.word_language not null default 'english';

alter table if exists public.sentences
  drop constraint if exists sentences_normalized_sentence_key;

alter table if exists public.sentences
  drop constraint if exists sentences_normalized_sentence_language_key;

alter table if exists public.sentences
  add constraint sentences_normalized_sentence_language_key
  unique (normalized_sentence, language);

create index if not exists sentences_language_idx on public.sentences(language);

create or replace function public.ensure_sentence_topic_column()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if to_regclass('public.sentences') is null then
    raise exception 'Table public.sentences does not exist';
  end if;

  alter table public.sentences
    add column if not exists topic text,
    add column if not exists language public.word_language not null default 'english';

  alter table public.sentences
    drop constraint if exists sentences_normalized_sentence_key;

  alter table public.sentences
    drop constraint if exists sentences_normalized_sentence_language_key;

  alter table public.sentences
    add constraint sentences_normalized_sentence_language_key
    unique (normalized_sentence, language);

  create index if not exists sentences_topic_idx on public.sentences(topic);
  create index if not exists sentences_language_idx on public.sentences(language);
end;
$$;

grant execute on function public.ensure_sentence_topic_column() to authenticated;
