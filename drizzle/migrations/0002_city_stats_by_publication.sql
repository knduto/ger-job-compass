
create or replace view public.city_stats with (security_invoker = on) as
select city,
  count(*) filter (where not expired) as active_jobs,
  count(*) as total_jobs,
  count(*) filter (where coalesce(first_published, published_from, first_seen::date) > current_date - 7) as new_7d,
  count(*) filter (where coalesce(first_published, published_from, first_seen::date) > current_date - 30) as new_30d,
  count(distinct employer) filter (where not expired) as employers,
  round(100.0 * count(*) filter (where homeoffice and not expired) / nullif(count(*) filter (where not expired),0), 1) as remote_pct,
  round(100.0 * count(*) filter (where contract = 'UNBEFRISTET' and not expired) / nullif(count(*) filter (where not expired),0), 1) as permanent_pct,
  round(100.0 * count(*) filter (where salary_from is not null and not expired) / nullif(count(*) filter (where not expired),0), 1) as salary_pct,
  round(avg((coalesce(salary_from,0)+coalesce(salary_to,salary_from))/2) filter (where salary_type='JAHRESGEHALT' and salary_from is not null and not expired)) as avg_salary,
  min(first_seen) as first_seen, max(last_seen) as last_seen
from public.jobs where city is not null
group by city;
