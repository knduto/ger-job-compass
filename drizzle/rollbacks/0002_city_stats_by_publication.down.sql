-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0002_city_stats_by_publication.sql
-- Restores the city_stats definition in effect after 0001 (originally created in
-- 0000): new_7d / new_30d counted from our first_seen instead of the agency's
-- publication date. Column list is identical, so CREATE OR REPLACE is valid.

CREATE OR REPLACE VIEW public.city_stats WITH (security_invoker = on) AS
SELECT city,
  count(*) FILTER (WHERE NOT expired) AS active_jobs,
  count(*) AS total_jobs,
  count(*) FILTER (WHERE first_seen > now() - interval '7 days') AS new_7d,
  count(*) FILTER (WHERE first_seen > now() - interval '30 days') AS new_30d,
  count(DISTINCT employer) FILTER (WHERE NOT expired) AS employers,
  round(100.0 * count(*) FILTER (WHERE homeoffice AND NOT expired) / nullif(count(*) FILTER (WHERE NOT expired),0), 1) AS remote_pct,
  round(100.0 * count(*) FILTER (WHERE contract = 'UNBEFRISTET' AND NOT expired) / nullif(count(*) FILTER (WHERE NOT expired),0), 1) AS permanent_pct,
  round(100.0 * count(*) FILTER (WHERE salary_from IS NOT NULL AND NOT expired) / nullif(count(*) FILTER (WHERE NOT expired),0), 1) AS salary_pct,
  round(avg((coalesce(salary_from,0)+coalesce(salary_to,salary_from))/2) FILTER (WHERE salary_type='JAHRESGEHALT' AND salary_from IS NOT NULL AND NOT expired)) AS avg_salary,
  min(first_seen) AS first_seen, max(last_seen) AS last_seen
FROM public.jobs WHERE city IS NOT NULL
GROUP BY city;
GRANT SELECT ON public.city_stats TO authenticated;
