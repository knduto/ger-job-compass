-- ROLLBACK for 0013_housing_phase1_and_national_utilities.sql
-- NEVER run automatically. Review first.
-- WARNING: data loss — deletes Phase-1 furnished prices, utilities sources and national utilities settings. Back up first.
DROP TABLE IF EXISTS public.user_settlement_settings;
ALTER TABLE public.city_housing_benchmarks DROP CONSTRAINT IF EXISTS furnished_requires_source;
ALTER TABLE public.city_housing_benchmarks
  DROP COLUMN IF EXISTS furnished_warm_month,
  DROP COLUMN IF EXISTS furnished_source_name,
  DROP COLUMN IF EXISTS furnished_source_year,
  DROP COLUMN IF EXISTS utilities_source_name,
  DROP COLUMN IF EXISTS utilities_source_year;
