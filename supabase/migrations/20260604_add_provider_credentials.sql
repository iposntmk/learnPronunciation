create table if not exists public.provider_credentials (
  provider text primary key,
  app_key_ciphertext text,
  secret_key_ciphertext text,
  user_id text not null default 'guest',
  scoring_mode text not null default 'azure' check (scoring_mode in ('azure', 'speechsuper', 'both')),
  expires_at timestamptz,
  last_tested_at timestamptz,
  last_test_ok boolean,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists provider_credentials_updated_at on public.provider_credentials;
create trigger provider_credentials_updated_at before update on public.provider_credentials
for each row execute function public.set_updated_at();

alter table public.provider_credentials enable row level security;

revoke all on table public.provider_credentials from anon;
revoke all on table public.provider_credentials from authenticated;
