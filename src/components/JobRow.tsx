import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_LABELS } from "@/lib/it-fields";
import { fmt, fmtDate } from "./AppShell";
import { REMOTE_LABELS, SENIORITY_LABELS } from "@/lib/tech-stack";
import { VISA_BADGE_CLASS, VISA_STATUS_LABELS } from "@/lib/visa-labels";

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
  job_visa_feasibility?: JobVisa | JobVisa[] | null;
  job_tech_stack?: JobTech | JobTech[] | null;
};
export type JobTech = { core_skills: string[]; bonus_skills: string[]; seniority: string; remote_mode: string; flags: string[] };
export function jobTech(job: JobListItem): JobTech | null {
  const v = job.job_tech_stack;
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
export type JobVisa = { status: string; flags: string[] };
export function jobVisa(job: JobListItem): JobVisa | null {
  const v = job.job_visa_feasibility;
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

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
  const lang = jobLanguage(job);
  const visa = jobVisa(job);
  const tech = jobTech(job);
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
          {lang?.cefr_level && <Badge variant="secondary">{lang.cefr_level} (explizit)</Badge>}
          {!lang?.cefr_level && lang?.estimated_cefr && <Badge variant="outline">{lang.estimated_cefr.replace("-", "–")} (geschätzt)</Badge>}
          {lang?.english_accessible && <Badge variant="secondary">Englisch zugänglich</Badge>}
          {visa && visa.status !== "unspecified" && <Badge className={VISA_BADGE_CLASS[visa.status]}>{VISA_STATUS_LABELS[visa.status]}</Badge>}
          {lang?.german_required && !lang.cefr_level && !lang.estimated_cefr && <Badge variant="outline">Deutsch erforderlich</Badge>}
          {tech && tech.seniority !== "unspecified" && <Badge variant="secondary">{SENIORITY_LABELS[tech.seniority]}</Badge>}
          {tech && tech.remote_mode !== "unspecified" && <Badge variant="secondary">{REMOTE_LABELS[tech.remote_mode]}</Badge>}
        </div>
        {tech && (tech.core_skills.length > 0 || tech.bonus_skills.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1" translate="no">
            {tech.core_skills.slice(0, 8).map((s) => <Badge key={s}>{s}</Badge>)}
            {tech.core_skills.length > 8 && <Badge variant="outline">+{tech.core_skills.length - 8}</Badge>}
            {tech.bonus_skills.slice(0, 4).map((s) => <Badge key={`b-${s}`} variant="outline">{s}</Badge>)}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
        <span>veröff. {fmtDate(job.published_from)}</span>
        {action}
      </div>
    </div>
  );
}
