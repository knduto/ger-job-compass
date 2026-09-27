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

# Open items

- [ ] OPEN-001 (from 0006): server sync paths read all users' keywords with no owner filter — daily sync (api/public/cron/daily-sync.ts), manual sync and city keyword mode (sync.functions.ts), keyword count (sync.server.ts). No impact with one user; fix needs confirmation before code change.
