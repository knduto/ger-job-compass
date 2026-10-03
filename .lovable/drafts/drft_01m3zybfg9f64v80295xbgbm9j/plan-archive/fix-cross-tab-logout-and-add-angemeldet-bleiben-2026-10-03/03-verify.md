## Verification
- Mint a session with `lovable auth-session --json`. Open two tabs in the same browser context and navigate in both, including `/explore` and `/reports`. Then reload both and confirm each stays signed in.
- Untick the box, simulate a stale last-activity time, and confirm sign-out happens only in this browser.
- Check `build-errors.log` for a clean build.

## Technical notes
- The auto-generated Lovable Cloud client file stays untouched.
- Files: `src/routes/_authenticated/route.tsx`, `src/routes/__root.tsx`, `src/routes/auth.tsx`, the AppShell component, a new `src/lib/session-policy.ts` (flag, activity tracking, 12h check), and `AGENTS.md`.
- There are no database changes.
