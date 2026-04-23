-- Supabase schema for the pronunciation learning app.
-- Run this in Supabase SQL Editor after enabling Auth providers.

create extension if not exists pgcrypto;

create type public.word_type as enum ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'other');
create type public.difficulty_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type public.ipa_status as enum ('correct', 'incorrect');
create type public.app_role as enum ('admin', 'teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'student',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  level public.difficulty_level,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  normalized_word text generated always as (lower(trim(word))) stored,
  type public.word_type not null default 'other',
  ipa text,
  vietnamese_definition text not null default '',
  example_sentence text,
  root_word text,
  family_words text[] not null default '{}',
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  category_key uuid generated always as (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  level public.difficulty_level,
  source text not null default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_word, category_key)
);

create table public.user_word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  is_learned boolean not null default false,
  ipa_status public.ipa_status,
  last_score numeric(5,2),
  last_practiced_at timestamptz,
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);

create table public.pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  ipa_status public.ipa_status,
  spoken_word text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  file_name text,
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  error_rows integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();

create trigger words_updated_at before update on public.words
for each row execute function public.set_updated_at();

create trigger user_word_progress_updated_at before update on public.user_word_progress
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.mark_word_practiced(
  p_word_id uuid,
  p_score numeric,
  p_spoken_word text default null,
  p_result jsonb default '{}'::jsonb
)
returns public.user_word_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.ipa_status;
  v_progress public.user_word_progress;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_status := case when p_score >= 70 then 'correct'::public.ipa_status else 'incorrect'::public.ipa_status end;

  insert into public.pronunciation_attempts (user_id, word_id, score, ipa_status, spoken_word, result)
  values (auth.uid(), p_word_id, p_score, v_status, p_spoken_word, coalesce(p_result, '{}'::jsonb));

  insert into public.user_word_progress (
    user_id, word_id, is_learned, ipa_status, last_score, last_practiced_at, learned_at
  )
  values (
    auth.uid(), p_word_id, p_score >= 70, v_status, p_score, now(), case when p_score >= 70 then now() else null end
  )
  on conflict (user_id, word_id) do update set
    last_score = excluded.last_score,
    ipa_status = excluded.ipa_status,
    last_practiced_at = excluded.last_practiced_at,
    is_learned = public.user_word_progress.is_learned or excluded.is_learned,
    learned_at = case
      when public.user_word_progress.learned_at is not null then public.user_word_progress.learned_at
      when excluded.is_learned then now()
      else null
    end
  returning * into v_progress;

  return v_progress;
end;
$$;

create or replace function public.get_or_create_word(
  p_word text,
  p_type public.word_type default 'other',
  p_ipa text default null,
  p_vietnamese_definition text default 'Google Translate available',
  p_example_sentence text default null,
  p_level public.difficulty_level default null,
  p_source text default 'app'
)
returns public.words
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word public.words;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_word
  from public.words
  where normalized_word = lower(trim(p_word))
  order by created_at asc
  limit 1;

  if v_word.id is not null then
    return v_word;
  end if;

  insert into public.words (
    word, type, ipa, vietnamese_definition, example_sentence, level, source, created_by
  )
  values (
    lower(trim(p_word)),
    coalesce(p_type, 'other'),
    nullif(trim(coalesce(p_ipa, '')), ''),
    coalesce(nullif(trim(coalesce(p_vietnamese_definition, '')), ''), 'Google Translate available'),
    nullif(trim(coalesce(p_example_sentence, '')), ''),
    p_level,
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    auth.uid()
  )
  returning * into v_word;

  return v_word;
end;
$$;

create index categories_level_idx on public.categories(level);
create index words_category_id_idx on public.words(category_id);
create index words_level_idx on public.words(level);
create index words_normalized_word_idx on public.words(normalized_word);
create index words_search_idx on public.words using gin (
  to_tsvector('simple', coalesce(word, '') || ' ' || coalesce(vietnamese_definition, '') || ' ' || coalesce(root_word, ''))
);
create index user_word_progress_user_idx on public.user_word_progress(user_id);
create index pronunciation_attempts_user_word_idx on public.pronunciation_attempts(user_id, word_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.words enable row level security;
alter table public.user_word_progress enable row level security;
alter table public.pronunciation_attempts enable row level security;
alter table public.import_batches enable row level security;

create policy "Profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "Admins manage profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users read categories"
on public.categories for select
to authenticated
using (true);

create policy "Admins manage categories"
on public.categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users read words"
on public.words for select
to authenticated
using (true);

create policy "Admins manage words"
on public.words for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users manage own progress"
on public.user_word_progress for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins read progress"
on public.user_word_progress for select
to authenticated
using (public.is_admin());

create policy "Users read own attempts"
on public.pronunciation_attempts for select
to authenticated
using (user_id = auth.uid());

create policy "Users insert own attempts"
on public.pronunciation_attempts for insert
to authenticated
with check (user_id = auth.uid());

create policy "Admins read attempts"
on public.pronunciation_attempts for select
to authenticated
using (public.is_admin());

create policy "Admins manage import batches"
on public.import_batches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.categories (name, slug, description, level)
values
  ('A1 Core', 'a1-core', 'Starter vocabulary', 'A1'),
  ('A2 Core', 'a2-core', 'Elementary vocabulary', 'A2'),
  ('B1 Core', 'b1-core', 'Intermediate vocabulary', 'B1'),
  ('B2 Core', 'b2-core', 'Upper intermediate vocabulary', 'B2'),
  ('Health', 'health', 'Health and body vocabulary', null),
  ('History', 'history', 'History and culture vocabulary', null)
on conflict (slug) do nothing;

-- To create the first admin:
-- 1. Sign in once so your row exists in public.profiles.
-- 2. Run: update public.profiles set role = 'admin' where email = 'your@email.com';
--
-- Full Auth user deletion cannot be done safely from browser code with an anon key.
-- Use Supabase Dashboard, a server route, or an Edge Function with service_role for hard-delete.
