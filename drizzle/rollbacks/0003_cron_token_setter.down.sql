-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0003_cron_token_setter.sql
-- Removes the token setter. The vault secret 'daily_sync_token' is NOT deleted here
-- (vault is a managed schema). The pg_cron / pg_net extensions are left installed
-- because the daily schedule depends on them; unschedule the job first if needed.

DROP FUNCTION IF EXISTS public.set_daily_sync_token(text);
