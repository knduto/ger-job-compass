-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0001_city_stats_concentration.sql
-- Restores the 0000 state: city_employer_share did not exist in 0000, so the
-- previous definition is "absent". Reports that read top_employer_pct will break.

DROP VIEW IF EXISTS public.city_employer_share;
