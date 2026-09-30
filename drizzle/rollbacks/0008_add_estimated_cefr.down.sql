-- Rollback for 0008_add_estimated_cefr
-- NEVER run automatically. Review before use.
-- Data impact: drops the heuristic estimated_cefr values (explicit CEFR data is untouched).
drop index if exists public.idx_jla_refnr_version;

alter table public.job_language_analysis
  drop column if exists estimated_cefr;
