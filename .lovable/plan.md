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

## 3. Enforcement
- Add these rules to `AGENTS.md` so every future session follows them: out-of-date docs count as bugs, and each change updates CHANGELOG and any affected docs.
- Limitation: Lovable writes its own commits here, so I cannot control their message format. Conventional Commits apply fully to commits you push from a local copy. An optional check that validates commit messages can be added for that local workflow.

## Technical details
- Rollback files are documentation-first and are never run automatically.
- `.env.example` lists only variable names (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID) with no values.
- This work makes no schema changes, so it needs no database confirmation.
