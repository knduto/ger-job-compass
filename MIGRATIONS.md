# Database migrations

Migrations live in `drizzle/migrations/`. Hand-written rollbacks live in `drizzle/rollbacks/` and are **never run automatically** — each must be reviewed (and tested in a draft) before use. Seed data lives separately in `scripts/seed/`.

## Compatibility criteria

- **Yes (backward-compatible):** additive tables, views, functions, indexes or policies; new nullable columns or columns with a default; widening a type; a policy that does not hide rows the running app already reads.
- **No (breaking):** dropping or renaming tables/columns; changing or narrowing a type; new `NOT NULL` without a default; new constraints existing rows or app writes may fail; replacing a policy or view so the app loses rows or columns it uses.
- **Flagged:** ambiguous — the reason is written in the entry.
- **N/A (baseline):** 0000, the initial schema.

## Migration log

| Date (UTC) | File | Purpose | Tables / columns affected | Backward-compatible | Rollback |
|---|---|---|---|---|---|
| 2026-09-27 | `0000_init_smart_de_reise.sql` | Initial schema, 28 seeded keywords | `search_keywords`, `jobs`, `job_details`, `sync_runs`, `applications` (+ `validate_application` trigger), views `city_stats`, `employer_stats` | N/A (baseline) | `0000_init_smart_de_reise.down.sql` (data loss) |
| 2026-09-27 | `0001_city_stats_concentration.sql` | Top-employer concentration per city | new view `city_employer_share` (`city`, `top_employer_pct`) | Yes — new view only (uses `CREATE OR REPLACE` but the view did not exist before) | `0001_city_stats_concentration.down.sql` |
| 2026-09-27 | `0002_city_stats_by_publication.sql` | "New" counts use agency publication date | view `city_stats`: `new_7d`, `new_30d` semantics | Flagged — view replaced; columns unchanged, but values of `new_7d`/`new_30d` changed meaning | `0002_city_stats_by_publication.down.sql` |
| 2026-09-27 | `0003_cron_token_setter.sql` | Daily-sync token setter; enables `pg_cron`, `pg_net` | function `set_daily_sync_token(text)` (service_role only) | Yes | `0003_cron_token_setter.down.sql` |
| 2026-09-27 | `0004_add_language_analysis_and_market_snapshots.sql` | Evidence-based language classification and daily snapshots | new tables `job_language_analysis`, `market_snapshots` + indexes | Yes | `0004_add_language_analysis_and_market_snapshots.down.sql` |
| 2026-09-27 | `0005_create_tracked_cities.sql` | User-managed report cities | new table `tracked_cities` (per-user RLS) | Yes | `0005_create_tracked_cities.down.sql` |
| 2026-09-27 | `0006_scope_search_keywords_to_owner.sql` | Scope keywords to their owner | `search_keywords.user_id` added, backfilled to first user, then `NOT NULL` + default `auth.uid()`; open policies replaced by owner policies | Flagged — `NOT NULL` set after backfill (safe with one user) and policy replacement hides other users' keywords from the browser | `0006_scope_search_keywords_to_owner.down.sql` (data loss) |
| 2026-09-28 | `0007_create_login_codes.sql` | Two-step login codes (MFA) | new table `login_codes` + index `login_codes_user_created_idx`; RLS on, no anon/authenticated policies or grants, `service_role` only | Yes — additive table, server-only access | `0007_create_login_codes.down.sql` (data loss: pending codes) |
| 2026-09-29 | `0008_add_estimated_cefr.sql` | Heuristisch geschätzte CEFR-Stufen speicherbar machen | `job_language_analysis.estimated_cefr` (nullable) + index `idx_jla_refnr_version` | Yes — additive nullable column and index only | `0008_add_estimated_cefr.down.sql` (drops estimated values only) |
| 2026-10-03 | `0009_create_job_visa_feasibility.sql` | Evidence-based visa / work-permit feasibility per job | new table `job_visa_feasibility` (`status`, `flags`, `evidence`, `version`, `analysed_at`) + index on `status`; authenticated SELECT only, writes via service role | Yes — new table only | `0009_create_job_visa_feasibility.down.sql` (data loss: stored classifications, re-creatable) |
| 2026-10-04 | `0010_add_pending_analysis_lookup.sql` | Fast pending-work lookup for the language and visa mass analyses (one SQL anti-join, active jobs first) | new index `idx_jobs_expired_published_refnr` on `jobs`; new functions `pending_analysis_refs(text, integer)`, `analysis_backlog(text)` (service_role only) | Yes — additive index and functions only; no table or column changes | `0010_add_pending_analysis_lookup.down.sql` (no data loss) |
| 2026-10-06 | `0011_add_job_tech_stack.sql` | Evidence-based tech stack, seniority and remote mode per job | new table `job_tech_stack` (`core_skills`, `bonus_skills`, `seniority`, `remote_mode`, `flags`, `evidence`, `version`, `analysed_at`) + GIN indexes on skill arrays, btree on `seniority`/`remote_mode`; authenticated SELECT (`auth.uid() IS NOT NULL`), writes via service role; `pending_analysis_refs`/`analysis_backlog` gain kind `tech` (existing kinds unchanged) | Yes — new table plus additive branch in existing functions; same signatures and results for `language`/`visa` | `0011_add_job_tech_stack.down.sql` (data loss: stored classifications, re-creatable) |
| 2026-10-07 | `0012_create_city_housing_benchmarks.sql` | User-entered, source-cited rent benchmarks per city for the Wohnen & Ankommen tab | new table `city_housing_benchmarks` (per-user RLS, source name + year required, CHECK ranges) | Yes — new table only | `0012_create_city_housing_benchmarks.down.sql` (data loss: entered benchmarks) |
| 2026-10-09 | `0013_housing_phase1_and_national_utilities.sql` | Phase-1 furnished warm price and utilities source per city; opt-in user-cited national Betriebskosten fallback | `city_housing_benchmarks` + nullable `furnished_warm_month`, `furnished_source_name`, `furnished_source_year`, `utilities_source_name`, `utilities_source_year` (+ `NOT VALID` source CHECK); new table `user_settlement_settings` (per-user RLS) | Yes — nullable columns, a CHECK that only applies to new furnished values, and a new table | `0013_housing_phase1_and_national_utilities.down.sql` (data loss: Phase-1 prices, settings) |

### 0006 — App-side dependency

Browser reads/writes of keywords go through the per-user rules and are correctly scoped. Server sync paths, however, still read **all users' keywords without an owner filter** (service role, pre-0006 pattern):

- `src/routes/api/public/cron/daily-sync.ts` — daily scheduled sync
- `src/lib/sync.functions.ts` — manual sync and city sync in keyword mode
- `src/lib/sync.server.ts` — keyword count

Impact today: none (single user). Tracked as **OPEN-001** in `roadmap.md`.

## Process for new migrations

1. **Summary + confirmation:** describe what changes, the compatibility verdict and data impact; get explicit approval before writing it.
2. **Rollback file:** add a matching `drizzle/rollbacks/NNNN_name.down.sql` with `IF EXISTS` guards and the "never run automatically" header (plus a backup warning if it loses data).
3. **Test in a draft first:** apply and verify the migration and the app in an isolated draft before accepting it into the live project.
4. **No destructive auto-apply:** drops, renames, type changes and data rewrites are never applied automatically; prefer additive forms (add column + backfill).
5. **Log it:** add a row to the table above.
