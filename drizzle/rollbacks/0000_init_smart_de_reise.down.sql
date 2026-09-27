-- !!! DO NOT RUN WITHOUT A BACKUP — DATA LOSS !!!
-- This drops every job, detail, sync run, application and keyword collected so far.
-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0000_init_smart_de_reise.sql (baseline schema)

DROP VIEW IF EXISTS public.employer_stats;
DROP VIEW IF EXISTS public.city_stats;
DROP TRIGGER IF EXISTS applications_validate ON public.applications;
DROP FUNCTION IF EXISTS public.validate_application();
DROP TABLE IF EXISTS public.applications;
DROP TABLE IF EXISTS public.sync_runs;
DROP TABLE IF EXISTS public.job_details;
DROP TABLE IF EXISTS public.jobs;
DROP TABLE IF EXISTS public.search_keywords;
