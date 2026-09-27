# Engineering process setup for Smart-DE-Reise

## What changes for you
From now on every database change, document and commit follows a fixed, written process. Before any database change I will first tell you which migration file I will create, what it does, whether it can be undone or breaks anything, and which documents need updating. I will wait for your confirmation unless you say to batch changes.

## 1. Database migrations
- Keep the existing numbered migrations in `drizzle/migrations/` (0000–0006). This is where the project's migration tool writes and applies files; a second `supabase/migrations/` folder would cause two conflicting histories. The folder location is the only difference from your document.
- Add `drizzle/rollbacks/NNNN_<name>.down.sql` for each existing migration. Each file either reverses the change with `IF EXISTS` guards or includes a clear note on why reversing it is not safe (for example, when it would lose job history).
- New migrations: use `IF NOT EXISTS`/`IF EXISTS` guards, include a rollback file, get a summary and your confirmation before being applied, and never drop, truncate or narrow data without explicit approval.
- `MIGRATIONS.md`: list migrations in order with date, filename, purpose, tables/columns affected, backward-compatibility and rollback file.
- Seed data: `scripts/seed/` kept separate from migrations and holding only the setup data (for example your 28 search keywords, loaded per user). No invented job data, in line with the accuracy rule.

## 2. Documentation (project root)
- `README.md`: rewrite with overview, purpose, features, links to the preview and published app, and a quick start.
- `SETUP.md`: Node/bun requirements, `.env.example`, connecting to the hosted backend, running and rolling back migrations, seeding, running the app, the daily sync schedule.
- `ARCHITECTURE.md`: Mermaid diagram (browser, server functions, backend database, Arbeitsagentur API, daily scheduled job), frontend/backend boundaries, sync data flow, key decisions (taken from `AGENTS.md`), folder structure.
- `STACK.md`: TanStack Start/React/Vite/Tailwind, Lovable Cloud database and auth, hosting, Arbeitsagentur API, PDF/Excel export libraries, and why each was chosen.
- `REQUIREMENTS.md`: functional and non-functional requirements (accuracy, IT fields only, Germany only), a single private user role, out of scope (resume uploads, invented data), and open questions.
- `CHANGELOG.md`: Keep a Changelog format, with past work rebuilt into version entries.
- `CONTRIBUTING.md`: Conventional Commits rules (feat, fix, chore, docs, refactor, test, migration), one logical change per commit, `migration(scope):` commits that reference MIGRATIONS.md, and the pre-change confirmation process.
- `DEPLOYMENT-LOCAL.md`: full guide to running the app on your own computer.
  - Option A (simplest): run the app locally but keep using the hosted Lovable Cloud database. Covers getting the code through GitHub, installing Node/bun, `.env` setup, dev mode, a production build, keeping it running (pm2 or a system service), and optional access from other devices on your network.
  - Option B (fully offline): self-host the database with Docker, apply every migration in order, seed your keywords, set up sign-in, and change the app's connection settings.
  - Daily sync on a local machine: a scheduled task that calls the sync address with the secret token. Also covers backups (database dump and restore), updating to new versions, troubleshooting, and a verification checklist.

## 3. Enforcement
- Add these rules to `AGENTS.md` so every future session follows them: out-of-date docs count as bugs, and each change updates CHANGELOG and any affected docs.
- Limitation: Lovable writes its own commits here, so I cannot control their message format. Conventional Commits apply fully to commits you push from a local copy. An optional check that validates commit messages can be added for that local workflow.

## 4. Your clarifications

### 4.1 Rollback files for all existing migrations
Yes, this covers every existing migration from 0000 to 0006. I will create exactly these 7 files in `drizzle/rollbacks/`:
1. `0000_init_smart_de_reise.down.sql`
2. `0001_city_stats_concentration.down.sql`
3. `0002_city_stats_by_publication.down.sql`
4. `0003_cron_token_setter.down.sql`
5. `0004_add_language_analysis_and_market_snapshots.down.sql`
6. `0005_create_tracked_cities.down.sql`
7. `0006_scope_search_keywords_to_owner.down.sql`

Views changed by 0001 and 0002 roll back to the previous view definition, not to "drop". 0000 and 0006 would delete your jobs or keyword ownership, so each has a "do not run without a backup" header.

### 4.2 Staging and preview safety
- Today there is no separate staging database. The preview and the published app share one hosted database, so every applied migration changes live data right away.
- Proposed safe route for future schema changes: build them in a Lovable draft. A draft runs on its own isolated backend, and its schema changes apply to the real database only when you accept the draft. I will test the migration and the app there, show you the results, and then you accept.
- Fallback for small changes: first apply the SQL inside a throwaway schema (for example `staging_test`), check it, then drop that schema.
- Stages 1–4 are documentation only. No migration is applied, so none of this is needed yet.

### 4.3 Staged rollout
Confirmed. After each stage I stop and wait for your review:
- Stage 1: the 7 rollback files, `MIGRATIONS.md`, and the seed script
- Stage 2: `README.md`, `SETUP.md` (plus `.env.example`), `STACK.md`, `REQUIREMENTS.md`
- Stage 3: `ARCHITECTURE.md`, `CHANGELOG.md`
- Stage 4: `CONTRIBUTING.md`, `DEPLOYMENT-LOCAL.md`, `AGENTS.md` updates

Lovable saves each stage as its own version, and I can't set the commit message text myself (see section 3).

### 4.4 What "backward-compatible" means
- Backward-compatible (Yes): new tables, views, functions, indexes or policies; new nullable columns or columns with a default; widening a type; adding a policy that doesn't hide rows the running app already reads.
- Breaking (No): dropped or renamed tables or columns; narrowing or changing a type; new NOT NULL without a default; new constraints that existing rows or app writes may fail; replacing a policy or view so the app loses rows or columns it uses.
- Ambiguous (Flagged): the entry is marked "Flagged" with the reason written out. Expected flags: 0006 (it limited keyword access to their owner, which changed what the app could see) and 0001/0002 (view definitions were replaced, so any change to their columns has to be checked).
- 0000 is the initial schema, so it is marked "N/A (baseline)".

## Technical details
- Rollback files are documentation-first and are never run automatically.
- `.env.example` lists only variable names (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID) with no values.
- This work makes no schema changes, so it needs no database confirmation.

### 4.5 0006 app-side dependency (checked in code)
- Browser reads and writes of keywords (Live-Abruf list, toggle, delete, reports) go through the per-user access rules, so they are correctly scoped.
- Server sync paths still read every user's keywords with no owner filter: manual sync, city sync in keyword mode, the daily scheduled sync, and the keyword count. That is the pre-0006 pattern.
- Impact today: none, because there is a single user. It will be recorded explicitly in the MIGRATIONS.md entry for 0006 and listed as an open item, with no code change in Stage 1.

### 4.6 Review before each stage lands
- Lovable saves each file change as a version immediately. There is no pre-commit review step.
- Workaround (you choose): either (a) I post a stage's full content in chat and write it only after your "go", or (b) I build the stage in an isolated draft copy that reaches the main project only when you accept it.
- Stage 1 starts once you approve this plan and pick (a) or (b).
