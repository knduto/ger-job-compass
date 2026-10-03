import { jobDetails, politeDelay } from "./ba-api.server";

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

async function count(admin: Admin, table: string) {
  const { count: c, error } = await admin.from(table).select("refnr", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return c ?? 0;
}

export async function countPendingVisa(admin: Admin) {
  const total = await count(admin, "jobs");
  const analysed = await count(admin, "job_visa_feasibility");
  return { pending: Math.max(0, total - analysed), analysed, total };
}

async function collectPending(admin: Admin, limit: number) {
  const pending: string[] = [];
  for (const expired of [false, true]) {
    for (let from = 0; pending.length < limit; from += 1000) {
      const { data, error } = await admin.from("jobs").select("refnr").eq("expired", expired)
        .order("published_from", { ascending: false, nullsFirst: false }).range(from, from + 999);
      if (error) throw new Error(error.message);
      const chunk = (data ?? []).map((r: any) => r.refnr as string);
      if (!chunk.length) break;
      const done = new Set<string>();
      for (let i = 0; i < chunk.length; i += 150) {
        const r = await admin.from("job_visa_feasibility").select("refnr").in("refnr", chunk.slice(i, i + 150));
        if (r.error) throw new Error(r.error.message);
        for (const row of r.data ?? []) done.add(row.refnr);
      }
      for (const ref of chunk) { if (!done.has(ref)) pending.push(ref); if (pending.length >= limit) break; }
      if (chunk.length < 1000) break;
    }
    if (pending.length >= limit) break;
  }
  return pending;
}

export async function analyseVisaBatch(admin: Admin, limit = 25) {
  const size = Math.max(1, Math.min(25, Math.floor(limit)));
  const refs = await collectPending(admin, size);
  let processed = 0, unavailable = 0;
  const errors: string[] = [];
  for (const refnr of refs) {
    try {
      const cached = await admin.from("job_details").select("description,raw").eq("refnr", refnr).maybeSingle();
      if (cached.error) throw new Error(cached.error.message);
      if (cached.data?.raw?.not_found) throw Object.assign(new Error("not found"), { notFound: true, cachedOnly: true });
      let description: string | null = cached.data ? cached.data.description ?? null : null;
      if (!cached.data) {
        const raw = await jobDetails(refnr);
        description = raw.stellenangebotsBeschreibung ?? null;
        const up = await admin.from("job_details").upsert({ refnr, description, raw, fetched_at: new Date().toISOString() }, { onConflict: "refnr" });
        if (up.error) throw new Error(up.error.message);
        await politeDelay();
      }
      const res = await admin.from("job_visa_feasibility").upsert({ refnr, ...evaluateVisaFeasibility(description) }, { onConflict: "refnr" });
      if (res.error) throw new Error(res.error.message);
      processed++;
    } catch (error) {
      if ((error as any)?.notFound) {
        const now = new Date().toISOString();
        if (!(error as any).cachedOnly) {
          await admin.from("job_details").upsert({ refnr, description: null, raw: { not_found: true, status: 404, code: "STELLENANGEBOT_NICHT_GEFUNDEN" }, fetched_at: now }, { onConflict: "refnr" });
          await politeDelay();
        }
        const r = await admin.from("job_visa_feasibility").upsert({ refnr, status: "unspecified", flags: ["unavailable"], evidence: [], version: VISA_VERSION, analysed_at: now }, { onConflict: "refnr" });
        if (r.error) errors.push(`${refnr}: ${r.error.message}`); else unavailable++;
        continue;
      }
      errors.push(`${refnr}: ${(error as Error).message}`);
      await politeDelay();
    }
  }
  const { pending } = await countPendingVisa(admin);
  return { requested: refs.length, processed, unavailable, errors: errors.slice(0, 5), pending };
}
