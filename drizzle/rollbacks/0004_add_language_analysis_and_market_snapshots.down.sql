-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0004_add_language_analysis_and_market_snapshots.sql
-- Loses derived data only (recomputable from stored job descriptions), but daily
-- snapshot history cannot be reconstructed for past dates.

DROP TABLE IF EXISTS public.market_snapshots;
DROP TABLE IF EXISTS public.job_language_analysis;
