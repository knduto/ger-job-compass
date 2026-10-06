CREATE TABLE IF NOT EXISTS public.job_tech_stack (
  refnr text PRIMARY KEY REFERENCES public.jobs(refnr) ON DELETE CASCADE,
  core_skills text[] NOT NULL DEFAULT '{}',
  bonus_skills text[] NOT NULL DEFAULT '{}',
  seniority text NOT NULL DEFAULT 'unspecified',
  remote_mode text NOT NULL DEFAULT 'unspecified',
  flags text[] NOT NULL DEFAULT '{}',
  evidence text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  analysed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_tech_stack_seniority_valid CHECK (seniority IN ('junior','mid','senior','lead','unspecified')),
  CONSTRAINT job_tech_stack_remote_valid CHECK (remote_mode IN ('remote','hybrid','onsite','unspecified'))
);
GRANT SELECT ON public.job_tech_stack TO authenticated;
GRANT ALL ON public.job_tech_stack TO service_role;
ALTER TABLE public.job_tech_stack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tech stack" ON public.job_tech_stack FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS job_tech_stack_core_gin ON public.job_tech_stack USING gin (core_skills);
CREATE INDEX IF NOT EXISTS job_tech_stack_bonus_gin ON public.job_tech_stack USING gin (bonus_skills);
CREATE INDEX IF NOT EXISTS job_tech_stack_seniority_idx ON public.job_tech_stack (seniority);
CREATE INDEX IF NOT EXISTS job_tech_stack_remote_idx ON public.job_tech_stack (remote_mode);

CREATE OR REPLACE FUNCTION public.pending_analysis_refs(p_kind text, p_limit integer DEFAULT 10)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE n integer := greatest(1, least(coalesce(p_limit, 10), 100));
BEGIN
  IF p_kind = 'language' THEN
    RETURN QUERY SELECT j.refnr FROM public.jobs j
      WHERE NOT EXISTS (SELECT 1 FROM public.job_language_analysis a WHERE a.refnr = j.refnr)
      ORDER BY j.expired ASC, j.published_from DESC NULLS LAST, j.refnr LIMIT n;
  ELSIF p_kind = 'visa' THEN
    RETURN QUERY SELECT j.refnr FROM public.jobs j
      WHERE NOT EXISTS (SELECT 1 FROM public.job_visa_feasibility v WHERE v.refnr = j.refnr)
      ORDER BY j.expired ASC, j.published_from DESC NULLS LAST, j.refnr LIMIT n;
  ELSIF p_kind = 'tech' THEN
    RETURN QUERY SELECT j.refnr FROM public.jobs j
      WHERE NOT EXISTS (SELECT 1 FROM public.job_tech_stack t WHERE t.refnr = j.refnr)
      ORDER BY j.expired ASC, j.published_from DESC NULLS LAST, j.refnr LIMIT n;
  ELSE
    RAISE EXCEPTION 'unknown analysis kind %', p_kind;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.analysis_backlog(p_kind text)
RETURNS TABLE (total bigint, analysed bigint, pending bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_kind = 'language' THEN
    RETURN QUERY SELECT t.c, a.c, greatest(0, t.c - a.c)
      FROM (SELECT count(*)::bigint AS c FROM public.jobs) t, (SELECT count(*)::bigint AS c FROM public.job_language_analysis) a;
  ELSIF p_kind = 'visa' THEN
    RETURN QUERY SELECT t.c, a.c, greatest(0, t.c - a.c)
      FROM (SELECT count(*)::bigint AS c FROM public.jobs) t, (SELECT count(*)::bigint AS c FROM public.job_visa_feasibility) a;
  ELSIF p_kind = 'tech' THEN
    RETURN QUERY SELECT t.c, a.c, greatest(0, t.c - a.c)
      FROM (SELECT count(*)::bigint AS c FROM public.jobs) t, (SELECT count(*)::bigint AS c FROM public.job_tech_stack) a;
  ELSE
    RAISE EXCEPTION 'unknown analysis kind %', p_kind;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.pending_analysis_refs(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analysis_backlog(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_analysis_refs(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.analysis_backlog(text) TO service_role;
