import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_LABELS } from "@/lib/it-fields";
import { fmt, fmtDate } from "./AppShell";

export type JobLanguage = {
  classification?: string | null; cefr_level: string | null; estimated_cefr: string | null;
  german_required: boolean | null; english_accessible: boolean | null;
};

export type JobListItem = {
  refnr: string; title: string; employer: string | null; city: string | null; plz: string | null;
  berufsfelder: string[]; contract: string | null; fulltime: boolean | null; parttime: boolean | null; homeoffice: boolean | null;
  salary_type: string | null; salary_from: number | null; salary_to: number | null; published_from: string | null;
  first_seen: string; last_seen: string; expired: boolean; external_url: string | null;
  job_language_analysis?: JobLanguage | JobLanguage[] | null;
};

/** Normalises the embedded relation (PostgREST may return an object or a one-element array). */
export function jobLanguage(job: JobListItem): JobLanguage | null {
  const value = job.job_language_analysis;
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}


export function salaryText(j: Pick<JobListItem, "salary_from" | "salary_to" | "salary_type">) {
  if (j.salary_from == null) return null;
  const unit = j.salary_type === "JAHRESGEHALT" ? "/Jahr" : j.salary_type === "MONATSGEHALT" ? "/Monat" : j.salary_type === "STUNDENLOHN" ? "/Std." : "";
  return `${fmt(j.salary_from)}${j.salary_to && j.salary_to !== j.salary_from ? `–${fmt(j.salary_to)}` : ""} €${unit}`;
}

export function JobRow({ job, action }: { job: JobListItem; action?: React.ReactNode }) {
  const sal = salaryText(job);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <Link to="/jobs/$refnr" params={{ refnr: job.refnr }} className="font-medium hover:underline">{job.title}</Link>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {job.employer ?? "Arbeitgeber unbekannt"} · {job.city ?? "Ort unbekannt"}{job.plz ? ` (${job.plz})` : ""}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {job.expired && <Badge variant="destructive">Abgelaufen</Badge>}
          {job.homeoffice && <Badge className="bg-success text-success-foreground">Homeoffice</Badge>}
          {job.contract && <Badge variant="secondary">{CONTRACT_LABELS[job.contract] ?? job.contract}</Badge>}
          {job.fulltime && <Badge variant="outline">Vollzeit</Badge>}
          {job.parttime && <Badge variant="outline">Teilzeit</Badge>}
          {sal && <Badge className="bg-accent text-accent-foreground">{sal}</Badge>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
        <span>veröff. {fmtDate(job.published_from)}</span>
        {action}
      </div>
    </div>
  );
}
