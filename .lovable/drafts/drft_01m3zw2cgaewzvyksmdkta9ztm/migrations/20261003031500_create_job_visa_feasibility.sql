CREATE TABLE public.job_visa_feasibility (
  refnr text PRIMARY KEY REFERENCES public.jobs(refnr) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unspecified',
  flags text[] NOT NULL DEFAULT '{}',
  evidence text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  analysed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_visa_feasibility_status_valid CHECK (status IN ('restricted','work_permit_required','international_friendly','unspecified'))
);
GRANT SELECT ON public.job_visa_feasibility TO authenticated;
GRANT ALL ON public.job_visa_feasibility TO service_role;
ALTER TABLE public.job_visa_feasibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read visa feasibility" ON public.job_visa_feasibility FOR SELECT TO authenticated USING (true);
CREATE INDEX job_visa_feasibility_status_idx ON public.job_visa_feasibility(status);
