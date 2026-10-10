// Deterministic cover-letter templates built only from stored listing data and user inputs. No AI prose.

export type CoverLetterMode = "de" | "en";

export interface CoverLetterJob {
  title: string;
  employer: string | null;
  city: string | null;
  refnr: string;
}
export interface CoverLetterTech { core_skills: string[]; bonus_skills: string[] }
export interface CoverLetterLanguage { classification: string; cefr_level: string | null }

export interface CoverLetterProfile {
  name: string;
  contactLine: string;
  availability: string; // "ab sofort" or ISO date
  roleFocus: string;
  salary: string; // gross annual €, optional
  contactPerson: string; // optional
  germanLevel: string; // own CEFR, optional
  skills: string; // comma separated
}

export interface CoverLetterInput {
  mode: CoverLetterMode;
  job: CoverLetterJob;
  tech?: CoverLetterTech | null;
  language?: CoverLetterLanguage | null;
  profile: CoverLetterProfile;
  today?: Date;
}

export const VISA_LINE_DE = "Aufenthaltstitel: Chancenkarte (§ 20a AufenthG)";
export const VISA_LINE_EN = "Residence permit: Opportunity Card / Chancenkarte (§ 20a AufenthG)";

const norm = (s: string) => s.trim().toLowerCase();

export function parseSkills(s: string): string[] {
  return Array.from(new Set(s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)));
}

/** Listing skills (original casing) that the user also listed. */
export function matchSkills(userSkills: string[], tech?: CoverLetterTech | null) {
  if (!tech) return { core: [] as string[], bonus: [] as string[] };
  const mine = new Set(userSkills.map(norm));
  return {
    core: tech.core_skills.filter((k) => mine.has(norm(k))),
    bonus: tech.bonus_skills.filter((k) => mine.has(norm(k))),
  };
}

function fmtDate(d: Date, mode: CoverLetterMode) {
  return d.toLocaleDateString(mode === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: mode === "de" ? "2-digit" : "long", year: "numeric" });
}

function availabilityText(a: string, mode: CoverLetterMode) {
  const v = a.trim();
  if (!v || /^ab sofort$/i.test(v) || /^immediately$/i.test(v)) return mode === "de" ? "ab sofort" : "immediately";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00");
    return mode === "de" ? `ab dem ${fmtDate(d, "de")}` : `from ${fmtDate(d, "en")}`;
  }
  return v;
}

function salaryText(s: string, mode: CoverLetterMode): string | null {
  const n = Number(s.replace(/[^\d]/g, ""));
  if (!s.trim() || !Number.isFinite(n) || n <= 0) return null;
  const f = n.toLocaleString("de-DE");
  return mode === "de" ? `Meine Gehaltsvorstellung liegt bei ${f} € brutto pro Jahr.` : `My salary expectation is EUR ${f} gross per year.`;
}

function listJoin(xs: string[], mode: CoverLetterMode) {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + (mode === "de" ? " und " : " and ") + xs[xs.length - 1];
}

function languageParagraph(lang: CoverLetterLanguage | null | undefined, own: string, mode: CoverLetterMode): string | null {
  const o = own.trim();
  const req = lang?.classification === "cefr" && lang.cefr_level ? lang.cefr_level : null;
  if (!o && !req) return null;
  if (mode === "de") {
    const parts: string[] = [];
    if (o) parts.push(`Meine Deutschkenntnisse schätze ich auf Niveau ${o} (GER) ein`);
    if (req) parts.push(`${o ? "; die" : "Die"} Anzeige nennt Niveau ${req}`);
    return parts.join("") + ".";
  }
  const parts: string[] = [];
  if (o) parts.push(`I self-assess my German at CEFR level ${o}`);
  if (req) parts.push(`${o ? "; the" : "The"} posting states level ${req}`);
  return parts.join("") + ".";
}

export function buildCoverLetter(input: CoverLetterInput): string {
  const { mode, job, tech, language, profile } = input;
  const today = input.today ?? new Date();
  const de = mode === "de";
  const blocks: string[] = [];

  const sender = [profile.name.trim(), profile.contactLine.trim()].filter(Boolean).join("\n");
  if (sender) blocks.push(sender);
  const recipient = [job.employer, profile.contactPerson.trim() || null, job.city].filter(Boolean).join("\n");
  if (recipient) blocks.push(recipient);
  blocks.push((job.city && profile.contactLine ? "" : "") + fmtDate(today, mode));

  blocks.push(de
    ? `Betreff: Bewerbung als ${job.title}\nReferenznummer: ${job.refnr}`
    : `Subject: Application for ${job.title}\nReference number: ${job.refnr}`);

  const cp = profile.contactPerson.trim();
  blocks.push(de ? (cp ? `Sehr geehrte/r ${cp},` : "Sehr geehrte Damen und Herren,") : (cp ? `Dear ${cp},` : "Dear Hiring Team,"));

  const focus = profile.roleFocus.trim();
  const at = job.employer ? (de ? ` bei ${job.employer}` : ` at ${job.employer}`) : "";
  const where = job.city ? (de ? ` in ${job.city}` : ` in ${job.city}`) : "";
  blocks.push(de
    ? `hiermit bewerbe ich mich auf die bei der Bundesagentur für Arbeit veröffentlichte Stelle als ${job.title}${at}${where}.${focus ? ` Mein fachlicher Schwerpunkt liegt im Bereich ${focus}.` : ""}`
    : `I am applying for the position of ${job.title}${at}${where}, as published by the German Federal Employment Agency.${focus ? ` My professional focus is ${focus}.` : ""}`);

  const m = matchSkills(parseSkills(profile.skills), tech);
  if (m.core.length || m.bonus.length) {
    const s: string[] = [];
    if (m.core.length) s.push(de ? `Die in der Anzeige geforderten Kernkompetenzen ${listJoin(m.core, mode)} bringe ich mit.` : `I bring the core skills named in the posting: ${listJoin(m.core, mode)}.`);
    if (m.bonus.length) s.push(de ? `Zusätzlich verfüge ich über Erfahrung mit ${listJoin(m.bonus, mode)}.` : `I also have experience with ${listJoin(m.bonus, mode)}.`);
    blocks.push(s.join(" "));
  }

  const lp = languageParagraph(language, profile.germanLevel, mode);
  if (lp) blocks.push(lp);

  const visa = de
    ? `${VISA_LINE_DE} – ich halte mich rechtmäßig zur Arbeitsplatzsuche in Deutschland auf. Eine Arbeitsaufnahme ist ${availabilityText(profile.availability, mode)} möglich.`
    : `${VISA_LINE_EN} – I reside legally in Germany for the purpose of job search. I am available to start ${availabilityText(profile.availability, mode)}.`;
  const sal = salaryText(profile.salary, mode);
  blocks.push(sal ? `${visa} ${sal}` : visa);

  blocks.push(de
    ? "Über die Einladung zu einem persönlichen Gespräch freue ich mich sehr."
    : "I would welcome the opportunity to discuss my application in an interview.");
  blocks.push(de ? `Mit freundlichen Grüßen\n${profile.name.trim()}`.trim() : `Kind regards\n${profile.name.trim()}`.trim());

  return blocks.filter((b) => b.trim()).join("\n\n");
}
