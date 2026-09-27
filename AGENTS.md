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
- Sync logic lives in `src/lib/sync.server.ts`, shared by manual, city, and daily runs; city runs call one keyword/IT-field pair per request and finalize exact deduplicated totals without rebuilding global snapshots — short requests prevent page-level timeouts while preserving accurate counts.
- Each keyword is queried per IT berufsfeld from `src/lib/it-fields.ts` (exact API facet names); only postings with a German location are stored — keeps data IT-only and Germany-only.
- Jobs are upserted by `refnr` and only marked expired after a complete, error-free run where they were unseen for 3 days — never deleted, so history is preserved.
- Job/sync tables are written only via service role on the server; the browser reads them through RLS (authenticated), and `applications` is scoped to `auth.uid()`.
- City/employer aggregates are SQL views (`city_stats`, `employer_stats`, `city_employer_share`) with security_invoker; "new" counts use the agency's first-publication date, not our first_seen.
- Daily cron token is stored in vault as `daily_sync_token` (set via `set_daily_sync_token`, service_role only) and matches `LOVABLE_CRON_SECRET`.

- Language classifications and daily market snapshots are evidence-based derivatives of stored Arbeitsagentur listings; vague German wording never receives an inferred CEFR level.
- City-sync selection uses inline segmented buttons and a local error boundary so a control failure cannot replace the entire Live-Abruf page.
- Global error handling preserves TanStack server-function responses and renders the standalone HTML error page only for document requests — RPC errors must remain catchable inside their calling section.

# Process rules

- Every new migration in `drizzle/migrations/` ships with a matching `drizzle/rollbacks/NNNN_name.down.sql` and a `MIGRATIONS.md` log row using its compatibility criteria — rollbacks and the log keep schema history reversible and auditable.
- Larger documentation work is delivered in stages, each built in an isolated draft and accepted by the owner before the next stage — the owner reviews before anything lands in main.
- `.env` and `.env.*` are gitignored; only `.env.example` with placeholder values is committed — real connection values never enter git.
- Every new database migration must include a matching rollback file in `drizzle/rollbacks/`, update `MIGRATIONS.md`, classify the migration as backward-compatible or breaking using the documented criteria, and flag ambiguous cases for review.
- Every planned stage of work must be built in an isolated draft first, reviewed and explicitly accepted by John, and only then merged into the main project; never write staged work directly to main before that review.
- Never commit `.env` or any file containing secrets; commit only `.env.example` with safe placeholder values, and keep `.env` plus environment-specific variants ignored by Git.
