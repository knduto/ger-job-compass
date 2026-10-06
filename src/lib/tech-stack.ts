/**
 * Deterministic, evidence-based tech-stack / seniority / remote extraction from stored
 * Arbeitsagentur descriptions. Pure functions only — every finding carries the exact excerpt.
 * Evidence entries are encoded as "<tag>|<excerpt>", e.g. "core:Python|… Erfahrung mit Python …".
 */
export const TECH_VERSION = 1;
export type Seniority = "junior" | "mid" | "senior" | "lead" | "unspecified";
export type RemoteMode = "remote" | "hybrid" | "onsite" | "unspecified";

type Skill = { name: string; src: string; cs?: boolean; cat: string };

// List-only context for ambiguous one-letter / common-word names (C, R, Go).
const LIST_BEFORE = String.raw`(?<=[,/(]\s?|\b(?:und|and|oder|or|sowie|wie)\s)`;
const LIST_AFTER = String.raw`(?=\s?[,/)]|\s(?:und|and|oder|or|sowie)\s)`;

export const SKILLS: Skill[] = [
  // Languages
  { cat: "Sprachen", name: "Python", src: "Python" },
  { cat: "Sprachen", name: "Java", src: String.raw`Java(?!\s?-?\s?Script)` },
  { cat: "Sprachen", name: "JavaScript", src: String.raw`JavaScript|ECMAScript|JS` , cs: false },
  { cat: "Sprachen", name: "TypeScript", src: "TypeScript" },
  { cat: "Sprachen", name: "C#", src: String.raw`C#|C-Sharp` },
  { cat: "Sprachen", name: "C++", src: String.raw`C\+\+|CPP` },
  { cat: "Sprachen", name: "C", cs: true, src: String.raw`C(?=\s?\/\s?C\+\+)|Programmiersprache C(?![#+])|${LIST_BEFORE}C${LIST_AFTER}` },
  { cat: "Sprachen", name: "Go", cs: true, src: String.raw`Golang|Go(?=-(?:Entwickl|Developer|Programm))|Programmiersprache Go|${LIST_BEFORE}Go${LIST_AFTER}` },
  { cat: "Sprachen", name: "R", cs: true, src: String.raw`Programmiersprache R|R-Programmierung|${LIST_BEFORE}R${LIST_AFTER}` },
  { cat: "Sprachen", name: "Rust", cs: true, src: "Rust" },
  { cat: "Sprachen", name: "Kotlin", src: "Kotlin" },
  { cat: "Sprachen", name: "Swift", cs: true, src: "Swift" },
  { cat: "Sprachen", name: "PHP", src: "PHP" },
  { cat: "Sprachen", name: "Ruby", src: String.raw`Ruby(?: on Rails)?` },
  { cat: "Sprachen", name: "Scala", cs: true, src: "Scala" },
  { cat: "Sprachen", name: "SQL", cs: true, src: "SQL" },
  { cat: "Sprachen", name: "Bash/Shell", src: String.raw`Bash|Shell[\s-]?Scripting` },
  { cat: "Sprachen", name: "PowerShell", src: "PowerShell" },
  { cat: "Sprachen", name: "ABAP", cs: true, src: "ABAP" },
  { cat: "Sprachen", name: "MATLAB", src: "MATLAB" },
  { cat: "Sprachen", name: "Perl", cs: true, src: "Perl" },
  { cat: "Sprachen", name: "COBOL", src: "COBOL" },
  // Frontend
  { cat: "Frontend", name: "React", src: String.raw`React(?:\.js|JS)?(?!\s?Native)` },
  { cat: "Frontend", name: "React Native", src: String.raw`React\s?Native` },
  { cat: "Frontend", name: "Angular", src: String.raw`Angular(?:JS)?` },
  { cat: "Frontend", name: "Vue.js", src: String.raw`Vue(?:\.js|JS)?` },
  { cat: "Frontend", name: "Next.js", src: String.raw`Next\.js` },
  { cat: "Frontend", name: "Svelte", src: "Svelte(?:Kit)?" },
  { cat: "Frontend", name: "HTML", src: "HTML5?" },
  { cat: "Frontend", name: "CSS", src: "CSS3?" },
  { cat: "Frontend", name: "Tailwind CSS", src: "Tailwind(?:\\s?CSS)?" },
  { cat: "Frontend", name: "Redux", src: "Redux" },
  // Backend
  { cat: "Backend", name: "Node.js", src: String.raw`Node(?:\.js|JS)` },
  { cat: "Backend", name: "Spring", cs: true, src: String.raw`Spring(?:\s?Boot)?` },
  { cat: "Backend", name: ".NET", src: String.raw`ASP\.NET(?:\s?Core)?|\.NET(?:\s?Core)?|dotnet` },
  { cat: "Backend", name: "Django", src: "Django" },
  { cat: "Backend", name: "Flask", cs: true, src: "Flask" },
  { cat: "Backend", name: "FastAPI", src: "FastAPI" },
  { cat: "Backend", name: "Express.js", src: String.raw`Express\.js|ExpressJS` },
  { cat: "Backend", name: "NestJS", src: String.raw`NestJS|Nest\.js` },
  { cat: "Backend", name: "Laravel", src: "Laravel" },
  { cat: "Backend", name: "Symfony", src: "Symfony" },
  { cat: "Backend", name: "Hibernate", src: "Hibernate" },
  { cat: "Backend", name: "Quarkus", src: "Quarkus" },
  // Cloud & DevOps
  { cat: "Cloud & DevOps", name: "AWS", src: String.raw`AWS|Amazon Web Services` },
  { cat: "Cloud & DevOps", name: "Azure", cs: true, src: String.raw`Azure` },
  { cat: "Cloud & DevOps", name: "Google Cloud", src: String.raw`GCP|Google Cloud(?: Platform)?` },
  { cat: "Cloud & DevOps", name: "Kubernetes", src: String.raw`Kubernetes|k8s` },
  { cat: "Cloud & DevOps", name: "Docker", src: "Docker" },
  { cat: "Cloud & DevOps", name: "Terraform", src: "Terraform" },
  { cat: "Cloud & DevOps", name: "Ansible", src: "Ansible" },
  { cat: "Cloud & DevOps", name: "Helm", cs: true, src: "Helm(?:\\s?Charts?)?" },
  { cat: "Cloud & DevOps", name: "OpenShift", src: "OpenShift" },
  { cat: "Cloud & DevOps", name: "Jenkins", src: "Jenkins" },
  { cat: "Cloud & DevOps", name: "GitLab CI", src: String.raw`GitLab(?:[\s-]?CI(?:\/CD)?)?` },
  { cat: "Cloud & DevOps", name: "GitHub Actions", src: String.raw`GitHub[\s-]Actions` },
  { cat: "Cloud & DevOps", name: "CI/CD", src: String.raw`CI\s?\/\s?CD` },
  { cat: "Cloud & DevOps", name: "Linux", src: "Linux" },
  { cat: "Cloud & DevOps", name: "Prometheus", cs: true, src: "Prometheus" },
  { cat: "Cloud & DevOps", name: "Grafana", src: "Grafana" },
  { cat: "Cloud & DevOps", name: "Argo CD", src: String.raw`Argo\s?CD` },
  { cat: "Cloud & DevOps", name: "Git", cs: true, src: "Git" },
  { cat: "Cloud & DevOps", name: "VMware", src: "VMware" },
  // Data & AI
  { cat: "Daten & KI", name: "PostgreSQL", src: String.raw`PostgreSQL|Postgres` },
  { cat: "Daten & KI", name: "MySQL", src: "MySQL" },
  { cat: "Daten & KI", name: "MariaDB", src: "MariaDB" },
  { cat: "Daten & KI", name: "Oracle", cs: true, src: "Oracle" },
  { cat: "Daten & KI", name: "MS SQL Server", src: String.raw`MS[\s-]?SQL(?:\s?Server)?|SQL[\s-]Server` },
  { cat: "Daten & KI", name: "MongoDB", src: "MongoDB" },
  { cat: "Daten & KI", name: "Redis", src: "Redis" },
  { cat: "Daten & KI", name: "Elasticsearch", src: String.raw`Elasticsearch|Elastic Stack|ELK` },
  { cat: "Daten & KI", name: "Cassandra", src: "Cassandra" },
  { cat: "Daten & KI", name: "Kafka", src: String.raw`(?:Apache\s)?Kafka` },
  { cat: "Daten & KI", name: "RabbitMQ", src: "RabbitMQ" },
  { cat: "Daten & KI", name: "Spark", cs: true, src: String.raw`PySpark|(?:Apache\s)?Spark` },
  { cat: "Daten & KI", name: "Hadoop", src: "Hadoop" },
  { cat: "Daten & KI", name: "Airflow", src: String.raw`(?:Apache\s)?Airflow` },
  { cat: "Daten & KI", name: "dbt", cs: true, src: "dbt" },
  { cat: "Daten & KI", name: "Snowflake", cs: true, src: "Snowflake" },
  { cat: "Daten & KI", name: "Databricks", src: "Databricks" },
  { cat: "Daten & KI", name: "BigQuery", src: "BigQuery" },
  { cat: "Daten & KI", name: "Power BI", src: String.raw`Power\s?BI` },
  { cat: "Daten & KI", name: "Tableau", cs: true, src: "Tableau" },
  { cat: "Daten & KI", name: "Pandas", src: "Pandas" },
  { cat: "Daten & KI", name: "TensorFlow", src: "TensorFlow" },
  { cat: "Daten & KI", name: "PyTorch", src: "PyTorch" },
  { cat: "Daten & KI", name: "scikit-learn", src: String.raw`scikit[\s-]learn|sklearn` },
  { cat: "Daten & KI", name: "SAP", cs: true, src: String.raw`SAP(?:\s?(?:S\/4\s?HANA|HANA|BW|ERP))?` },
  // Practices & tooling
  { cat: "Methoden & Tools", name: "REST", cs: true, src: String.raw`REST(?:ful)?(?:[\s-]?APIs?)?|RESTful` },
  { cat: "Methoden & Tools", name: "GraphQL", src: "GraphQL" },
  { cat: "Methoden & Tools", name: "Microservices", src: String.raw`Micro[\s-]?services?|Microservice-Architektur(?:en)?` },
  { cat: "Methoden & Tools", name: "Scrum", src: "Scrum" },
  { cat: "Methoden & Tools", name: "Kanban", src: "Kanban" },
  { cat: "Methoden & Tools", name: "Jira", src: "Jira" },
  { cat: "Methoden & Tools", name: "Selenium", src: "Selenium" },
  { cat: "Methoden & Tools", name: "Cypress", cs: true, src: "Cypress" },
  { cat: "Methoden & Tools", name: "JUnit", src: "JUnit" },
  { cat: "Methoden & Tools", name: "ITIL", cs: true, src: "ITIL" },
  { cat: "Methoden & Tools", name: "ISO 27001", src: String.raw`ISO[\s/]?(?:IEC\s?)?27001` },
  { cat: "Methoden & Tools", name: "Active Directory", src: "Active Directory" },
  { cat: "Methoden & Tools", name: "Windows Server", src: String.raw`Windows[\s-]Server` },
  { cat: "Methoden & Tools", name: "Cisco", cs: true, src: "Cisco" },
  { cat: "Methoden & Tools", name: "SIEM", cs: true, src: "SIEM" },
];

export const SKILL_NAMES = SKILLS.map((s) => s.name);
export const SKILL_CATEGORY: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.name, s.cat]));

const B = String.raw`(?<![\p{L}\p{N}_#+.])`;
const A = String.raw`(?![\p{L}\p{N}_#+]|\.[\p{L}])`;
const COMPILED = SKILLS.map((s) => ({ ...s, re: new RegExp(`${B}(?:${s.src})${A}`, s.cs ? "gu" : "giu") }));

const NEG_BEFORE = /(?:\b(?:kein(?:e|en|er|em)?|nicht|ohne|no|not|without)\b)[^.,;:!?\n]{0,25}$/iu;
const NEG_OK = /\b(?:nicht nur|not only|ohne dass|no matter)\b[^.,;:!?\n]{0,25}$/iu;
const NEG_AFTER = /^[^.,;!?\n]{0,30}(?:nicht\s+(?:erforderlich|notwendig|nötig|vorausgesetzt|gefordert|benötigt)|not\s+(?:required|needed|necessary)|sind kein muss|ist kein muss|is not a must)/iu;

const BONUS_CUE = /wünschenswert|wuenschenswert|von vorteil|vorteilhaft|nice[\s-]to[\s-]have|idealerweise|ideally|optional|\bplus\b|pluspunkt|bonus|gerne auch|wäre schön|would be great|is a plus|ist ein plus|a plus/iu;
const CORE_HEAD = /anforderung|profil|voraussetzung|qualifikation|must[\s-]have|was du mitbringst|das bringst du mit|das bringen sie mit|was sie mitbringen|dein profil|ihr profil|requirements|qualifications|what you bring|your profile|you have|kenntnisse/iu;
const OTHER_HEAD = /aufgaben|tätigkeit|wir bieten|benefits|what we offer|unser angebot|über uns|about us|your tasks|responsibilities|kontakt/iu;

export function cleanText(s: string | null | undefined) {
  return (s ?? "")
    .replace(/<\s*(?:br|\/p|\/li|\/h\d|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*#+\s*/, "").replace(/[*`>]+|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
const clip = (line: string, idx: number, len: number) => {
  const s = Math.max(0, idx - 60);
  const e = Math.min(line.length, idx + len + 80);
  return `${s > 0 ? "…" : ""}${line.slice(s, e).trim()}${e < line.length ? "…" : ""}`;
};
const isHeading = (l: string) => l.length <= 70 && (/:$/.test(l) || l.split(" ").length <= 6);
const negated = (line: string, idx: number, len: number) => {
  const before = line.slice(Math.max(0, idx - 40), idx);
  const after = line.slice(idx + len, idx + len + 45);
  return (NEG_BEFORE.test(before) && !NEG_OK.test(before)) || NEG_AFTER.test(after);
};

export function extractSkills(description: string | null | undefined) {
  const lines = cleanText(description);
  const core = new Map<string, string>();
  const bonus = new Map<string, string>();
  let section: "core" | "bonus" | "other" = "other";
  for (const line of lines) {
    if (isHeading(line)) {
      if (BONUS_CUE.test(line)) section = "bonus";
      else if (CORE_HEAD.test(line)) section = "core";
      else if (OTHER_HEAD.test(line)) section = "other";
    }
    // Split long lines into clauses so a "von Vorteil" only affects its own sentence.
    const clauses = line.split(/(?<=[.;!?])\s+/);
    for (const clause of clauses) {
      const bonusClause = section === "bonus" || BONUS_CUE.test(clause);
      for (const s of COMPILED) {
        for (const m of clause.matchAll(s.re)) {
          const idx = m.index ?? 0;
          if (negated(clause, idx, m[0].length)) continue;
          const target = bonusClause ? bonus : core;
          if (!target.has(s.name)) target.set(s.name, clip(clause, idx, m[0].length));
          break;
        }
      }
    }
  }
  for (const k of core.keys()) bonus.delete(k); // core wins
  return { core, bonus };
}

const T_LEAD = /\b(?:lead|principal|head of|chief|teamleit\w*|teamlead\w*|leiter\w*|leitung|architekt\w*|architect)\b/iu;
const T_SENIOR = /\b(?:senior|sr\.)(?![\p{L}])/iu;
const T_JUNIOR = /\b(?:junior|jr\.|trainee|berufseinsteiger\w*|einsteiger\w*|absolvent\w*|graduate|werkstudent\w*|praktikant\w*|praktikum|azubi|auszubildende\w*|ausbildung)(?![\p{L}])/iu;
const T_MID = /\b(?:mid[\s-]?level|medior|professional)\b/iu;
const D_RULES: [Exclude<Seniority, "unspecified">, RegExp][] = [
  ["lead", /\b(?:tech(?:nical)?[\s-]?lead|team[\s-]?lead|lead[\s-](?:developer|engineer|entwickler\w*)|principal[\s-](?:engineer|developer))\b/giu],
  ["senior", /\b(?:senior[\s-]?(?:level|position|rolle|role|engineer|developer|entwickler\w*)|als senior)\b/giu],
  ["mid", /\b(?:mid[\s-]?level|medior)\b/giu],
  ["junior", /\b(?:junior[\s-]?(?:level|position|rolle|role)|berufseinsteiger\w*|einstiegsposition|entry[\s-]level|graduates?)\b/giu],
];

export function extractSeniority(title: string | null | undefined, description: string | null | undefined) {
  const t = (title ?? "").replace(/\s+/g, " ").trim();
  const order: [Exclude<Seniority, "unspecified">, RegExp][] = [["lead", T_LEAD], ["senior", T_SENIOR], ["junior", T_JUNIOR], ["mid", T_MID]];
  for (const [level, re] of order) {
    const m = t.match(re);
    if (m) return { seniority: level as Seniority, evidence: [`seniority:${level}|Titel: ${t}`], flags: ["seniority_from_title"] };
  }
  const text = cleanText(description).join(" \n ");
  const found = new Map<string, string>();
  for (const [level, re] of D_RULES) {
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      if (negated(text, idx, m[0].length)) continue;
      if (!found.has(level)) found.set(level, clip(text, idx, m[0].length));
      break;
    }
  }
  if (found.size === 1) {
    const [level, ex] = [...found.entries()][0]!;
    return { seniority: level as Seniority, evidence: [`seniority:${level}|${ex}`], flags: ["seniority_from_description"] };
  }
  if (found.size > 1) return { seniority: "unspecified" as Seniority, evidence: [...found].map(([l, e]) => `seniority:${l}|${e}`), flags: ["seniority_ambiguous"] };
  return { seniority: "unspecified" as Seniority, evidence: [] as string[], flags: [] as string[] };
}

const R_STRONG = /(?:100\s?%|vollständig|komplett|ausschließlich|full(?:y)?|zu 100)\s*(?:remote|im home[\s-]?office|home[\s-]?office|mobil(?:es arbeiten)?)|remote[\s-]first|fully[\s-]remote|full[\s-]remote|remote[\s-]only|deutschlandweit\s+remote|remote\s+(?:aus|from)\s+(?:ganz\s+)?(?:deutschland|germany|anywhere)/giu;
const R_HYBRID = /hybrid\w*|(?<!\d)\d{1,2}\s?(?:%|tage?|days?)\s*(?:pro|per|die|in der|a)?\s*(?:woche|week)?\s*(?:im\s+|von\s+)?(?:home[\s-]?office|remote|mobil)|anteilig\w*\s+(?:home[\s-]?office|remote|mobil\w*)|teilweise\s+(?:home[\s-]?office|remote|mobil\w*)|mobiles arbeiten|mobile working|home[\s-]?office[\s-]?(?:tage|anteil|möglichkeit|option)|(?:möglichkeit|option)\s+(?:zum|zu|auf|for)\s+(?:home[\s-]?office|remote|mobile\w*)/giu;
const R_WEAK = /\bremote\b|home[\s-]?office/giu;
const R_ONSITE = /vor[\s-]ort[\s-]?(?:tätigkeit|präsenz|arbeit|position|job)|präsenz(?:pflicht|tätigkeit|arbeit)|on[\s-]?site(?![\s-]?(?:visit|support))|kein(?:e)?\s+(?:home[\s-]?office|remote)|(?:home[\s-]?office|remote(?:arbeit)?)\s+(?:ist\s+)?(?:leider\s+)?nicht\s+möglich|100\s?%\s*vor\s+ort/giu;

function firstHit(text: string, re: RegExp, allowNegated = false) {
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (!allowNegated && negated(text, idx, m[0].length)) continue;
    return clip(text, idx, m[0].length);
  }
  return null;
}

export function extractRemote(description: string | null | undefined, homeofficeFlag?: boolean | null) {
  const text = cleanText(description).join(" \n ");
  const strong = firstHit(text, R_STRONG);
  const hybrid = firstHit(text, R_HYBRID);
  const onsite = firstHit(text, R_ONSITE, true);
  const weak = firstHit(text, R_WEAK);
  const flags: string[] = [];
  let mode: RemoteMode = "unspecified";
  let ex: string | null = null;
  if (strong && !hybrid) { mode = "remote"; ex = strong; }
  else if (hybrid) { mode = "hybrid"; ex = hybrid; }
  else if (onsite && weak && !/kein|nicht/i.test(onsite)) { mode = "hybrid"; ex = `${weak} … ${onsite}`; }
  else if (onsite) { mode = "onsite"; ex = onsite; }
  else if (weak) { mode = /remote/i.test(weak) ? "remote" : "hybrid"; ex = weak; if (mode === "hybrid") flags.push("homeoffice_mentioned"); }
  const evidence = ex ? [`remote:${mode}|${ex}`] : [];
  if (homeofficeFlag) {
    flags.push("ba_homeoffice");
    evidence.push("remote:ba|Arbeitsagentur-Merkmal: Homeoffice möglich");
    if (mode === "onsite") flags.push("homeoffice_conflict");
  }
  return { remote_mode: mode, evidence, flags };
}

export function evaluateTechStack(input: { title?: string | null; description?: string | null; homeoffice?: boolean | null }) {
  const { core, bonus } = extractSkills(input.description);
  const sen = extractSeniority(input.title, input.description);
  const rem = extractRemote(input.description, input.homeoffice);
  const evidence = [
    ...[...core].map(([k, e]) => `core:${k}|${e}`),
    ...[...bonus].map(([k, e]) => `bonus:${k}|${e}`),
    ...sen.evidence,
    ...rem.evidence,
  ].map((e) => e.slice(0, 260));
  return {
    core_skills: [...core.keys()].sort(),
    bonus_skills: [...bonus.keys()].sort(),
    seniority: sen.seniority,
    remote_mode: rem.remote_mode,
    flags: [...new Set([...sen.flags, ...rem.flags])],
    evidence,
    version: TECH_VERSION,
  };
}

export function parseEvidence(e: string) {
  const i = e.indexOf("|");
  const tag = i >= 0 ? e.slice(0, i) : "";
  const [kind, value] = tag.split(":");
  return { kind: kind ?? "", value: value ?? "", excerpt: i >= 0 ? e.slice(i + 1) : e };
}

export const SENIORITY_LABELS: Record<string, string> = { junior: "Junior / Einstieg", mid: "Mid-Level", senior: "Senior", lead: "Lead / Architekt", unspecified: "Keine Angabe" };
export const REMOTE_LABELS: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "Vor Ort", unspecified: "Keine Angabe" };
