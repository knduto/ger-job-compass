# Fix cross-tab logout and add "Angemeldet bleiben"

Built in this isolated draft only; nothing merges until John reviews and accepts.

## What changes for you
- Opening a new tab no longer logs out your other tabs.
- The login form gets an **Angemeldet bleiben** checkbox, ticked by default, with German helper text:
  - Ticked: "Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest."
  - Unticked: "Du wirst nach 12 Stunden Inaktivität automatisch abgemeldet."
- **Abmelden** signs out only this browser and goes cleanly to the login page.

## Steps
1. **Login gate:** read the saved session on the device first. With no session, go to `/auth`. With a session, optionally check it with the server. Network or 5xx errors still count as signed in, so a brief failure never removes the session.
2. **Root listener:** on `SIGNED_OUT`, wait about 400 ms and read the session again. If a session still exists, ignore the event. Otherwise clear the cache and redirect to `/auth`.
3. **Remember me:** an unticked box saves a session-only flag and a last-activity time on the device. Activity in any tab (clicks, key presses, page changes, throttled) updates that time. On app start and every minute, the app checks for 12 hours of inactivity. Once that passes, it signs out this browser only (`scope: 'local'`). A ticked box clears the flag, so the session lasts and refreshes automatically.
4. **Abmelden in AppShell:** `cancelQueries`, then `clear`, then `signOut({ scope: 'local' })`, then `navigate({ to: '/auth', replace: true })`.
5. **AGENTS.md:** add one rule: "Auth gate reads the local session and never signs out on transient validation errors — prevents cross-tab logout cascades."
