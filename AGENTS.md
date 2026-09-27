<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- Job data comes only from the Arbeitsagentur API: search `pc/v6/jobs`, details `pc/v4/jobdetails/{base64(refnr)}` with `X-API-KEY: jobboerse-jobsuche` — v4 search and v6 details return 403.
- Sync logic lives in `src/lib/sync.server.ts`, shared by the manual sync (per-keyword server fn calls from the browser) and the daily cron route `/api/public/cron/daily-sync` — one code path keeps numbers consistent.
- Each keyword is queried per IT berufsfeld from `src/lib/it-fields.ts` (exact API facet names); only postings with a German location are stored — keeps data IT-only and Germany-only.
- Jobs are upserted by `refnr` and only marked expired after a complete, error-free run where they were unseen for 3 days — never deleted, so history is preserved.
- Job/sync tables are written only via service role on the server; the browser reads them through RLS (authenticated), and `applications` is scoped to `auth.uid()`.
- City/employer aggregates are SQL views (`city_stats`, `employer_stats`, `city_employer_share`) with security_invoker; "new" counts use the agency's first-publication date, not our first_seen.
- Daily cron token is stored in vault as `daily_sync_token` (set via `set_daily_sync_token`, service_role only) and matches `LOVABLE_CRON_SECRET`.

- Language classifications and daily market snapshots are evidence-based derivatives of stored Arbeitsagentur listings; vague German wording never receives an inferred CEFR level.
