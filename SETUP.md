# Setup (local, using the hosted Lovable Cloud backend)

The app runs locally while the database, authentication and stored jobs stay on the hosted Lovable Cloud backend. Local runs read and write the **same live data** as the published app.

## 1. Get the code

Connect the project to GitHub in Lovable, then:

```sh
git clone <your-repository-url>
cd <repository-folder>
```

## 2. Install

Requires Node.js 22+ (see REQUIREMENTS.md). The repository has a `bun.lock`, so Bun is preferred; npm also works.

```sh
bun install      # or: npm install
```

## 3. Environment

```sh
cp .env.example .env
```

Fill in the `VITE_SUPABASE_*` and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PROJECT_ID` values. These are publishable values; the project owner supplies them (they are in the Lovable-managed `.env` of a GitHub-synced repo).

- `SUPABASE_SERVICE_ROLE_KEY` is **not available** on Lovable Cloud. Without it, local server-side sync (manual, city, daily) and other admin writes will fail; browsing, reports, pipeline and exports work. Run syncs from the hosted app.
- `LOVABLE_CRON_SECRET` is only needed if you call the daily-sync endpoint locally.

## 4. Run

| Command | Purpose |
|---|---|
| `bun run dev` | Development server (Vite, http://localhost:8080 by default in Lovable; the port Vite prints locally) |
| `bun run build` | Production build |
| `bun run build:dev` | Build in development mode |
| `bun run preview` | Serve the built app |
| `bun run lint` | ESLint |
| `bun run format` | Prettier (rewrites files) |

With npm use `npm run <script>`. There is no test script.

## 5. Sign in

Open the app and sign in at `/auth` with the owner account. "Passwort vergessen" sends a reset link to `/reset-password`. Signup is currently enabled in the UI; the owner should disable new sign-ups in backend auth settings once their account exists.

## 6. Keywords

Search keywords are per user. To add the baseline 28 keywords to an account, see `scripts/seed/README.md`.

## 7. Database changes

Do not change the schema from a local run. Follow MIGRATIONS.md and test in an isolated draft first — preview and published app share one database.

## Daily sync

The daily sync is a `POST` to `/api/public/cron/daily-sync`, triggered by a database schedule (`pg_cron` + `pg_net`) at 05:00 UTC with a bearer token stored in vault as `daily_sync_token` (matching `LOVABLE_CRON_SECRET`). A local machine is not a reliable target; point the schedule at the published app.
