import { analysisBacklog, runAnalysisBatch } from "./analysis-batch.server";

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

export function countPendingAnalysis(admin: Admin) {
  return analysisBacklog(admin, "language");
}

export function analyseLanguageBatch(admin: Admin, limit = 10) {
  return runAnalysisBatch(admin, "language", {
    limit,
    save: async (refnr, description) => {
      const res = await admin.from("job_language_analysis").upsert({ refnr, ...classifyLanguage(description) }, { onConflict: "refnr" });
      if (res.error) throw new Error(res.error.message);
    },
    // Posting removed at the agency: record it as permanently handled so it never re-queues.
    saveUnavailable: async (refnr, now) => {
      const res = await admin.from("job_language_analysis").upsert(
        {
          refnr, classification: "unknown", cefr_level: null, estimated_cefr: null,
          german_required: null, english_accessible: null,
          evidence: ["Arbeitsagentur: Stellenangebot nicht mehr verfügbar (404)"],
          extraction_version: EXTRACTION_VERSION, analysed_at: now,
        },
        { onConflict: "refnr" },
      );
      if (res.error) throw new Error(res.error.message);
    },
  });
}

