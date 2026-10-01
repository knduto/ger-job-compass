import { jobDetails, politeDelay } from "./ba-api.server";

type Admin = any;

const CEFR = ["C2", "C1", "B2", "B1", "A2", "A1"] as const;
const clip = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 180);
export const EXTRACTION_VERSION = 2;
export const ESTIMATED_LEVELS = ["C1-C2", "B2-C1", "B1-B2", "A2"] as const;
export type EstimatedLevel = (typeof ESTIMATED_LEVELS)[number];

const ESTIMATE_RULES: [EstimatedLevel, RegExp][] = [
  ["C1-C2", /verhandlungssicher|muttersprachlich|muttersprache|(?:exzellente|ausgezeichnete)\s+deutschkenntnisse|native\s+speaker/i],
  ["B2-C1", /flie(?:ß|ss)end|sehr\s+gute\s+deutschkenntnisse|business\s+fluent/i],
  ["B1-B2", /gute\s+deutschkenntnisse|konversationssicher|conversational\s+german/i],
  ["A2", /grundkenntnisse|basiskenntnisse|basic\s+german/i],
];

/** Heuristic estimate — only ever derived from an explicit phrase in the stored description. */
export function estimateCefr(text: string | null | undefined): EstimatedLevel | null {
  const value = (text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (!value) return null;
  for (const [level, pattern] of ESTIMATE_RULES) if (pattern.test(value)) return level;
  return null;
}

export function classifyLanguage(description: string | null | undefined) {
  const text = (description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const evidence: string[] = [];
  const addMatches = (pattern: RegExp) => {
    for (const match of text.matchAll(pattern)) {
      const start = Math.max(0, (match.index ?? 0) - 45);
      evidence.push(clip(text.slice(start, start + 150)));
      if (evidence.length >= 4) break;
    }
  };

  addMatches(/(?:deutsch(?:kenntnisse)?|german).{0,35}\b(?:A1|A2|B1|B2|C1|C2)\b|\b(?:A1|A2|B1|B2|C1|C2)\b.{0,35}(?:deutsch|german)/gi);
  const upper = evidence.join(" ").toUpperCase();
  const cefr = CEFR.find((level) => new RegExp(`\\b${level}\\b`).test(upper)) ?? null;
  const optional = /(?:deutsch|german).{0,45}(?:wünschenswert|von vorteil|nice[- ]to[- ]have|preferred|optional)|(?:wünschenswert|von vorteil|preferred).{0,45}(?:deutsch|german)/i.test(text);
  const englishAccessible = /(?:arbeitssprache|working language|team language).{0,35}(?:englisch|english)|(?:englisch|english).{0,35}(?:ausreichend|only|ohne deutsch|no german)/i.test(text);
  const germanMention = /deutsch(?:kenntnisse)?|german/i.test(text);
  const germanNotRequired = /(?:kein(?:e)?|ohne|no)\s+(?:deutsch(?:kenntnisse)?|german)|(?:deutsch(?:kenntnisse)?|german).{0,20}(?:nicht erforderlich|not required)/i.test(text);
  if (germanMention && evidence.length === 0) addMatches(/.{0,45}(?:deutsch(?:kenntnisse)?|german).{0,75}/gi);

  const classification = cefr ? "cefr" : germanNotRequired || englishAccessible ? "english_accessible" : optional ? "german_optional" : germanMention ? "german_unspecified" : "unknown";
  const estimated = cefr || germanNotRequired ? null : estimateCefr(text);
  return {
    classification,
    cefr_level: cefr,
    estimated_cefr: estimated,
    german_required: cefr ? true : germanNotRequired ? false : germanMention ? !optional : null,
    english_accessible: englishAccessible || germanNotRequired,
    evidence: [...new Set(evidence)],
    extraction_version: EXTRACTION_VERSION,
    analysed_at: new Date().toISOString(),
  };
}

const PAGE = 1000;

async function countRows(admin: Admin, table: string, apply?: (query: any) => any) {
  let query = admin.from(table).select("refnr", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countPendingAnalysis(admin: Admin) {
  const total = await countRows(admin, "jobs");
  const analysed = await countRows(admin, "job_language_analysis");
  return { pending: Math.max(0, total - analysed), analysed, total };
}

/** Paged left-anti-join: page through jobs, subtract refnrs already analysed, until `limit` pending are found. */
async function collectPending(admin: Admin, limit: number) {
  const pending: string[] = [];
  for (const expired of [false, true]) {
    if (pending.length >= limit) break;
    for (let from = 0; pending.length < limit; from += PAGE) {
      const { data, error } = await admin.from("jobs").select("refnr").eq("expired", expired)
        .order("published_from", { ascending: false, nullsFirst: false }).range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const chunk = (data ?? []).map((row: any) => row.refnr as string);
      if (!chunk.length) break;
      // Subtract in small slices: a single .in() with 1000 refnrs exceeds the request URL limit.
      const doneSet = new Set<string>();
      for (let i = 0; i < chunk.length; i += 150) {
        const done = await admin.from("job_language_analysis").select("refnr").in("refnr", chunk.slice(i, i + 150));
        if (done.error) throw new Error(done.error.message);
        for (const row of done.data ?? []) doneSet.add(row.refnr as string);
      }
      for (const refnr of chunk) {
        if (!doneSet.has(refnr)) pending.push(refnr);
        if (pending.length >= limit) break;
      }
      if (chunk.length < PAGE) break;
    }
  }
  return pending;
}

export async function analyseLanguageBatch(admin: Admin, limit = 20) {
  const size = Math.max(1, Math.min(25, Math.floor(limit)));
  const pending = await collectPending(admin, size);
  let processed = 0;
  let unavailable = 0;
  const errors: string[] = [];
  for (const refnr of pending) {
    try {
      // Reuse an already stored description: no need to call the agency again.
      const cached = await admin.from("job_details").select("description").eq("refnr", refnr).maybeSingle();
      if (cached.error) throw new Error(cached.error.message);
      let description: string | null = cached.data?.description ?? null;

      if (description === null) {
        const raw = await jobDetails(refnr);
        description = raw.stellenangebotsBeschreibung ?? null;
        const detailError = await admin.from("job_details").upsert({ refnr, description, raw, fetched_at: new Date().toISOString() }, { onConflict: "refnr" });
        if (detailError.error) throw new Error(detailError.error.message);
        await politeDelay();
      }

      const result = classifyLanguage(description);
      const analysisError = await admin.from("job_language_analysis").upsert({ refnr, ...result }, { onConflict: "refnr" });
      if (analysisError.error) throw new Error(analysisError.error.message);
      processed++;
    } catch (error) {
      if ((error as any)?.notFound) {
        // Posting removed at the agency: record it as permanently handled so it never re-queues.
        const now = new Date().toISOString();
        const detail = await admin.from("job_details").upsert(
          { refnr, description: null, raw: { not_found: true, status: 404, code: "STELLENANGEBOT_NICHT_GEFUNDEN" }, fetched_at: now },
          { onConflict: "refnr" },
        );
        const analysis = await admin.from("job_language_analysis").upsert(
          {
            refnr, classification: "unknown", cefr_level: null, estimated_cefr: null,
            german_required: null, english_accessible: null,
            evidence: ["Arbeitsagentur: Stellenangebot nicht mehr verfügbar (404)"],
            extraction_version: EXTRACTION_VERSION, analysed_at: now,
          },
          { onConflict: "refnr" },
        );
        if (detail.error || analysis.error) errors.push(`${refnr}: ${(detail.error ?? analysis.error)!.message}`);
        else unavailable++;
        await politeDelay();
        continue;
      }
      errors.push(`${refnr}: ${(error as Error).message}`);
      await politeDelay();
    }
  }
  const { pending: remaining } = await countPendingAnalysis(admin);
  return { processed, unavailable, requested: pending.length, remaining, errors: errors.slice(0, 5) };
}

