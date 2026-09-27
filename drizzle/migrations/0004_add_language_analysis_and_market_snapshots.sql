CREATE TABLE public.job_language_analysis (
  refnr text PRIMARY KEY REFERENCES public.jobs(refnr) ON DELETE CASCADE,
  classification text NOT NULL DEFAULT 'unknown',
  cefr_level text,
  german_required boolean,
  english_accessible boolean,
  evidence text[] NOT NULL DEFAULT '{}',
  extraction_version integer NOT NULL DEFAULT 1,
  analysed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_language_classification_valid CHECK (classification IN ('cefr','german_unspecified','german_optional','english_accessible','unknown')),
  CONSTRAINT job_language_cefr_valid CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2'))
);
GRANT SELECT ON public.job_language_analysis TO authenticated;
GRANT ALL ON public.job_language_analysis TO service_role;
ALTER TABLE public.job_language_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read language analysis" ON public.job_language_analysis FOR SELECT TO authenticated USING (true);
CREATE INDEX job_language_analysis_classification_idx ON public.job_language_analysis(classification);
CREATE INDEX job_language_analysis_cefr_idx ON public.job_language_analysis(cefr_level);

CREATE TABLE public.market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT current_date,
  city text NOT NULL DEFAULT '',
  active_jobs integer NOT NULL DEFAULT 0,
  new_7d integer NOT NULL DEFAULT 0,
  expired_jobs integer NOT NULL DEFAULT 0,
  employers integer NOT NULL DEFAULT 0,
  salary_pct numeric NOT NULL DEFAULT 0,
  remote_pct numeric NOT NULL DEFAULT 0,
  analysed_jobs integer NOT NULL DEFAULT 0,
  german_required integer NOT NULL DEFAULT 0,
  english_accessible integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, city)
);
GRANT SELECT ON public.market_snapshots TO authenticated;
GRANT ALL ON public.market_snapshots TO service_role;
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read market snapshots" ON public.market_snapshots FOR SELECT TO authenticated USING (true);
CREATE INDEX market_snapshots_date_idx ON public.market_snapshots(snapshot_date);
CREATE INDEX market_snapshots_city_idx ON public.market_snapshots(city);