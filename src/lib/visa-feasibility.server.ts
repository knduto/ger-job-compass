import { analysisBacklog, runAnalysisBatch } from "./analysis-batch.server";

type Admin = any;

export const VISA_VERSION = 1;
export type VisaStatus = "restricted" | "work_permit_required" | "international_friendly" | "unspecified";

type Rule = { flag: string; status: Exclude<VisaStatus, "unspecified">; pattern: RegExp };

// Every rule needs an explicit phrase in the stored description; nothing is inferred.
const RULES: Rule[] = [
  { status: "restricted", flag: "security_clearance", pattern: /sicherheits(?:ü|ue)berpr(?:ü|ue)fung|\bS(?:Ü|UE)G\b|(?<![\p{L}\d])(?:Ü|UE)\s?[1-3](?![\p{L}\d])|security[\s-]+clearance|\bVS-Erm(?:ä|ae)chtigung|NATO[\s-]+secret/giu },
  { status: "restricted", flag: "citizenship_required", pattern: /(?:deutsche|EU-?)\s*(?:Staatsangeh(?:ö|oe)rigkeit|Staatsb(?:ü|ue)rgerschaft)|(?:german|EU)\s+citizenship/giu },
  { status: "restricted", flag: "classified_information", pattern: /verschlusssache|classified\s+information/giu },
  { status: "work_permit_required", flag: "work_permit_required", pattern: /g(?:ü|ue)ltige[rn]?\s+(?:Arbeitserlaubnis|Aufenthaltstitel|Arbeitsgenehmigung|Aufenthalts-\s*und\s*Arbeitserlaubnis)|(?:Arbeitserlaubnis|Aufenthaltstitel|Arbeitsgenehmigung)[^.]{0,40}?(?:erforderlich|vorausgesetzt|vorhanden|notwendig|Voraussetzung)|valid\s+work\s+(?:permit|authori[sz]ation)/giu },
  { status: "work_permit_required", flag: "right_to_work", pattern: /right\s+to\s+work\s+in\s+(?:Germany|the\s+EU)|(?:existing|current)\s+work\s+permit/giu },
  { status: "international_friendly", flag: "visa_support", pattern: /visa[\s-]+(?:support|sponsorship|assistance)|sponsor(?:ing|ship)?\s+(?:of\s+)?(?:your\s+)?(?:a\s+)?visas?|Visum(?:s)?(?:-|\s)?(?:unterst(?:ü|ue)tzung|sponsoring)|Unterst(?:ü|ue)tzung\s+(?:bei|beim)\s+(?:der\s+|dem\s+)?(?:Visum|Visa|Visumsantrag|Arbeitserlaubnis|Aufenthaltstitel)/giu },
  { status: "international_friendly", flag: "relocation_support", pattern: /relocation|Umzugs(?:unterst(?:ü|ue)tzung|hilfe|kosten(?:zuschuss|übernahme)?)/giu },
  { status: "international_friendly", flag: "blue_card_support", pattern: /(?:Blaue[n]?\s+Karte|Blue\s+Card)/giu },
  { status: "international_friendly", flag: "international_welcome", pattern: /international(?:e)?\s+(?:applicants|candidates|Bewerber(?:innen)?|Bewerbungen)\s+(?:are\s+)?(?:welcome|willkommen)/giu },
];

const NEG_BEFORE = /(?:\b(?:kein(?:e|en|er)?|nicht|ohne|no|not|without|cannot|can't|unable\s+to)\b|nicht\s+möglich)[^.]{0,30}$/iu;
const NEG_AFTER = /^[^.]{0,30}(?:nicht\s+(?:erforderlich|notwendig|nötig|vorausgesetzt|möglich|angeboten)|not\s+(?:required|needed|necessary|offered|possible|provided)|entfällt)/iu;

const PRECEDENCE: VisaStatus[] = ["restricted", "work_permit_required", "international_friendly"];
const clean = (s: string | null | undefined) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 180);

export function evaluateVisaFeasibility(description: string | null | undefined) {
  const text = clean(description);
  const flags = new Set<string>();
  const hits: { status: VisaStatus; excerpt: string }[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const idx = m.index ?? 0;
      const before = text.slice(Math.max(0, idx - 45), idx);
      const after = text.slice(idx + m[0].length, idx + m[0].length + 45);
      if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) continue;
      flags.add(rule.flag);
      const start = Math.max(0, idx - 60);
      hits.push({ status: rule.status, excerpt: clip(text.slice(start, idx + m[0].length + 90)) });
    }
  }
  const status: VisaStatus = PRECEDENCE.find((s) => hits.some((h) => h.status === s)) ?? "unspecified";
  // Evidence: decisive status first, then the rest, max 4 distinct excerpts.
  const ordered = [...hits.filter((h) => h.status === status), ...hits.filter((h) => h.status !== status)];
  const evidence = [...new Set(ordered.map((h) => h.excerpt))].slice(0, 4);
  return { status, flags: [...flags], evidence, version: VISA_VERSION, analysed_at: new Date().toISOString() };
}

export function countPendingVisa(admin: Admin) {
  return analysisBacklog(admin, "visa");
}

export function analyseVisaBatch(admin: Admin, limit = 10) {
  return runAnalysisBatch(admin, "visa", {
    limit,
    save: async (refnr, description) => {
      const res = await admin.from("job_visa_feasibility").upsert({ refnr, ...evaluateVisaFeasibility(description) }, { onConflict: "refnr" });
      if (res.error) throw new Error(res.error.message);
    },
    saveUnavailable: async (refnr, now) => {
      const res = await admin.from("job_visa_feasibility").upsert(
        { refnr, status: "unspecified", flags: ["unavailable"], evidence: [], version: VISA_VERSION, analysed_at: now },
        { onConflict: "refnr" },
      );
      if (res.error) throw new Error(res.error.message);
    },
  });
}
