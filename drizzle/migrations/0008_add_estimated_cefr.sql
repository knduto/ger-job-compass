-- 0008_add_estimated_cefr
-- Backward-compatible (additive): nullable column + index only.
alter table public.job_language_analysis
  add column if not exists estimated_cefr text;

create index if not exists idx_jla_refnr_version
  on public.job_language_analysis (extraction_version);
