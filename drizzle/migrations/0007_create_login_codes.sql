-- 0007_create_login_codes.sql
-- Two-step login: short-lived e-mail verification codes.
-- Server/service-role only: RLS is enabled with no policies for anon/authenticated.

create table if not exists public.login_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_codes_user_created_idx
  on public.login_codes (user_id, created_at desc);

grant all on public.login_codes to service_role;

alter table public.login_codes enable row level security;

-- No policies: anon and authenticated have neither grants nor policies, so the
-- table is reachable only through the service role on the server.
