# Contributing

Conventions for changing Smart-DE-Reise. Read `AGENTS.md` (architecture rules) and `MIGRATIONS.md` (schema rules) first.

## Branches and commits

- The connected branch syncs to Lovable; keep it in a working state and never rewrite pushed history (no force push, no rebase/amend/squash of pushed commits).
- Work on a short-lived branch, or in an isolated Lovable draft for anything that should be reviewed before landing.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

| Type | Use for |
|---|---|
| `feat` | New user-visible capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no behaviour change |
| `chore` | Tooling, dependencies, config |
| `db` | Migration + matching rollback + `MIGRATIONS.md` entry (one commit) |

Examples: `fix(sync): mark interrupted city runs incomplete`, `db: 0007 add saved_searches table`.

## Run locally

See `SETUP.md` (hosted backend) or `DEPLOYMENT-LOCAL.md` (full guide).

```sh
bun install          # or: npm install
cp .env.example .env # fill in values; never commit .env
bun run dev
```

## Testing changes

There is no automated test script. Before a change is considered done:

1. **Build:** `bun run build` (and `bun run lint`) must pass with no errors.
2. **Manual check in preview:** sign in and exercise the affected screen end to end with real data — e.g. run a city sync on `Live-Abruf`, open a report and download the PDF/Excel, move an application in `Pipeline`.
3. **Data accuracy:** any displayed figure must trace back to stored Arbeitsagentur data; never add sample or invented content.

## Migration workflow

Follow `MIGRATIONS.md` → "Process for new migrations". In short, every new migration must:

1. Live in `drizzle/migrations/NNNN_name.sql` (next sequential number).
2. Ship with a matching `drizzle/rollbacks/NNNN_name.down.sql` — `IF EXISTS` guards, the "never run automatically" header, and a backup warning when it loses data.
3. Get a row in the `MIGRATIONS.md` log with a backward-compatible verdict using the **Compatibility criteria** defined there (Yes / No / Flagged with reason). Breaking changes must be marked **No** and explained.
4. Be tested in an isolated draft before it reaches the shared database — preview and published app use one database.
5. Prefer additive forms (add column + backfill) over drops, renames or type changes.

## New public tables

Every `CREATE TABLE` in the `public` schema must, **in the same migration**, include in this order:

1. `CREATE TABLE public.<name> (...)`
2. `GRANT` statements for the roles the policies allow (at least `authenticated` and `service_role`; `anon` only if a policy permits anonymous reads)
3. `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY`
4. `CREATE POLICY ...` — user data scoped to `auth.uid()`; job/sync data written only by the service role

RLS without `GRANT` fails at runtime; `GRANT` without RLS exposes data.

## Environment files

`.env` and `.env.*` are gitignored (except `.env.example`). Add new variables to `.env.example` with placeholder values only.

## Documentation changes

Larger documentation work is done in stages, each in its own isolated draft, reviewed and accepted before the next stage starts. Record the stage in `roadmap.md` and notable milestones in `CHANGELOG.md`.
