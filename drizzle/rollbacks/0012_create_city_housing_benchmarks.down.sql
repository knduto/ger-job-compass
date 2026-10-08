-- ROLLBACK for 0012_create_city_housing_benchmarks.sql
-- NEVER run automatically. Review first.
-- WARNING: data loss — deletes all user-entered rent benchmarks. Back up first.
DROP TABLE IF EXISTS public.city_housing_benchmarks;
