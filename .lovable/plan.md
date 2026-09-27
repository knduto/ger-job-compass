# German IT Job Intelligence Dashboard

A private, data-driven workspace for your Chancenkarte move: it pulls live IT job postings from the German Federal Employment Agency every day, builds a growing database, and turns it into city-by-city settlement reports.

## What you get

**1. Explore (job search)**
- Search across your role keywords (IT Operations Manager, IT Service Manager, IT-Leiter, System Engineer, Cloud, Digitalisierung, and the rest of your list).
- Filters: keyword, city/region, radius, employer, publication date, contract type (permanent/temporary), working time (full/part time), remote/home office, temp-agency postings on/off, entry date, and sorting.
- Each posting opens a detail view with full description, employer, location, contact and the original listing link.

**2. Pipeline**
- Save any posting to your pipeline and move it through stages: Saved → Applied → Interview → Offer → Rejected.
- Per application: date applied, which resume version you sent, contact person, notes, follow-up reminder date.
- Kanban board plus a table view, with counts and conversion rates per stage.

**3. Employers**
- Ranked list of employers by number of open IT roles, cities they hire in, role mix, and first/last time seen.
- Employer profile page with all their postings over time, so you can spot who is consistently hiring.

**4. City reports (settlement decision)**
- Top 30 German cities by IT job volume, computed from your own collected data rather than a fixed list.
- Per city: total postings, new postings per week, trend direction, top employers, top role titles, share of remote roles, share of permanent contracts, demand concentration (how dependent the city is on a few employers).
- A comparison view to put candidate cities side by side, plus a weighted score you can tune (volume, growth, role fit, remote share, employer diversity) to rank settlement options.

**5. Data health**
- Daily sync status: last run, records fetched, new vs updated vs expired, failures and retries.
- Completeness metrics: % of postings with salary info, employer name, geo coordinates, contact details.
- Duplicate detection, stale-posting flags, and a history chart of database growth.

**6. Daily live fetch tab**
- One-click "Fetch now" plus an automatic daily run.
- Runs your keyword list across Germany, paginates through all results, fetches details for new postings, and records every run in a log you can inspect.
- Postings not seen for a configurable number of days get marked expired instead of deleted, so history stays intact for trend reports.

## Access

Private to you: a single login gates the whole dashboard. Nothing is publicly visible.

## Technical approach

- Enable Lovable Cloud for the database, auth, scheduled job and stored secrets.
- Tables: `jobs` (refnr as natural key, title, employer, city, postal code, lat/lng, published/entry dates, contract fields, raw payload, first_seen/last_seen, expired flag), `job_details` (full description and contact from the detail endpoint), `employers` (derived/aggregated), `applications` (pipeline with stage, notes, resume version, reminders), `sync_runs` (per-run stats and errors), `search_keywords` (editable keyword list), `city_metrics` (materialised daily aggregates for fast reports). All tables RLS-scoped to the signed-in owner; `GRANT`s included in the migration.
- Ingestion via a server function calling `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/app/jobs` with header `X-API-KEY: jobboerse-jobsuche`, using the documented parameters (`was`, `wo`, `umkreis`, `berufsfeld`, `arbeitgeber`, `veroeffentlichtseit`, `zeitarbeit`, `angebotsart`, `befristung`, `arbeitszeit`, `behinderung`, `page`, `size`, `sort`). Details come from `/pc/v4/jobdetails/{base64(refnr)}`. Upsert on `refnr`; requests throttled and paginated with retry/backoff.
- Daily schedule: pg_cron hitting a route under `src/routes/api/public/` protected by a generated shared secret, which triggers the same ingestion path as the manual button.
- City metrics recomputed after each sync into `city_metrics`; report pages read the aggregates, so charts stay fast as the database grows.
- Frontend: TanStack Start routes (`/` overview, `/explore`, `/jobs/$refnr`, `/pipeline`, `/employers`, `/employers/$id`, `/reports`, `/reports/compare`, `/data-health`, `/sync`), TanStack Query for data, Recharts for trends and comparisons.

## Build order

1. Enable Cloud, schema + RLS, login gate.
2. Ingestion server function, manual "Fetch now", sync log.
3. Explore + filters + job detail.
4. Pipeline board and application tracking.
5. Employers list and profiles.
6. City metrics, reports and comparison scoring.
7. Data health dashboard.
8. Daily schedule and a first full backfill run.
