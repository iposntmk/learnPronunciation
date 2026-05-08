-- Convert the hardcoded difficulty_level enum into a dynamic public.levels table.
-- After this migration, admins can add/edit/remove levels from the app.
-- Deleting a level sets level=null on referencing words/categories/sentences.

create table if not exists public.levels (
  code text primary key,
  name text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.levels (code, name, order_index)
values
  ('A1', 'Beginner', 1),
  ('A2', 'Elementary', 2),
  ('B1', 'Intermediate', 3),
  ('B2', 'Upper Intermediate', 4),
  ('C1', 'Advanced', 5),
  ('C2', 'Proficient', 6)
on conflict (code) do nothing;

drop trigger if exists levels_updated_at on public.levels;
create trigger levels_updated_at before update on public.levels
for each row execute function public.set_updated_at();

alter table public.levels enable row level security;

drop policy if exists "Authenticated users read levels" on public.levels;
create policy "Authenticated users read levels"
on public.levels for select
to authenticated
using (true);

drop policy if exists "Admins manage levels" on public.levels;
create policy "Admins manage levels"
on public.levels for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Drop functions referencing the enum so we can change column types.
drop function if exists public.get_or_create_word(
  text, public.word_type, text, text, text, public.difficulty_level, public.word_language, text
);

-- Convert columns from enum to text + FK.
alter table public.categories
  alter column level type text using level::text;

alter table public.words
  alter column level type text using level::text;

alter table public.sentences
  alter column level type text using level::text;

-- Add FKs ON DELETE SET NULL.
alter table public.categories
  drop constraint if exists categories_level_fkey;
alter table public.categories
  add constraint categories_level_fkey
  foreign key (level) references public.levels(code) on delete set null on update cascade;

alter table public.words
  drop constraint if exists words_level_fkey;
alter table public.words
  add constraint words_level_fkey
  foreign key (level) references public.levels(code) on delete set null on update cascade;

alter table public.sentences
  drop constraint if exists sentences_level_fkey;
alter table public.sentences
  add constraint sentences_level_fkey
  foreign key (level) references public.levels(code) on delete set null on update cascade;

-- Recreate get_or_create_word with text level parameter.
create or replace function public.get_or_create_word(
  p_word text,
  p_type public.word_type default 'other',
  p_ipa text default null,
  p_vietnamese_definition text default 'Google Translate available',
  p_example_sentence text default null,
  p_level text default null,
  p_language public.word_language default 'english',
  p_source text default 'app'
)
returns public.words
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word public.words;
  v_level text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_word
  from public.words
  where normalized_word = lower(trim(p_word))
    and language = coalesce(p_language, 'english'::public.word_language)
  order by created_at asc
  limit 1;

  if v_word.id is not null then
    return v_word;
  end if;

  v_level := nullif(trim(coalesce(p_level, '')), '');
  if v_level is not null and not exists (select 1 from public.levels where code = v_level) then
    v_level := null;
  end if;

  insert into public.words (
    word, type, ipa, vietnamese_definition, example_sentence, level, language, source, created_by
  )
  values (
    lower(trim(p_word)),
    coalesce(p_type, 'other'),
    nullif(trim(coalesce(p_ipa, '')), ''),
    coalesce(nullif(trim(coalesce(p_vietnamese_definition, '')), ''), 'Google Translate available'),
    nullif(trim(coalesce(p_example_sentence, '')), ''),
    v_level,
    coalesce(p_language, 'english'::public.word_language),
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    auth.uid()
  )
  returning * into v_word;

  return v_word;
end;
$$;

-- Drop the now-unused enum. Safe because no columns/functions reference it anymore.
drop type if exists public.difficulty_level;
