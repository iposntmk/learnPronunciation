-- Adds sentence practice content, progress, and attempt logging.

create table if not exists public.sentences (
  id uuid primary key default gen_random_uuid(),
  sentence text not null,
  normalized_sentence text generated always as (lower(trim(sentence))) stored,
  vietnamese_translation text not null default '',
  topic text,
  language public.word_language not null default 'english',
  level public.difficulty_level,
  source text not null default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_sentence, language)
);

create table if not exists public.user_sentence_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_id uuid not null references public.sentences(id) on delete cascade,
  is_learned boolean not null default false,
  last_score numeric(5,2),
  prosody_score numeric(5,2),
  last_practiced_at timestamptz,
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sentence_id)
);

create table if not exists public.sentence_pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_id uuid not null references public.sentences(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  prosody_score numeric(5,2),
  spoken_text text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger sentences_updated_at before update on public.sentences
for each row execute function public.set_updated_at();

create trigger user_sentence_progress_updated_at before update on public.user_sentence_progress
for each row execute function public.set_updated_at();

create or replace function public.mark_sentence_practiced(
  p_sentence_id uuid,
  p_score numeric,
  p_prosody_score numeric default null,
  p_spoken_text text default null,
  p_result jsonb default '{}'::jsonb
)
returns public.user_sentence_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.user_sentence_progress;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.sentence_pronunciation_attempts (
    user_id, sentence_id, score, prosody_score, spoken_text, result
  )
  values (
    auth.uid(),
    p_sentence_id,
    p_score,
    p_prosody_score,
    p_spoken_text,
    coalesce(p_result, '{}'::jsonb)
  );

  insert into public.user_sentence_progress (
    user_id, sentence_id, is_learned, last_score, prosody_score, last_practiced_at, learned_at
  )
  values (
    auth.uid(),
    p_sentence_id,
    p_score >= 70,
    p_score,
    p_prosody_score,
    now(),
    case when p_score >= 70 then now() else null end
  )
  on conflict (user_id, sentence_id) do update set
    last_score = excluded.last_score,
    prosody_score = excluded.prosody_score,
    last_practiced_at = excluded.last_practiced_at,
    is_learned = public.user_sentence_progress.is_learned or excluded.is_learned,
    learned_at = case
      when public.user_sentence_progress.learned_at is not null then public.user_sentence_progress.learned_at
      when excluded.is_learned then now()
      else null
    end
  returning * into v_progress;

  return v_progress;
end;
$$;

create index if not exists sentences_level_idx on public.sentences(level);
create index if not exists sentences_topic_idx on public.sentences(topic);
create index if not exists sentences_language_idx on public.sentences(language);
create index if not exists sentences_normalized_sentence_idx on public.sentences(normalized_sentence);
create index if not exists user_sentence_progress_user_idx on public.user_sentence_progress(user_id);
create index if not exists sentence_pronunciation_attempts_user_sentence_idx on public.sentence_pronunciation_attempts(user_id, sentence_id, created_at desc);

alter table public.sentences enable row level security;
alter table public.user_sentence_progress enable row level security;
alter table public.sentence_pronunciation_attempts enable row level security;

create policy "Authenticated users read sentences"
on public.sentences for select
to authenticated
using (true);

create policy "Admins manage sentences"
on public.sentences for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users manage own sentence progress"
on public.user_sentence_progress for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins read sentence progress"
on public.user_sentence_progress for select
to authenticated
using (public.is_admin());

create policy "Users read own sentence attempts"
on public.sentence_pronunciation_attempts for select
to authenticated
using (user_id = auth.uid());

create policy "Users insert own sentence attempts"
on public.sentence_pronunciation_attempts for insert
to authenticated
with check (user_id = auth.uid());

create policy "Admins read sentence attempts"
on public.sentence_pronunciation_attempts for select
to authenticated
using (public.is_admin());
