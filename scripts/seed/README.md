# Seed scripts

Seeds are **separate from migrations**: they insert starter configuration, never schema, and are never run automatically.

- `seed_keywords.sql` — inserts the 28 IT role keywords (same list as the original baseline) for one user id. Idempotent via `ON CONFLICT (term) DO NOTHING`.

```bash
psql -v user_id='<auth-user-uuid>' -f scripts/seed/seed_keywords.sql
```

No job, employer or sync data is seeded — all job data must come from real Arbeitsagentur syncs.
