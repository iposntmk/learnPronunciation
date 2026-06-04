alter table public.provider_credentials
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.profiles(id) on delete set null;

update public.provider_credentials
set id = gen_random_uuid()
where id is null;

update public.provider_credentials
set created_by = coalesce(created_by, updated_by)
where created_by is null;

alter table public.provider_credentials
  alter column id set not null,
  alter column provider set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.provider_credentials'::regclass
      and conname = 'provider_credentials_pkey'
  ) then
    alter table public.provider_credentials drop constraint provider_credentials_pkey;
  end if;
end
$$;

alter table public.provider_credentials
  add constraint provider_credentials_pkey primary key (id);

with ranked as (
  select
    id,
    row_number() over (
      partition by provider
      order by is_active desc, created_at desc, updated_at desc
    ) as row_num
  from public.provider_credentials
  where is_active
)
update public.provider_credentials credentials
set
  is_active = false,
  deactivated_at = coalesce(credentials.deactivated_at, now())
from ranked
where credentials.id = ranked.id
  and ranked.row_num > 1;

create unique index if not exists provider_credentials_one_active_provider_idx
on public.provider_credentials(provider)
where is_active;

create index if not exists provider_credentials_provider_created_idx
on public.provider_credentials(provider, created_at desc);
