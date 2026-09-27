-- Seed: the user's 28 IT role search keywords.
-- NOT a migration. Never run automatically. Contains no job data.
-- Idempotent: existing terms are left untouched (term is globally unique).
--
-- Usage (psql):  psql -v user_id='<auth-user-uuid>' -f scripts/seed/seed_keywords.sql

INSERT INTO public.search_keywords (term, user_id)
SELECT t.term, :'user_id'::uuid
FROM (VALUES
  ('IT Operations Manager'),('IT Service Manager'),('IT Service Delivery Manager'),('Technical Operations Manager'),
  ('IT Project Manager'),('IT Projektmanager'),('IT Manager'),('IT-Leiter'),('IT Leitung'),('Technical Lead'),
  ('IT Team Lead'),('Systems Manager'),('System Administrator'),('System Engineer'),('IT Consultant'),('IT-Berater'),
  ('Application Manager'),('Application Management'),('Business Systems'),('Enterprise Applications'),
  ('Digital Transformation'),('Digitalisierung'),('IT Infrastructure'),('IT Infrastruktur'),('Cloud'),
  ('Service Delivery'),('IT Operations'),('IT Betrieb')
) AS t(term)
ON CONFLICT (term) DO NOTHING;
