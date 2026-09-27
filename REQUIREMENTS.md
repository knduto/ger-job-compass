# Requirements

## 1. Software / runtime (local)
- **Node.js 22 or newer** (verified with 22.22; `@types/node` 22).
- **Bun 1.3+** (preferred; `bun.lock` is committed) **or npm**.
- **Git**, for cloning a GitHub-synced copy.
- A modern browser (Chromium, Firefox or Safari).
- Outbound HTTPS to the hosted backend and to `rest.arbeitsagentur.de`.

## 2. Hosted services (required)
- **Lovable Cloud backend** — database, auth, RLS, views, vault. Local runs use it; no self-hosted database is set up.
- **Arbeitsagentur Jobsuche API** — public, uses the header `X-API-KEY: jobboerse-jobsuche`; no registration. Unofficial/undocumented, so availability and format can change.
- **Owner account** — an email/password account in the backend. Keywords, tracked cities and applications are per user.
- **Values the owner supplies:** backend URL, publishable key, project ID (see `.env.example`).

## 3. Optional: production scheduling
- **Published app** at a stable URL, reachable by the scheduler.
- **`pg_cron` + `pg_net`** schedule (05:00 UTC) calling `POST /api/public/cron/daily-sync`.
- **`LOVABLE_CRON_SECRET`** configured in the app, and the same value stored in vault as `daily_sync_token` via `set_daily_sync_token` (service role only).
- The schedule must target the published app, not the preview, before relying on production sync.
