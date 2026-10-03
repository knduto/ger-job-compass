# Changelog

All notable changes to Smart-DE-Reise are documented here, in a style based on [Keep a Changelog](https://keepachangelog.com/).

**On dates**: `git log` for this repository shows nearly all commits (over 100) dated **2026-09-27**, with messages that are almost entirely non-descriptive (`Changes`, `Update plan`); only a handful of commits have descriptive messages, listed below with their actual commit dates. The one exception is the initial template commit, dated 2026-09-22. Because the vast majority of commits carry no useful message or distinguishing date, the entries below are **derived from `roadmap.md`'s completed items and from the schema history in `MIGRATIONS.md`** (which records a migration date of 2026-09-27 for every migration, 0000–0006), not from individual commit messages. Where a change can be tied to a specific dated commit, that commit hash and date are cited; otherwise the entry is dated "2026-09-27 (undated within day — derived from roadmap.md / MIGRATIONS.md, exact time-of-day sequence not verifiable from git history)".

## 2026-10-03 — Chancenkarte visa / work-permit scanner

### Added
- `job_visa_feasibility` table (migration 0009, backward-compatible) storing status, flags and exact evidence excerpts.
- Negation-aware German/English scanner (restricted > work permit required > international friendly > unspecified) with unit tests.
- Reports bulk runner and status counts, job-detail "Chancenkarte & Arbeitserlaubnis" card, Explore "Visum / Arbeitserlaubnis" filter and list badge.

## 2026-09-28 — Two-step login, registration closed

### Added
- Two-step sign-in: password, then a 6-digit verification code sent by e-mail (valid 10 minutes, single use).
- `login_codes` table (migration 0007) storing only hashed codes, server-only access.

### Changed
- Login screen is now a two-step flow with a dedicated code screen, expiry countdown and resend cooldown.

### Removed
- Public registration and the public password-reset entry point. Recovery links already sent still work.


## [Unreleased]

Staged documentation rollout (each stage built and reviewed in its own draft):

- Stage 1 — `MIGRATIONS.md`, `drizzle/rollbacks/*.down.sql` for migrations 0000–0006, seed script.
- Stage 2 — `README.md`, `SETUP.md`, `.env.example`, `STACK.md`, `REQUIREMENTS.md`.
- **Stage 3 (this change)** — `ARCHITECTURE.md`, `CHANGELOG.md`, and this roadmap update.
- Stage 4 (planned, not yet done) — `CONTRIBUTING.md`, `DEPLOYMENT-LOCAL.md`, `AGENTS.md` updates.

## History

Entries are ordered oldest to newest. Unless a commit hash is cited, the date is 2026-09-27 and the source is `roadmap.md` / `MIGRATIONS.md` rather than a git commit message.

### 2026-09-22 — Project template
- Initial TanStack Start + Supabase project template applied. Source: commit `07342b2` ("template: tanstack_start_ts_current-78c8e5169cf8").

### 2026-09-27 — Initial data model and build-out
- Baseline schema created: `search_keywords` (28 seeded terms), `jobs`, `job_details`, `sync_runs`, `applications` (+ `validate_application` trigger), and views `city_stats`/`employer_stats` (migration `0000_init_smart_de_reise.sql`). Source: `MIGRATIONS.md`.
- IT filter and accessibility rules added. Source: commit `d5d321c` ("Added IT filter & acc. rules").
- Live-Abruf (live-fetch/sync) suite finalized. Source: commit `cd5f739` ("Finalized Live-Abruf suite").
- English report builder added. Source: commit `bfc975a` ("Added English report builder").
- Export and Live-Abruf layout fixed. Source: commit `e42a8ee` ("Fixed export & Live-Abruf layout").
- Scoring explanations UI added (city scoring methodology surfaced to users). Source: commit `8fe1acc` ("Added scoring explanations UI").

### 2026-09-27 — Data-sync engine hardening
- Top-employer concentration view added (`city_employer_share`, migration `0001_city_stats_concentration.sql`). Source: `MIGRATIONS.md`.
- "New" job counts switched to agency first-publication date rather than first-seen-by-app date (migration `0002_city_stats_by_publication.sql`, flagged as a semantic change to `city_stats.new_7d`/`new_30d`). Source: `MIGRATIONS.md`.
- Daily-sync cron token setter added, enabling `pg_cron`/`pg_net` for the scheduled sync (migration `0003_cron_token_setter.sql`). Source: `MIGRATIONS.md`.
- Manual city list feature added. Source: commit `249cd4c` ("Added manual city list").
- On-demand city fetch added (split into start/step/finish server functions to stay within request time limits). Source: commit `b43dc86` ("Added on-demand city fetch").
- City-search timeout bug fixed. Source: commit `b6dc209` ("Fixed city search timeout bug").
- City-search crash fixed. Source: commit `3ed2cdd` ("Fixed city-search crash").

### 2026-09-27 — Language analysis and market snapshots
- `job_language_analysis` and `market_snapshots` tables added, with evidence-based German/English requirement classification (migration `0004_add_language_analysis_and_market_snapshots.sql`). Source: `MIGRATIONS.md`, and confirmed by the roadmap item "Add evidence-based language processing and daily snapshots" (checked in `roadmap.md`).

### 2026-09-27 — Reporting upgrade
- Filterable reports built with city, language, employer, lifecycle, and trend sections; PDF and Excel export added; language coverage surfaced on the data-health page; Live-Abruf search-term layout fixed. Source: `roadmap.md`, section "Reporting upgrade" (all items checked).

### 2026-09-27 — Tracked cities
- `tracked_cities` table added, giving each signed-in user a personal, RLS-scoped list of cities to track in reports (migration `0005_create_tracked_cities.sql`). Source: `MIGRATIONS.md`.

### 2026-09-27 — Permanent city-request crash repair
- Replaced unstable area/scope popup controls, contained city-section render/request failures, marked interrupted city runs as incomplete, and verified repeated selections across both signed-in request scopes. Source: `roadmap.md`, section "Permanent city-request crash repair" (all items checked).

### 2026-09-27 — Security hardening
- `search_keywords` RLS fixed. Source: commit `5bd8ac7` ("Fixed search keywords RLS").
- HTML error page bleed into server-function RPC responses fixed (the fix that produced the current `handlerType === "serverFn"` rethrow rule in `src/start.ts`). Source: commit `a47439d` ("Fixed HTML error page bleed").
- `search_keywords` scoped to its owner (`user_id` column added, backfilled, `NOT NULL`, owner-only RLS policies) — migration `0006_scope_search_keywords_to_owner.sql`. This migration also documents a known gap (server-side sync paths still read all users' keywords unfiltered), tracked as OPEN-001 in `roadmap.md`. Source: `MIGRATIONS.md`.

### 2026-09-27 — Forgot-password
- Password-reset request and completion flow added (`auth.tsx` reset mode, `reset-password.tsx`). No dedicated commit message was found naming this feature explicitly; dated from the file's presence at HEAD and `MIGRATIONS.md`'s 2026-09-27 baseline. **Exact date/commit not independently verifiable from git history — flagged as uncertain.**

### 2026-09-27 — Documentation stages
- Stage 1 (rollback files, `MIGRATIONS.md`, seed script) delivered and reintegrated. Source: `roadmap.md` (checked) and commit `5d8127e` ("Reintegrated Stage 1 work").
- Project `README.md` added. Source: commit `184cbc5` ("Add project README").
- Stage 2 (`README.md`, `SETUP.md`, `.env.example`, `STACK.md`, `REQUIREMENTS.md`) delivered. Source: `roadmap.md`.

