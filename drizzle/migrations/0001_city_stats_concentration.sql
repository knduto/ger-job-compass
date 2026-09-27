
create or replace view public.city_employer_share with (security_invoker = on) as
select city, max(n)::numeric / nullif(sum(n),0) * 100 as top_employer_pct
from (select city, employer, count(*) n from public.jobs where not expired and city is not null group by city, employer) t
group by city;
grant select on public.city_employer_share to authenticated;
