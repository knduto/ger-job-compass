CREATE INDEX IF NOT EXISTS idx_jobs_expired_published_refnr
  ON public.jobs (expired, published_from DESC NULLS LAST) INCLUDE (refnr);

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
      ORDER BY j.expired ASC, j.published_from DESC NULLS LAST, j.refnr
      LIMIT n;
  ELSIF p_kind = 'visa' THEN
    RETURN QUERY SELECT j.refnr FROM public.jobs j
      WHERE NOT EXISTS (SELECT 1 FROM public.job_visa_feasibility v WHERE v.refnr = j.refnr)
      ORDER BY j.expired ASC, j.published_from DESC NULLS LAST, j.refnr
      LIMIT n;
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
      FROM (SELECT count(*)::bigint AS c FROM public.jobs) t,
           (SELECT count(*)::bigint AS c FROM public.job_language_analysis) a;
  ELSIF p_kind = 'visa' THEN
    RETURN QUERY SELECT t.c, a.c, greatest(0, t.c - a.c)
      FROM (SELECT count(*)::bigint AS c FROM public.jobs) t,
           (SELECT count(*)::bigint AS c FROM public.job_visa_feasibility) a;
  ELSE
    RAISE EXCEPTION 'unknown analysis kind %', p_kind;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.pending_analysis_refs(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analysis_backlog(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_analysis_refs(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.analysis_backlog(text) TO service_role;