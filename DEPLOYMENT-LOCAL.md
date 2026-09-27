# Local deployment

Two ways to run Smart-DE-Reise on your own machine or home server.

| | Option A — hosted backend | Option B — fully self-hosted |
|---|---|---|
| App runs | Locally | Locally |
| Database / auth | Hosted Lovable Cloud (same live data as the published app) | Your own Postgres / self-hosted Supabase |
| Sync (manual, city, daily) | Run from the hosted app (no service key locally) | Works locally with your own service key |
| Effort | Low | High |

> The daily sync needs a **stable, always-reachable URL** (the published app) or a **local scheduling alternative** (Option B). A laptop that sleeps or changes address is not a reliable cron target.

## Prerequisites

- Git
- Node.js 22+ (see `REQUIREMENTS.md`; `@types/node` is `^22`)
- Bun (preferred — the repo has `bun.lock`) or npm
- Option B only: Docker (for self-hosted Supabase) or PostgreSQL with `pg_cron`, `pg_net` and vault support

---

## Option A — hosted backend, local app

### 1. Clone

Connect the project to GitHub in Lovable, then:

```sh
git clone <your-repository-url>
cd <repository-folder>
```

### 2. Install

```sh
bun install      # or: npm install
```

### 3. Environment

```sh
cp .env.example .env
```

Fill in the `VITE_SUPABASE_*` and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PROJECT_ID` values from the project owner. `.env` is gitignored — **never commit it**.

- `SUPABASE_SERVICE_ROLE_KEY` is not available on Lovable Cloud, so server-side syncs fail locally. Browsing, reports, exports and the pipeline work.
- `LOVABLE_CRON_SECRET` is only needed to call the daily-sync endpoint yourself.

### 4. Run

```sh
bun run dev          # development server; open the URL Vite prints
bun run build        # production build
bun run preview      # serve the production build
```

With npm use `npm run <script>`. Sign in at `/auth`.

---

## Option B — fully self-hosted / offline

Everything, including the database, runs on your hardware. The Arbeitsagentur API still needs internet access for syncing; browsing stored data works offline.

### 1. Start a backend

Run self-hosted Supabase (Docker, per Supabase's self-hosting docs). It provides Postgres, auth, the Data API, vault, `pg_cron` and `pg_net`, which the schema relies on. A bare Postgres lacks auth and the Data API the app uses, so it is not sufficient on its own.

### 2. Apply the schema

Apply `drizzle/migrations/` **in order**, 0000 → 0006, e.g. with `psql`:

```sh
for f in drizzle/migrations/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Rollbacks in `drizzle/rollbacks/` are never run automatically. Then add keywords for your account per `scripts/seed/README.md` (after you have signed up once).

### 3. Environment

Copy `.env.example` to `.env` and point every `*_SUPABASE_*` value at your own backend, including `SUPABASE_SERVICE_ROLE_KEY` (you control it here). Set `LOVABLE_CRON_SECRET` to a random value.

### 4. Store the cron token

Store the same secret in vault via the service-role-only function from migration 0003:

```sql
select public.set_daily_sync_token('<same value as LOVABLE_CRON_SECRET>');
```

### 5. Build and run

```sh
bun install
bun run build
bun run preview
```

### 6. Schedule the daily sync

The schedule is not in the migrations; you must create it. Either:

- **In the database** (`pg_cron` + `pg_net`): schedule a daily `POST` to `http://<app-host>:<port>/api/public/cron/daily-sync` with header `Authorization: Bearer <token>`, or
- **On the host** (cron / systemd timer):

```sh
# crontab -e — 05:00 UTC daily
0 5 * * * curl -fsS -X POST -H "Authorization: Bearer $LOVABLE_CRON_SECRET" http://localhost:<port>/api/public/cron/daily-sync
```

The machine must be on at that time; missed runs are not caught up. Jobs are only marked expired after a complete, error-free run.

---

## LAN access

To reach the app from other devices on your network, bind to all interfaces:

```sh
bun run dev -- --host 0.0.0.0
bun run preview -- --host 0.0.0.0
```

Open `http://<machine-ip>:<port>`. Keep it on a trusted network; do not port-forward it to the internet without HTTPS and a reverse proxy. For password-reset links to work, the backend's allowed redirect URLs must include that address.

## Service management

### systemd

```ini
# /etc/systemd/system/smart-de-reise.service
[Unit]
Description=Smart-DE-Reise
After=network.target

[Service]
WorkingDirectory=/opt/smart-de-reise
EnvironmentFile=/opt/smart-de-reise/.env
ExecStart=/usr/bin/env bun run preview -- --host 0.0.0.0
Restart=on-failure
User=smartde

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now smart-de-reise
journalctl -u smart-de-reise -f
```

### pm2

```sh
pm2 start "bun run preview -- --host 0.0.0.0" --name smart-de-reise
pm2 save && pm2 startup
```

## Backups

- **Option A:** data lives on Lovable Cloud; local runs hold nothing to back up except your `.env` (keep it outside git).
- **Option B:** back up the database regularly and before every migration or rollback:

```sh
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
pg_restore -d "$DATABASE_URL" --clean backup-YYYY-MM-DD.dump
```

`jobs` history is never deleted by the app, so the database grows; plan disk space accordingly.

## Updating

```sh
git pull
bun install
bun run build
sudo systemctl restart smart-de-reise   # or: pm2 restart smart-de-reise
```

Option B: before restarting, check `MIGRATIONS.md` for new migrations, back up, then apply only the new files in order.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Blank page or "Invalid API key" | `VITE_SUPABASE_*` missing or wrong in `.env`; restart after editing |
| Sync fails locally (Option A) | Expected — no service key; run syncs from the hosted app |
| Daily sync returns 401 | Bearer token ≠ `LOVABLE_CRON_SECRET`, or vault token not set |
| Daily sync never runs | No schedule created, machine asleep, or URL unreachable |
| Permission denied on a table | Missing `GRANT` in a migration (see `CONTRIBUTING.md`) |
| Arbeitsagentur 403 | Wrong endpoint version — search `pc/v6/jobs`, details `pc/v4/jobdetails` (see `AGENTS.md`) |
| Reset-password link fails | Redirect URL not allowed in backend auth settings |
| Port already in use | Pass `--port <n>` to `dev` / `preview` |

## Verification checklist

- [ ] `bun run build` completes without errors
- [ ] App opens and `/auth` sign-in works
- [ ] Dashboard, Explore and Employers show stored jobs
- [ ] Reports load; PDF and Excel downloads open
- [ ] Pipeline: add and move an application
- [ ] Data health page loads
- [ ] Option B: manual sync on `Live-Abruf` completes and appears in run history
- [ ] Option B: daily-sync endpoint returns success with the token and 401 without it
- [ ] `.env` is not listed by `git status`
