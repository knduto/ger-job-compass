# Architecture

This document describes how Smart-DE-Reise (Germany Job Explorer) is put together: the runtime system, the data flow from the Bundesagentur für Arbeit (BA) into the database and out to the UI, the sync engine's rules, the security model, and where the relevant code lives. It cross-references `MIGRATIONS.md` for schema/migration detail and `README.md` for the project description; it does not repeat their content. (`STACK.md` and `REQUIREMENTS.md` are referenced in the Stage 3 task brief but were not found in this draft at the time of writing — see the report for this discrepancy.)

## 1. System overview

- **Front end**: TanStack Start (React 19, Vite 7) with server-side rendering (SSR). Routing is file-based via TanStack Router (`src/routes/`), data fetching uses TanStack Query, and UI is built from shadcn/Radix components in `src/components/ui/`.
- **Backend**: Lovable Cloud — a hosted Postgres database (via Supabase) providing authentication, row-level security (RLS), and SQL views. There is no separate custom backend server process; server-side logic runs as TanStack Start server functions and server routes, executed by the same Vite/Start server that renders pages (`src/server.ts`, `src/start.ts`).
- **External data source**: the Arbeitsagentur ("BA") Jobsuche REST API is the sole external system the app talks to for job data (`src/lib/ba-api.server.ts`). The app never accepts job data from any other source.

## 2. Data flow (ASCII)

```
                       ┌─────────────────────────────┐
                       │  Arbeitsagentur Jobsuche API │
                       │  (pc/v6/jobs, pc/v4/jobdetails)│
                       └───────────────┬─────────────┘
                                       │ HTTPS (server-side fetch, retried w/ backoff)
                                       ▼
                   ┌────────────────────────────────────┐
                   │   Sync engine (service role)        │
                   │   src/lib/sync.server.ts            │
                   │   src/lib/sync.functions.ts         │
                   │   src/routes/api/public/cron/...    │
                   └───────────────┬──────────────────────┘
                                   │ upsert by refnr (service-role client, bypasses RLS)
                                   ▼
       ┌───────────────────────────────────────────────────────────┐
       │ Postgres (Lovable Cloud / Supabase)                        │
       │ tables: jobs, job_details, job_language_analysis,          │
       │         market_snapshots, sync_runs, search_keywords,      │
       │         tracked_cities, applications                       │
       │ views:  city_stats, employer_stats, city_employer_share    │
       │ (see MIGRATIONS.md for full column/policy detail)          │
       └───────────────┬───────────────────────────────┬───────────┘
                        │ RLS-scoped reads (anon/authenticated key)  │ RLS-scoped reads
                        ▼                                            ▼
             ┌─────────────────────┐                    ┌─────────────────────────┐
             │ Browser: pages under │                    │ Reports (reports.tsx)   │
             │ src/routes/_authenticated/*               │ reads jobs/views/       │
             │ (dashboards, explore, jobs, employers,    │ market_snapshots only,  │
             │ pipeline, sync, data-health)               │ never calls the BA API  │
             └─────────────────────┘                    └────────────┬────────────┘
                                                                       │
                                                                       ▼
                                                        PDF / Excel export
                                                        (report-pdf.ts, report-xlsx.ts)
```

Second path — browser to server-function (RPC):

```
Browser (React component)
   │  useServerFn(...) call, e.g. startSyncRun / cityRunStep / loadJobDetail / getReportData
   ▼
attachSupabaseAuth (client middleware, src/integrations/supabase/auth-attacher.ts)
   │  attaches `Authorization: Bearer <access_token>` from the current Supabase session
   ▼
requireSupabaseAuth (server middleware, src/integrations/supabase/auth-middleware.ts)
   │  validates the bearer token via supabase.auth.getClaims(); rejects missing/invalid tokens
   │  attaches { supabase (RLS-scoped client), userId, claims } to the function context
   ▼
Server function handler (src/lib/*.functions.ts)
   │  uses context.supabase for RLS-scoped reads, or dynamically imports
   │  src/integrations/supabase/client.server.ts (service role) for privileged writes
   ▼
Postgres
```

## 3. Request lifecycle and error handling

TanStack Start distinguishes **document requests** (full page navigations/SSR) from **server-function RPC calls** (the JSON protocol used by `createServerFn`/`useServerFn`). This project's global error middleware in `src/start.ts` treats them differently, and the rule is deliberate and documented in code comments:

- For `handlerType === "serverFn"`, the middleware **rethrows** the error unchanged. Server functions have their own serialized error protocol; replacing their response with an HTML document would make `useServerFn` fail unpredictably at the router boundary and could take down the calling page. RPC errors therefore stay catchable at the call site (e.g. the `try/catch`+`toast.error` pattern used in `sync.tsx`, `auth.tsx`, `reports.tsx`).
- For **document requests**, unexpected errors (anything without a `statusCode`, i.e. not an intentional HTTP error) are logged and replaced with a plain static HTML error page (`renderErrorPage()` in `src/lib/error-page.ts`), returned with status 500. This avoids leaking a broken SSR tree to the browser.
- `src/server.ts` adds a second layer in front of the Start server-entry: it detects a specific failure mode where the underlying `h3` HTTP layer swallows a thrown error into a generic `{"unhandled":true,"message":"HTTPError"}` JSON body for an HTML-accepting request, and — only in that case — replaces the response with the same static error page. `src/lib/error-capture.ts` supports this by wrapping `console.error` to retain the original `Error` (with stack and `cause` chain) for a few seconds so the swallowed error can still be logged with detail.
- `src/routes/__root.tsx` additionally defines a router-level `errorComponent` and `notFoundComponent` for in-app (client-rendered) error/404 boundaries, and reports caught errors via `reportLovableError` (`src/lib/lovable-error-reporting.ts`).
- `src/components/SectionErrorBoundary.tsx` is used to contain failures within a page section (used on the sync page) so one failing sub-request does not take down the whole page.

**Auth attachment**: `attachSupabaseAuth` (client-side function middleware, registered globally in `src/start.ts`) reads the current Supabase session and attaches the bearer token to every server-function RPC. `requireSupabaseAuth` (server-side function middleware) is applied per-function via `.middleware([requireSupabaseAuth])` on each server function that needs an authenticated user; it validates the token, rejects requests without a valid Bearer JWT, and hands the calling function an RLS-scoped Supabase client plus `userId`/`claims`.

**Service-role vs RLS reads**: two distinct Supabase clients exist:
- `src/integrations/supabase/client.ts` — browser client, publishable key, subject to RLS.
- `src/integrations/supabase/client.server.ts` — `supabaseAdmin`, service-role key, **bypasses RLS**. This is dynamically imported only inside server functions/routes that need privileged writes (sync, language analysis, cron). It must never be imported into route/`*.functions.ts` files at the top level because those ship to the client bundle (documented in the file's own comment).
- `requireSupabaseAuth` additionally creates a per-request Supabase client scoped to the caller's bearer token (`context.supabase`), used for RLS-scoped reads inside otherwise-privileged server functions (e.g. `loadJobDetail` reads cached details this way before falling back to the admin client for the write).

The `/_authenticated` route (`src/routes/_authenticated/route.tsx`) gates the whole authenticated app: it runs client-side only (`ssr: false`), calls `supabase.auth.getUser()` in `beforeLoad`, and redirects to `/auth` if there is no session.

## 4. Sync engine

Code: `src/lib/ba-api.server.ts`, `src/lib/sync.server.ts`, `src/lib/sync.functions.ts`, `src/routes/api/public/cron/daily-sync.ts`, `src/lib/it-fields.ts`.

- **BA API client** (`ba-api.server.ts`): calls `pc/v6/jobs` for search and `pc/v4/jobdetails/{base64(refnr)}` for details, with retry/backoff on 429 and 5xx (up to 3 retries, exponential backoff) and a fixed 350 ms polite delay between calls (`politeDelay`).
- **Manual sync** (`startSyncRun` / `syncOneKeyword` / `finishSyncRun` in `sync.functions.ts`): a full run iterates all active `search_keywords`, one keyword at a time (kept as separate short server-function calls to stay under request time limits), across all four `IT_BERUFSFELDER` fields.
- **City sync** (`startCityRun` / `cityRunStep` / `finishCityRun` / `abandonCityRun`): an on-demand fetch for one city, either across all active keywords or as an unfiltered "all IT jobs in this city" search. It is deliberately split into **one keyword/field pair per short request** (`cityRunStep`) because looping over every keyword inside a single call exceeded the platform's request time limit (see the code comment in `sync.functions.ts`). Each `sync_runs` row created with `trigger: "city"` is explicitly excluded from the expiry logic (see below).
- **Dedup**: within a sync pass, jobs are deduplicated in-memory by exact `refnr` (`Map` keyed by reference number) before touching the database; multiple keyword/field combinations that surface the same posting merge their `berufsfelder`/`keywords` arrays. Persistence is an upsert on `refnr` (`onConflict: "refnr"`), batched in chunks of ≤300 (reads) / ≤200 (writes).
- **Location and field filter**: only postings with a German address (`adresse.land === "DEUTSCHLAND"`) are kept; everything else is counted as `skipped` and dropped. Only the four IT `berufsfelder` in `it-fields.ts` are ever queried (`Informatik`; `IT-Netzwerktechnik, -Administration, -Organisation`; `IT-Systemanalyse, -Anwendungsberatung und -Vertrieb`; `Softwareentwicklung und Programmierung`), so the database only ever contains IT-professional-field postings.
- **No global expiry from partial runs**: `finishRun` only marks postings `expired = true` (postings not seen for `expireDays` = 3 days) when the run is a **full, keyword-driven run** (`trigger !== "city"`), it processed **all** keywords (`keywords_done >= keywords_total`), and it finished **without errors**. City runs and any run that errored or was left incomplete never trigger expiry. Successful full runs also trigger `recordMarketSnapshots`, which aggregates all jobs + their language analysis into one `market_snapshots` row per city per day (upsert on `(snapshot_date, city)`).
- **Daily cron** (`src/routes/api/public/cron/daily-sync.ts`, `POST /api/public/cron/daily-sync`): authenticated by `authenticateCronRequest` (`src/integrations/supabase/cron-auth.ts`), which requires a `Bearer` token matching `LOVABLE_CRON_SECRET` (or `LOVABLE_CRON_SECRET_PREVIOUS` during rotation), compared with `timingSafeEqual`. The route runs a full keyword sync, then a batch of up to 50 language analyses, then `finishRun`. Migration `0003_cron_token_setter.sql` (see `MIGRATIONS.md`) provides the vault-backed `set_daily_sync_token(text)` function (service-role only) used to store/rotate that secret; scheduling itself relies on `pg_cron`/`pg_net`, enabled by the same migration. The brief's "05:00 UTC" cadence is the intended external cron schedule; it is **not visible in the application code reviewed here** (the schedule is configured at the `pg_cron` job level, not in a source file), so this is stated as the intended behaviour rather than something verified by reading a file.
- **Job detail fetch/cache** (`loadJobDetail` in `sync.functions.ts`): reads `job_details` first; on cache miss or explicit refresh, fetches from the BA API, upserts `job_details`, and immediately classifies the description via `classifyLanguage` into `job_language_analysis`.

## 5. Language analysis and market snapshots

Code: `src/lib/language-analysis.server.ts`.

- `classifyLanguage(description)` is **evidence-based**: it strips HTML, then looks for explicit CEFR mentions near the words "deutsch"/"german" (regex-based proximity match). A CEFR level (`A1`–`C2`) is only ever assigned when it is **explicitly written** in the text; if German is mentioned without an explicit level, the classification falls back to `german_unspecified` ("German required, level unclear" in report language) — the code never infers a level.
- Other classifications: `german_optional` (German described as "wünschenswert"/"von Vorteil"/"nice-to-have"/etc.), `english_accessible` (explicit "no German required" or "English is the working language" phrasing), `unknown` (no relevant signal found). Each classification stores up to 4 short evidence snippets (`evidence: string[]`) so a reviewer can see why a job was classified a certain way.
- `analyseLanguageBatch(admin, limit)` processes up to `limit` not-yet-analysed active jobs (ordered by most recently published) per call, fetching job details from the BA API as needed. This is invoked both from the manual/daily sync path and directly from the reports page (`processLanguageBatch` server function), so the reports UI can trigger incremental backfill of missing analyses.
- **Coverage caveat**: language analysis coverage is necessarily partial — only jobs that have had their detail fetched and classified appear with a `language` object; anything else shows as "not yet analysed" in reports (`report-metrics.ts` categorises this explicitly as its own bucket, "Noch nicht analysiert"). Reports and market snapshots report this coverage figure (`analysed_jobs` in `market_snapshots`, `analysed` in `buildReportMetrics`) so consumers can see how complete the language data is, rather than assuming full coverage.
- `market_snapshots` (see `MIGRATIONS.md`, migration `0004`) stores one row per city per day: active/expired counts, new-in-7-days, employer count, salary/remote percentages, and language coverage counts (`analysed_jobs`, `german_required`, `english_accessible`). Snapshots are written only after a successful full sync run (see §4).

## 6. Reports

Code: `src/routes/_authenticated/reports.tsx`, `src/lib/reports.functions.ts`, `src/lib/report-metrics.ts`, `src/lib/report-pdf.ts`, `src/lib/report-xlsx.ts`.

- **Database-only reads**: `getReportData` and the reports page query only `jobs`, `job_language_analysis`, and `market_snapshots` in Postgres. There is no live call to the Arbeitsagentur API from the reports path — reports always reflect the state of the database as of the last sync.
- **City/employer SQL views**: `city_stats`, `employer_stats`, and `city_employer_share` (see `MIGRATIONS.md` migrations `0000`/`0001`/`0002`) are created `with (security_invoker = on)`, meaning they run with the querying user's own permissions/RLS rather than the view owner's — so they cannot be used to bypass row-level security.
- **"New" postings counted by agency publication date**: migration `0002_city_stats_by_publication.sql` changed `city_stats.new_7d`/`new_30d` to be based on the job's own publication window rather than when the app first saw it; `report-metrics.ts`'s `new7` figure similarly uses `published_from`/`first_published`, matching that intent (see the "Flagged" note on 0002 in `MIGRATIONS.md` about the semantic change).
- **Per-user tracked cities with top-30 fallback**: `tracked_cities` (migration `0005`) lets each signed-in user save which cities they care about (`fetchTrackedCities`/`addTrackedCity`/`removeTrackedCity` in `src/lib/queries.ts`), scoped by RLS to `auth.uid() = user_id`. The reports page code was not found to implement a "top-30 fallback" as a distinct code path in the files reviewed; `fetchAllCityStats()` (`queries.ts`) fetches up to 1000 cities from `city_stats` ordered by `active_jobs`, and the reports UI combines this with the user's tracked list. Readers should treat the exact "top-30 fallback" behaviour as **not directly confirmed** in the reviewed source and check the live `reports.tsx` UI logic if precise behaviour matters.
- **Export path**: `downloadReportPdf` (`report-pdf.ts`) builds a multi-section PDF client-side with `jspdf`/`jspdf-autotable` (city ranking, language requirement breakdown, top employers, methodology notes) and triggers a browser download. `downloadReportXlsx` (`report-xlsx.ts`) builds a multi-sheet workbook client-side with the `xlsx` library (overview, cities, language, employers, lifecycle, trends, raw filtered rows) and triggers a download. Both run entirely in the browser against data already fetched via `getReportData`; no server-side file storage is involved.

## 7. Security model

RLS is enabled on every application table. Summary (see `MIGRATIONS.md` for the exact migration each policy came from):

| Table | Read | Write | Notes |
|---|---|---|---|
| `search_keywords` | Owner-scoped (`auth.uid() = user_id`) as of migration `0006` | Owner-scoped | Pre-`0006` was open to all authenticated users; `0006` scoped it to the owner but **server-side sync code still reads all users' keywords without an owner filter** — see OPEN-001 below. |
| `jobs` | All authenticated users (shared) | Service role only | No `INSERT`/`UPDATE`/`DELETE` grant to `authenticated`; all writes go through the sync engine's service-role client. |
| `job_details` | All authenticated users (shared) | Service role only | Same pattern as `jobs`. |
| `job_language_analysis` | All authenticated users (shared) | Service role only | |
| `market_snapshots` | All authenticated users (shared) | Service role only | |
| `sync_runs` | All authenticated users (shared) | Service role only | |
| `tracked_cities` | Owner-scoped | Owner-scoped (insert/select/delete policies only — no explicit update policy was found in migration `0005`) | |
| `applications` | Owner-scoped | Owner-scoped | Enforced both by RLS policies and by a `validate_application` trigger that checks `stage` is one of the five allowed values and stamps `updated_at`. |
| `city_stats`, `employer_stats`, `city_employer_share` (views) | All authenticated users, via `security_invoker = on` | N/A (views) | Run with the caller's own RLS, not elevated. |

Additional points:
- **No anonymous sign-ups path was found**: `auth.tsx` only offers email/password sign-in, sign-up, and password reset via `supabase.auth`; there is no anonymous-auth code path in the reviewed files. (This describes what the reviewed sign-in/sign-up code does; it does not confirm whether anonymous sign-ups are disabled at the Supabase project-configuration level, which is outside the source tree.)
- **Vault-stored cron token**: the daily cron endpoint is protected by a shared secret (`LOVABLE_CRON_SECRET`) compared with `timingSafeEqual`, with `LOVABLE_CRON_SECRET_PREVIOUS` supporting rotation without downtime. The secret is set via the service-role-only `set_daily_sync_token(text)` function added in migration `0003` (see `MIGRATIONS.md`), i.e. it lives in Postgres Vault rather than in application code or `.env`.
- **`user_roles` table**: the Stage 3 task brief lists `user_roles` among the schema to document, but no `user_roles` table was found in `drizzle/migrations/0000`–`0006` or anywhere in `src/`. This appears to be a discrepancy between the brief and the actual schema — see the report for this task.

## 8. Known open item

**OPEN-001** (tracked in `roadmap.md`, originating from migration `0006`): migration `0006` scoped `search_keywords` to its owner for browser reads/writes, but the following server-side paths still read **all users' active keywords with no owner filter**, using the service-role client (which bypasses RLS entirely, so the policy change has no effect on them):
- `src/routes/api/public/cron/daily-sync.ts` (daily scheduled sync)
- `src/lib/sync.functions.ts` (`startSyncRun`, `startCityRun` in keyword mode)
- `src/lib/sync.server.ts` (`startRun`'s active-keyword count)

Impact today is none, because the project has a single user. A fix requires explicit confirmation before any code change, per `roadmap.md`.

## 9. Where things live (file map)

```
src/
  start.ts                     global server middleware: error handling, CSRF, auth attach
  server.ts                    outermost fetch handler; catches h3-swallowed errors
  router.tsx                   TanStack Router + React Query client setup
  routeTree.gen.ts             generated route tree (do not hand-edit)
  routes/
    __root.tsx                 root route: head tags, error/not-found components, auth-state listener
    auth.tsx                   sign-in / sign-up / request password reset
    reset-password.tsx         password recovery completion
    api/public/cron/daily-sync.ts   cron-triggered full sync endpoint
    _authenticated/
      route.tsx                 auth guard + AppShell wrapper for all authenticated pages
      index.tsx                 overview dashboard
      explore.tsx                job search/browse with filters
      jobs.$refnr.tsx            single job detail page (fetches/caches description)
      employers.tsx               employer list (employer_stats view)
      employers_.$name.tsx        single employer profile
      pipeline.tsx                 application tracking (applications table)
      reports.tsx                  market/language/employer reports + PDF/Excel export
      sync.tsx                     manual sync + city on-demand fetch UI
      data-health.tsx              data completeness/freshness dashboard
  lib/
    ba-api.server.ts             BA Jobsuche API client (search + details)
    sync.server.ts               core sync logic: mapping, dedup, upsert, expiry, snapshots
    sync.functions.ts            server functions wrapping sync.server.ts for the browser
    language-analysis.server.ts  evidence-based German/English requirement classification
    reports.functions.ts         server functions for report data + language batch processing
    report-metrics.ts            client-side aggregation of report rows into city/employer/language stats
    report-pdf.ts / report-xlsx.ts   client-side export builders
    queries.ts                   shared Supabase query helpers (cities, applications, pipeline)
    it-fields.ts                 IT berufsfeld list, application stages, contract labels
    error-page.ts / error-capture.ts   static HTML error page + error-detail capture for logging
  integrations/supabase/
    client.ts                    browser Supabase client (RLS-scoped)
    client.server.ts             service-role Supabase client (server-only, bypasses RLS)
    auth-middleware.ts            requireSupabaseAuth server middleware (validates bearer token)
    auth-attacher.ts               attachSupabaseAuth client middleware (adds bearer token to RPCs)
    cron-auth.ts                    authenticateCronRequest for the daily-sync endpoint
    types.ts                        generated database types
  components/                    AppShell (nav), JobRow, RunTable, SectionErrorBoundary, ui/*
drizzle/
  migrations/                    0000–0006, see MIGRATIONS.md
  rollbacks/                     matching *.down.sql files, never auto-run
```

## See also

- `MIGRATIONS.md` — full migration log, compatibility verdicts, and rollback files.
- `README.md` — project description.
- `roadmap.md` — staged documentation plan and open items (including OPEN-001).
