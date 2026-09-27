# Plan: Make city scoring understandable + document analysis architecture

## Goal
The city ranking score is currently opaque — sliders with no explanation. Make the scoring transparent and self-explanatory, and confirm in the UI that all analysis runs on stored database data, not live API calls.

## Changes

### 1. Explain the scoring on the reports page
- Add a "Wie wird der Score berechnet?" (How is the score calculated?) info panel directly under the Städteranking heading, in German, collapsible:
  - Each city earns 0–100 points from six factors.
  - Each factor is scaled against the best city (best city = full points).
  - The slider weight (0–10) decides how strongly a factor counts; a slider at 0 removes the factor.
  - Final score = weighted sum, scaled to 100.
- Add a short tooltip/hint on each slider label explaining what the factor measures (e.g. "Arbeitgebervielfalt: how many different employers advertise in the city — less dependence on a single employer").
- Show the per-factor breakdown when clicking a city row (already have city drill-down; add score contribution per factor so the user sees why a city ranks where it does).

### 2. Label the language factor honestly
- The "Englisch zugänglich" factor is only computed within analysed jobs; while language coverage is low, mark the factor with a coverage note next to the slider (e.g. "based on X% analysed") so a low-coverage score isn't misleading.

### 3. Confirm analysis runs on stored data (no behavior change needed)
Verified in code — no changes required, only documentation:
- Job descriptions are fetched once from the Arbeitsagentur API during sync/backfill and stored in `job_details`.
- Language classification (`classifyLanguage`) runs server-side over those stored texts and writes to `job_language_analysis`.
- Reports, scoring, PDF/Excel exports read only database tables (`jobs`, `job_language_analysis`, `market_snapshots`) — the API is never called when viewing or downloading reports.
- Add one line to the report's methodology section stating this: "Alle Analysen basieren auf gespeicherten Datenbankinhalten; beim Anzeigen der Berichte werden keine Live-API-Aufrufe durchgeführt."

## Technical notes
- Edit `src/routes/_authenticated/reports.tsx` (info panel, tooltips, per-factor breakdown) and possibly `src/lib/report-metrics.ts` to expose per-factor contributions.
- No database or sync changes; no new dependencies.
- Verify with build + authenticated preview check of the reports page.
