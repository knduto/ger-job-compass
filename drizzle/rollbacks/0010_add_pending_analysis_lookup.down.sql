-- Rollback for 0010_add_pending_analysis_lookup
DROP FUNCTION IF EXISTS public.analysis_backlog(text);
DROP FUNCTION IF EXISTS public.pending_analysis_refs(text, integer);
DROP INDEX IF EXISTS public.idx_jobs_expired_published_refnr;
