CREATE TABLE public.tracked_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, city)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_cities TO authenticated;
GRANT ALL ON public.tracked_cities TO service_role;
ALTER TABLE public.tracked_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cities select" ON public.tracked_cities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own cities insert" ON public.tracked_cities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cities delete" ON public.tracked_cities FOR DELETE TO authenticated USING (auth.uid() = user_id);