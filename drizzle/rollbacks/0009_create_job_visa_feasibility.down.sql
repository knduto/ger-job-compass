-- Rollback for 0009_create_job_visa_feasibility (data loss: stored classifications, re-creatable)
DROP TABLE IF EXISTS public.job_visa_feasibility;
