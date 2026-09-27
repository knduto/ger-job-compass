# Correct Stage 4 `AGENTS.md`

## Draft-only correction

- Keep the main project unchanged.
- Update the isolated Stage 4 draft so `AGENTS.md` ends with these exact three rules:

```text
- Every new database migration must include a matching rollback file in `drizzle/rollbacks/`, update `MIGRATIONS.md`, classify the migration as backward-compatible or breaking using the documented criteria, and flag ambiguous cases for review.
- Every planned stage of work must be built in an isolated draft first, reviewed and explicitly accepted by John, and only then merged into the main project; never write staged work directly to main before that review.
- Never commit `.env` or any file containing secrets; commit only `.env.example` with safe placeholder values, and keep `.env` plus environment-specific variants ignored by Git.
```

## Verification before acceptance

- Read the complete draft `AGENTS.md` after the correction.
- Confirm the three lines appear verbatim at the end and that all existing architecture rules remain unchanged.
- Present the corrected file contents for review before merging the draft into main.
