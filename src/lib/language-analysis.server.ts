import { jobDetails, politeDelay } from "./ba-api.server";

type Admin = any;

const CEFR = ["C2", "C1", "B2", "B1", "A2", "A1"] as const;
const clip = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 180);

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
  if (germanMention && evidence.length === 0) addMatches(/.{0,45}(?:deutsch(?:kenntnisse)?|german).{0,75}/gi);

  const classification = cefr ? "cefr" : optional ? "german_optional" : germanMention ? "german_unspecified" : englishAccessible ? "english_accessible" : "unknown";
  return {
    classification,
    cefr_level: cefr,
    german_required: cefr ? true : germanMention ? !optional : null,
    english_accessible: englishAccessible,
    evidence: [...new Set(evidence)],
    extraction_version: 1,
    analysed_at: new Date().toISOString(),
  };
}

export async function analyseLanguageBatch(admin: Admin, limit = 20) {
  const { data: analysed } = await admin.from("job_language_analysis").select("refnr").eq("extraction_version", 1).limit(100000);
  const done = new Set((analysed ?? []).map((row: any) => row.refnr));
  const { data: jobs, error } = await admin.from("jobs").select("refnr").eq("expired", false).order("published_from", { ascending: false, nullsFirst: false }).limit(1000);
  if (error) throw new Error(error.message);
  const pending = (jobs ?? []).filter((job: any) => !done.has(job.refnr)).slice(0, limit);
  let processed = 0;
  const errors: string[] = [];
  for (const job of pending) {
    try {
      const raw = await jobDetails(job.refnr);
      const description = raw.stellenangebotsBeschreibung ?? null;
      const detailError = await admin.from("job_details").upsert({ refnr: job.refnr, description, raw, fetched_at: new Date().toISOString() }, { onConflict: "refnr" });
      if (detailError.error) throw new Error(detailError.error.message);
      const result = classifyLanguage(description);
      const analysisError = await admin.from("job_language_analysis").upsert({ refnr: job.refnr, ...result }, { onConflict: "refnr" });
      if (analysisError.error) throw new Error(analysisError.error.message);
      processed++;
    } catch (error) {
      errors.push(`${job.refnr}: ${(error as Error).message}`);
    }
    await politeDelay();
  }
  return { processed, requested: pending.length, errors: errors.slice(0, 5) };
}