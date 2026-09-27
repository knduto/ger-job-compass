# Permanent fix for the city request crash

## Confirmed diagnosis

- Changing **Umkreis** or **Umfang** does not contact the Arbeitsagentur API or write to the database; each selection only updates local page state.
- Both crashing controls use the same popup-select implementation. The city request itself starts only after **Stadt abrufen** is pressed.
- Current logs show a healthy build and no server-side city-request exception, so the selection-time failure is isolated to the browser control/render path rather than fetched job data.

## Changes

1. Replace the two popup selectors in **Stadt-Abruf** with stable, directly clickable controls:
   - radius: Stadt only, 10, 25, 50, and 100 km;
   - scope: all IT jobs or saved search terms.
   This removes the shared control path that can currently take down the page.

2. Isolate city-request failures from the rest of **Live-Abruf**:
   - keep selection and request errors inside the city section;
   - show a clear German error message with a retry action;
   - prevent a failed selection or request from reaching the whole-page error screen.

3. Harden the city run lifecycle:
   - validate city, radius, and scope before starting;
   - always record a failed/interrupted run as incomplete instead of leaving it apparently active;
   - preserve the existing short step-by-step requests and the rule that city runs never expire global jobs.

4. Add regression coverage and verify the real signed-in flow:
   - switch every radius and both scopes repeatedly;
   - run one city request in each scope;
   - confirm progress, completion totals, saved jobs, and the recent-run row;
   - check desktop and the current narrow viewport, with no whole-page crash or console error.

## Technical notes

- Keep the Arbeitsagentur endpoints, IT Berufsfelder, deduplication, and stored-data rules unchanged.
- Add only a local safety boundary around the city-request section; the rest of the page remains available if that section fails.
- If runtime reproduction reveals a deeper framework exception, fix that exact call path and retain the regression test rather than masking it with a generic catch.
