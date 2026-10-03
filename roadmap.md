# Reporting upgrade

- [x] Add evidence-based language processing and daily snapshots
- [x] Build filterable reports with city, language, employer, lifecycle, and trend sections
- [x] Add PDF and Excel downloads from the current report filters
- [x] Add language coverage to data health
- [x] Fix Live-Abruf search-term layout
- [x] Verify build, downloads, and authenticated screens

# Permanent city-request crash repair

- [x] Replace unstable area and scope popup controls
- [x] Contain city-section render and request failures
- [x] Mark interrupted city runs incomplete
- [x] Verify repeated selections and both signed-in request scopes
# Engineering process setup (each stage built in a draft, merged only after user accepts)

- [x] Stage 1: rollback files for 0000–0006, MIGRATIONS.md, seed script (in draft)
- [x] Stage 2: README.md, SETUP.md + .env.example, STACK.md, REQUIREMENTS.md (in draft)
- [x] Stage 3: ARCHITECTURE.md, CHANGELOG.md
- [x] Stage 4: CONTRIBUTING.md, DEPLOYMENT-LOCAL.md (full local-host guide), AGENTS.md updates (in draft)

# Two-step login (MFA) and lockdown

- [x] Remove public registration and the public password-reset entry point from the login screen
- [x] Two-step login: password, then a 6-digit code sent by e-mail (10 minutes, rate limited, hashed at rest)
- [x] New `login_codes` table (0007) with rollback and migration log row
- [ ] Apply auth settings (signups off, anonymous off, no auto-confirm, leaked-password check on) — blocked: must be done from the main project, not this draft
- [ ] Set up the e-mail sender domain so login codes can actually be delivered — blocked: needs a domain you own
- [ ] Verify the code screen end-to-end (code delivered, wrong code, successful sign-in) — blocked: the codes table only exists after this draft is accepted

# Sprachanalyse in Masse

- [x] Massenanalyse aller Stellen (Blöcke von 25, nie doppelt) mit Fortschritt, Pause und Stopp
- [x] Geschätzte CEFR-Stufen (nur aus expliziten Formulierungen) plus Filter und Export
- [x] Entfernte Stellen (Arbeitsagentur 404) werden als "nicht mehr verfügbar" dauerhaft verbucht statt als Fehler zu blockieren
- [x] Gespeicherte Beschreibungen werden wiederverwendet statt erneut abgerufen
- [x] Sprachfilter und Sprach-Badges auf der Seite "Jobs erkunden"

# Explore pagination (in draft)

- [x] Keep results visible while the next page loads
- [x] Pager above and below the list: first/last, numbered pages, jump-to-page, 25/50/100 per page, scroll to top

# Open items

- [ ] OPEN-001 (from 0006): server sync paths read all users' keywords with no owner filter — daily sync (api/public/cron/daily-sync.ts), manual sync and city keyword mode (sync.functions.ts), keyword count (sync.server.ts). No impact with one user; fix needs confirmation before code change.
- [ ] Provide the complete raw `AGENTS.md` read from the corrected draft before acceptance.
