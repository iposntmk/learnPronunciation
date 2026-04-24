-- Keep user progress attached to the correct word-language row.
-- The original helper looked up by normalized text only, so "casa" or
-- phrases like "tu casa" could be created/scored as English.

drop function if exists public.get_or_create_word(
  text,
  public.word_type,
  text,
  text,
  text,
  public.difficulty_level,
  text
);

create or replace function public.get_or_create_word(
  p_word text,
  p_type public.word_type default 'other',
  p_ipa text default null,
  p_vietnamese_definition text default 'Google Translate available',
  p_example_sentence text default null,
  p_level public.difficulty_level default null,
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

  insert into public.words (
    word, type, ipa, vietnamese_definition, example_sentence, level, language, source, created_by
  )
  values (
    lower(trim(p_word)),
    coalesce(p_type, 'other'),
    nullif(trim(coalesce(p_ipa, '')), ''),
    coalesce(nullif(trim(coalesce(p_vietnamese_definition, '')), ''), 'Google Translate available'),
    nullif(trim(coalesce(p_example_sentence, '')), ''),
    p_level,
    coalesce(p_language, 'english'::public.word_language),
    coalesce(nullif(trim(coalesce(p_source, '')), ''), 'app'),
    auth.uid()
  )
  returning * into v_word;

  return v_word;
end;
$$;
