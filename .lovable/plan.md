# Smart-DE-Reise reporting upgrade

## Goal
Turn the existing city report into a practical settlement and job-market decision tool, using only real Arbeitsagentur data. Add transparent German-language analysis, richer market insights, useful filters, and downloadable PDF and Excel reports. Also correct the Live-Abruf layout so the search-term panel is positioned comfortably without unnecessary browser scrolling.

## What will be built

### 1. Reliable language-requirement data
- Fetch and retain job descriptions needed for language analysis, beginning with active jobs and continuing incrementally during later daily runs.
- Classify only explicit evidence found in the listing text:
  - CEFR levels A1–C2 when stated.
  - German required, level unclear.
  - German optional/preferred.
  - English-accessible when the wording clearly supports it.
  - No clear language information.
- Keep the matched wording and classification method so every result can be audited.
- Never infer a CEFR level from vague wording such as “good German”; it remains in the separate “level unclear” category.
- Show coverage clearly: descriptions analysed, descriptions unavailable, and jobs still awaiting analysis. Percentages will use the correct analysed-data denominator rather than pretending incomplete coverage is complete.

### 2. Filterable decision reports
Add a compact filter area similar to Jobs erkunden, covering the criteria that affect the report:
- City and region.
- IT Berufsfeld and search term/role.
- Active or expired status.
- Publication period.
- Contract, full-time/part-time, and home office.
- Salary disclosed.
- German requirement and CEFR level.

Filters will update all report sections and the PDF so the screen and downloaded report use the same population.

### 3. Report sections inspired by the earlier app
- **Decision summary:** strongest cities for the selected filters, key strengths, trade-offs, and data caveats.
- **Language and accessibility:** German-level distribution, explicit versus unclear requirements, English-accessible share, and city-by-city comparison.
- **City ranking:** active jobs, recent demand, employer diversity, home office, permanent roles, salary transparency, and language accessibility. Keep adjustable score weights and add language accessibility as an optional factor.
- **Market pulse:** freshest market, salary disclosure, widest salary range, strongest hiring city, and largest employer concentration.
- **Employers:** largest employers, concentration by city, and a clearly labelled agency/direct classification based only on auditable name/text evidence; uncertain employers remain “unclassified.”
- **Job lifecycle:** tracked jobs, expired jobs, expiry rate, and average observed listing duration by city.
- **Trends:** daily snapshots for active jobs, new postings, expiries, language mix, and selected city indicators. Explain when history is too short for a meaningful trend.
- **Methodology and data health:** Arbeitsagentur source, refresh time, applied filters, sample size, description coverage, and limitations.

### 4. PDF and Excel downloads
- Add “Download PDF” and “Download Excel” actions to Reports.
- Generate a polished German-language PDF containing the current filters, headline findings, charts/tables, timestamp, data period, sample sizes, source, and methodology.
- Generate an Excel workbook with separate sheets for overview, cities, language, employers, lifecycle, trends, and filtered source data.
- Use the same filtered population and centralized calculations for both downloads.
- Use sensible page breaks and concise Top-N tables so the PDF remains readable.
- Disable downloads with a clear reason when no rows match the filters.

### 5. Data history and safe processing
- Add additive reporting tables for language analysis and daily aggregate snapshots, with signed-in read access and server-only writes.
- Analyse descriptions in controlled batches so the Arbeitsagentur service is not overloaded and progress can resume safely.
- Include language-analysis coverage and pending counts in Datenqualität.
- Preserve the existing single shared sync path so manual and scheduled runs continue to produce consistent metrics.

### 6. Live-Abruf layout fix
- Move the search-term panel below the run controls/history on narrower desktop widths and keep it neatly positioned on wide screens.
- Give the term list its own bounded scrolling area rather than making the entire browser page unnecessarily tall.
- Keep the active count, add field, switches, and delete controls visible and usable at the current preview size.

## Technical details
- Use authenticated server functions for description processing, report queries, and PDF and Excel data preparation.
- Add schema changes through one additive database migration with explicit grants and row-level policies.
- Store evidence-based classification fields and extraction version so future rule improvements can be re-run safely.
- Create daily city/market snapshot rows only after a completed sync; do not fabricate historical points from current totals.
- Use the existing semantic design tokens, German app copy, and current chart library; the uploaded screens are visual/product references only.
- Keep report calculations centralized so on-screen metrics and PDF values cannot diverge.

## Verification
- Test language rules against explicit CEFR phrases, vague German wording, English-only wording, negations, and missing descriptions.
- Confirm every percentage exposes its denominator and incomplete coverage is visible.
- Compare sampled classifications with the original listing text.
- Verify report filters update all sections and both downloads use the identical filter set.
- Inspect every generated PDF page for clipped text, broken tables, missing charts, and incorrect page order.
- Recalculate and inspect the Excel workbook for formula errors, sheet structure, formatting, and complete filtered data.
- Check the Live-Abruf page at the current viewport and on mobile, ensuring the search-term controls do not force awkward page scrolling.
- Run the authenticated report, download, language-processing, and Live-Abruf flows end to end.

## Delivery note
The language report will initially show limited coverage because the database currently contains 11,316 active jobs but only one stored description. Coverage will grow through the controlled backfill and each daily run; the interface will show that progress instead of presenting incomplete results as final.
