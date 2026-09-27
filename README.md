# Smart-DE-Reise — Mein Weg bei der Jobsuche

A private, single-user web app for an IT job search in Germany (Chancenkarte move). The interface is in **German**; this documentation is in English.

## What it does

- **Job discovery (Explore):** search stored IT postings by title, employer, city, Berufsfeld, contract, work time, publication age, home office, salary and expiry.
- **Application tracking (Pipeline):** track applications per posting. No resume or file uploads.
- **Employers:** employer profiles and direct-vs-agency hiring.
- **Reports:** city ranking with an explained, adjustable score; German-language requirements; market, employer, lifecycle and trend sections; PDF and Excel downloads. Reports focus on the cities you track, or the top 30 cities by data when none are tracked.
- **Data health:** sync history, coverage and language-analysis coverage.
- **Live-Abruf (sync):** manual keyword sync, on-demand city sync (all IT jobs or saved keywords, with radius), and a daily scheduled sync.

## Data source and accuracy rules

- Job data comes **only** from the Bundesagentur für Arbeit (Arbeitsagentur) Jobsuche API: search `pc/v6/jobs`, details `pc/v4/jobdetails/{base64(refnr)}`. No invented or sample data.
- Only the four IT Berufsfelder in `src/lib/it-fields.ts` are queried, and only postings with a German location are stored.
- Jobs are upserted by `refnr` and never deleted; they are marked expired only after a complete, error-free run where they were unseen for 3 days.
- Reports and exports read the **stored database**, not the live API.
- **Language analysis is evidence-based:** a CEFR level (A1–C2) is assigned only when the description states it. Vague wording ("gute Deutschkenntnisse") is classed "German required, level unclear". Coverage is shown, since only postings with fetched descriptions are analysed.

## Quick start

See [SETUP.md](SETUP.md). In short:

```sh
git clone <your-repository-url>
cd <repository-folder>
cp .env.example .env   # then fill in values
bun install            # or: npm install
bun run dev            # or: npm run dev
```

## Documentation

- [SETUP.md](SETUP.md) — local setup against the hosted backend
- [REQUIREMENTS.md](REQUIREMENTS.md) — software, hosted-service and scheduling requirements
- [STACK.md](STACK.md) — technologies in use
- [MIGRATIONS.md](MIGRATIONS.md) — database migration log and rollback policy
- [AGENTS.md](AGENTS.md) — architecture rules
- [roadmap.md](roadmap.md) — tasks and open items

## Current constraints

- Single private user; keyword sync paths do not yet filter keywords by owner (OPEN-001 in `roadmap.md`).
- Preview and published app share **one** hosted database; schema changes should be tested in an isolated draft first.
- Language metrics are only as representative as their description coverage.
- The daily sync needs a stable, always-reachable URL (the published app).
- Password-reset emails use the default sender.
