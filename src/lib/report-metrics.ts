export type ReportJob = {
  refnr: string; title: string; employer: string | null; city: string | null; region: string | null; beruf: string | null;
  berufsfelder: string[]; keywords: string[]; contract: string | null; fulltime: boolean | null; parttime: boolean | null;
  homeoffice: boolean | null; salary_type: string | null; salary_from: number | null; salary_to: number | null;
  published_from: string | null; first_seen: string; last_seen: string; expired: boolean;
  language: { classification: string; cefr_level: string | null; estimated_cefr?: string | null; german_required: boolean | null; english_accessible: boolean | null; evidence: string[] } | null;
};

const agencyPattern = /personal|zeitarbeit|arbeitnehmerüberlass|recruit|staffing|manpower|randstad|adecco|akkodis|hays|ferchau|persona service|expertum|tempton|orizon/i;
export const employerKind = (name: string) => agencyPattern.test(name) ? "Agentur (Namenshinweis)" : "Nicht klassifiziert";
const pct = (n: number, d: number) => d ? (n / d) * 100 : 0;
const daysBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export function buildReportMetrics(rows: ReportJob[], weights: Record<string, number>) {
  const now = Date.now();
  const cityMap = new Map<string, ReportJob[]>();
  for (const row of rows) if (row.city) cityMap.set(row.city, [...(cityMap.get(row.city) ?? []), row]);
  const rawCities = [...cityMap].map(([city, jobs]) => {
    const active = jobs.filter((job) => !job.expired).length;
    const expired = jobs.filter((job) => job.expired).length;
    const analysed = jobs.filter((job) => job.language).length;
    const english = jobs.filter((job) => job.language?.english_accessible).length;
    return { city, active, total: jobs.length, expired, new7: jobs.filter((job) => job.published_from && now - new Date(job.published_from).getTime() <= 7 * 86400000).length,
      employers: new Set(jobs.map((job) => job.employer).filter(Boolean)).size, remotePct: pct(jobs.filter((job) => job.homeoffice).length, jobs.length),
      permanentPct: pct(jobs.filter((job) => job.contract === "UNBEFRISTET").length, jobs.length), salaryPct: pct(jobs.filter((job) => job.salary_from !== null).length, jobs.length),
      languageCoverage: analysed, englishPct: pct(english, analysed), expiryPct: pct(expired, jobs.length),
      avgDays: jobs.length ? jobs.reduce((sum, job) => sum + daysBetween(job.first_seen, job.last_seen), 0) / jobs.length : 0 };
  });
  const maximum = (key: "active" | "new7" | "employers") => Math.max(1, ...rawCities.map((row) => row[key]));
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const cities = rawCities.map((row) => {
    const contributions: Record<string, number> = {
      volume: row.active / maximum("active") * (weights["volume"] ?? 0),
      growth: row.new7 / maximum("new7") * (weights["growth"] ?? 0),
      remote: row.remotePct / 100 * (weights["remote"] ?? 0),
      permanent: row.permanentPct / 100 * (weights["permanent"] ?? 0),
      diversity: row.employers / maximum("employers") * (weights["diversity"] ?? 0),
      language: row.englishPct / 100 * (weights["language"] ?? 0),
    };
    const score = 100 * Object.values(contributions).reduce((sum, value) => sum + value, 0) / totalWeight;
    return { ...row, contributions, score };
  }).sort((a, b) => b.score - a.score);
  const employerCounts = Object.entries(rows.reduce<Record<string, number>>((map, job) => { if (job.employer) map[job.employer] = (map[job.employer] ?? 0) + 1; return map; }, {})).sort((a, b) => b[1] - a[1]);
  const categories: [string, (job: ReportJob) => boolean][] = [
    ["Explizites CEFR-Niveau", (j) => !!j.language?.cefr_level], ["Deutsch erforderlich, Niveau unklar", (j) => j.language?.classification === "german_unspecified"],
    ["Deutsch optional", (j) => j.language?.classification === "german_optional"], ["Englisch zugänglich", (j) => j.language?.classification === "english_accessible"],
    ["Keine klare Sprachaussage", (j) => j.language?.classification === "unknown"], ["Noch nicht analysiert", (j) => !j.language],
  ];
  const language = categories.map(([label, match]) => ({ label, count: rows.filter(match).length }));
  const estimatedLabels: [string, string][] = [["C1-C2", "C1–C2 (verhandlungssicher)"], ["B2-C1", "B2–C1 (fließend)"], ["B1-B2", "B1–B2 (gute Kenntnisse)"], ["A2", "A2 (Grundkenntnisse)"]];
  const estimatedLanguage = estimatedLabels.map(([key, label]) => ({ label: `Geschätzt: ${label}`, count: rows.filter((j) => j.language?.estimated_cefr === key).length }));
  return { cities, employerCounts, language, estimatedLanguage, analysed: rows.filter((job) => job.language).length,
    agency: rows.filter((job) => job.employer && employerKind(job.employer).startsWith("Agentur")).length };
}