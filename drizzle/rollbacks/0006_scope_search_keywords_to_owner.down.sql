-- !!! DO NOT RUN WITHOUT A BACKUP — DATA LOSS !!!
-- Keyword ownership (user_id) is permanently removed and all authenticated users
-- regain read/write access to every keyword.
-- NEVER RUN AUTOMATICALLY. This rollback is documentation-first and must be reviewed
-- by a human (and tested in a draft/isolated backend) before it is ever executed.
-- Reverses: 0006_scope_search_keywords_to_owner.sql

DROP POLICY IF EXISTS "own keywords select" ON public.search_keywords;
DROP POLICY IF EXISTS "own keywords insert" ON public.search_keywords;
DROP POLICY IF EXISTS "own keywords update" ON public.search_keywords;
DROP POLICY IF EXISTS "own keywords delete" ON public.search_keywords;
DROP POLICY IF EXISTS "auth read keywords" ON public.search_keywords;
DROP POLICY IF EXISTS "auth write keywords" ON public.search_keywords;
DROP POLICY IF EXISTS "auth update keywords" ON public.search_keywords;
DROP POLICY IF EXISTS "auth delete keywords" ON public.search_keywords;
CREATE POLICY "auth read keywords" ON public.search_keywords FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write keywords" ON public.search_keywords FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update keywords" ON public.search_keywords FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete keywords" ON public.search_keywords FOR DELETE TO authenticated USING (true);
ALTER TABLE public.search_keywords DROP COLUMN IF EXISTS user_id;
