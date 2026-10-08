CREATE TABLE public.city_housing_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  city text NOT NULL,
  rent_cold_sqm numeric NOT NULL CHECK (rent_cold_sqm > 0 AND rent_cold_sqm < 100),
  utilities_sqm numeric CHECK (utilities_sqm IS NULL OR (utilities_sqm >= 0 AND utilities_sqm < 50)),
  market_tightness text NOT NULL DEFAULT 'unspecified' CHECK (market_tightness IN ('unspecified','relaxed','moderate','tight','very_tight')),
  source_name text NOT NULL CHECK (length(trim(source_name)) > 0),
  source_url text CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  source_year integer NOT NULL CHECK (source_year BETWEEN 2000 AND 2100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, city)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.city_housing_benchmarks TO authenticated;
GRANT ALL ON public.city_housing_benchmarks TO service_role;
ALTER TABLE public.city_housing_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own housing select" ON public.city_housing_benchmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own housing insert" ON public.city_housing_benchmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own housing update" ON public.city_housing_benchmarks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own housing delete" ON public.city_housing_benchmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);