
create extension if not exists pg_cron;
create extension if not exists pg_net;
create or replace function public.set_daily_sync_token(t text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'daily_sync_token';
  if sid is null then perform vault.create_secret(t, 'daily_sync_token');
  else perform vault.update_secret(sid, t); end if;
end $$;
revoke all on function public.set_daily_sync_token(text) from public, anon, authenticated;
grant execute on function public.set_daily_sync_token(text) to service_role;
