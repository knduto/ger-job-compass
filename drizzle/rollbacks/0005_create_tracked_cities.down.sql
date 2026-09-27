-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0005_create_tracked_cities.sql
-- Removes saved report cities; reports fall back to the data-driven top 30.

DROP TABLE IF EXISTS public.tracked_cities;
