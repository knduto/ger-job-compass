-- ROLLBACK for 0007_create_login_codes.sql
-- NEVER RUN AUTOMATICALLY. Review and test in an isolated draft first.
-- DATA LOSS: drops all pending login verification codes. Any code already sent
-- to a user stops working. Take a backup before running this.

drop index if exists public.login_codes_user_created_idx;
drop table if exists public.login_codes;
