
create table public.search_keywords (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.search_keywords to authenticated;
grant all on public.search_keywords to service_role;
alter table public.search_keywords enable row level security;
create policy "auth read keywords" on public.search_keywords for select to authenticated using (true);
create policy "auth write keywords" on public.search_keywords for insert to authenticated with check (true);
create policy "auth update keywords" on public.search_keywords for update to authenticated using (true);
create policy "auth delete keywords" on public.search_keywords for delete to authenticated using (true);

insert into public.search_keywords (term) values
('IT Operations Manager'),('IT Service Manager'),('IT Service Delivery Manager'),('Technical Operations Manager'),
('IT Project Manager'),('IT Projektmanager'),('IT Manager'),('IT-Leiter'),('IT Leitung'),('Technical Lead'),
('IT Team Lead'),('Systems Manager'),('System Administrator'),('System Engineer'),('IT Consultant'),('IT-Berater'),
('Application Manager'),('Application Management'),('Business Systems'),('Enterprise Applications'),
('Digital Transformation'),('Digitalisierung'),('IT Infrastructure'),('IT Infrastruktur'),('Cloud'),
('Service Delivery'),('IT Operations'),('IT Betrieb');

create table public.jobs (
  refnr text primary key,
  title text not null,
  employer text,
  employer_hash text,
  beruf text,
  alle_berufe text[] not null default '{}',
  berufsfelder text[] not null default '{}',
  keywords text[] not null default '{}',
  city text,
  city_raw text,
  plz text,
  region text,
  country text,
  lat double precision,
  lng double precision,
  published_from date,
  first_published date,
  changed_at timestamptz,
  entry_from date,
  contract text,
  fulltime boolean,
  parttime boolean,
  homeoffice boolean,
  salary_type text,
  salary_from numeric,
  salary_to numeric,
  external_url text,
  raw jsonb not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  expired boolean not null default false
);
create index jobs_city_idx on public.jobs(city);
create index jobs_employer_idx on public.jobs(employer);
create index jobs_last_seen_idx on public.jobs(last_seen);
create index jobs_berufsfelder_idx on public.jobs using gin(berufsfelder);
grant select on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "auth read jobs" on public.jobs for select to authenticated using (true);

create table public.job_details (
  refnr text primary key references public.jobs(refnr) on delete cascade,
  description text,
  raw jsonb not null,
  fetched_at timestamptz not null default now()
);
grant select on public.job_details to authenticated;
grant all on public.job_details to service_role;
alter table public.job_details enable row level security;
create policy "auth read details" on public.job_details for select to authenticated using (true);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  keywords_total int not null default 0,
  keywords_done int not null default 0,
  requests int not null default 0,
  fetched int not null default 0,
  skipped_non_de int not null default 0,
  new_count int not null default 0,
  updated_count int not null default 0,
  expired_count int not null default 0,
  errors jsonb not null default '[]'::jsonb
);
grant select on public.sync_runs to authenticated;
grant all on public.sync_runs to service_role;
alter table public.sync_runs enable row level security;
create policy "auth read runs" on public.sync_runs for select to authenticated using (true);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  refnr text not null references public.jobs(refnr) on delete cascade,
  stage text not null default 'saved',
  applied_at date,
  resume_version text,
  contact text,
  notes text,
  follow_up date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, refnr)
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "own apps select" on public.applications for select to authenticated using (auth.uid() = user_id);
create policy "own apps insert" on public.applications for insert to authenticated with check (auth.uid() = user_id);
create policy "own apps update" on public.applications for update to authenticated using (auth.uid() = user_id);
create policy "own apps delete" on public.applications for delete to authenticated using (auth.uid() = user_id);

create or replace function public.validate_application() returns trigger language plpgsql set search_path = public as $$
begin
  if new.stage not in ('saved','applied','interview','offer','rejected') then
    raise exception 'invalid stage %', new.stage;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger applications_validate before insert or update on public.applications
for each row execute function public.validate_application();

create view public.city_stats with (security_invoker = on) as
select city,
  count(*) filter (where not expired) as active_jobs,
  count(*) as total_jobs,
  count(*) filter (where first_seen > now() - interval '7 days') as new_7d,
  count(*) filter (where first_seen > now() - interval '30 days') as new_30d,
  count(distinct employer) filter (where not expired) as employers,
  round(100.0 * count(*) filter (where homeoffice and not expired) / nullif(count(*) filter (where not expired),0), 1) as remote_pct,
  round(100.0 * count(*) filter (where contract = 'UNBEFRISTET' and not expired) / nullif(count(*) filter (where not expired),0), 1) as permanent_pct,
  round(100.0 * count(*) filter (where salary_from is not null and not expired) / nullif(count(*) filter (where not expired),0), 1) as salary_pct,
  round(avg((coalesce(salary_from,0)+coalesce(salary_to,salary_from))/2) filter (where salary_type='JAHRESGEHALT' and salary_from is not null and not expired)) as avg_salary,
  min(first_seen) as first_seen, max(last_seen) as last_seen
from public.jobs where city is not null
group by city;
grant select on public.city_stats to authenticated;

create view public.employer_stats with (security_invoker = on) as
select employer,
  count(*) filter (where not expired) as active_jobs,
  count(*) as total_jobs,
  count(distinct city) as cities,
  array_agg(distinct city) filter (where city is not null) as city_list,
  min(first_seen) as first_seen, max(last_seen) as last_seen
from public.jobs where employer is not null
group by employer;
grant select on public.employer_stats to authenticated;
