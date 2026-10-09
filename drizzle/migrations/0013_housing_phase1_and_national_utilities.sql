ALTER TABLE public.city_housing_benchmarks
  ADD COLUMN IF NOT EXISTS furnished_warm_month numeric CHECK (furnished_warm_month IS NULL OR (furnished_warm_month > 0 AND furnished_warm_month < 10000)),
  ADD COLUMN IF NOT EXISTS furnished_source_name text,
  ADD COLUMN IF NOT EXISTS furnished_source_year integer CHECK (furnished_source_year IS NULL OR furnished_source_year BETWEEN 2000 AND 2100),
  ADD COLUMN IF NOT EXISTS utilities_source_name text,
  ADD COLUMN IF NOT EXISTS utilities_source_year integer CHECK (utilities_source_year IS NULL OR utilities_source_year BETWEEN 2000 AND 2100);

ALTER TABLE public.city_housing_benchmarks
  ADD CONSTRAINT furnished_requires_source CHECK (furnished_warm_month IS NULL OR (furnished_source_name IS NOT NULL AND length(trim(furnished_source_name)) > 0 AND furnished_source_year IS NOT NULL)) NOT VALID;

CREATE TABLE IF NOT EXISTS public.user_settlement_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  use_national_utilities boolean NOT NULL DEFAULT false,
  national_utilities_sqm numeric CHECK (national_utilities_sqm IS NULL OR (national_utilities_sqm >= 0 AND national_utilities_sqm < 50)),
  national_utilities_source text,
  national_utilities_year integer CHECK (national_utilities_year IS NULL OR national_utilities_year BETWEEN 2000 AND 2100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT national_requires_source CHECK (national_utilities_sqm IS NULL OR (national_utilities_source IS NOT NULL AND length(trim(national_utilities_source)) > 0 AND national_utilities_year IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settlement_settings TO authenticated;
GRANT ALL ON public.user_settlement_settings TO service_role;
ALTER TABLE public.user_settlement_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settlement settings select" ON public.user_settlement_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own settlement settings insert" ON public.user_settlement_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settlement settings update" ON public.user_settlement_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settlement settings delete" ON public.user_settlement_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);