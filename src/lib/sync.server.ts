import { searchJobs, politeDelay } from "./ba-api.server";
import { IT_BERUFSFELDER } from "./it-fields";

const PAGE_SIZE = 100;
const MAX_PAGES = 10; // agency caps deep paging; 1000 per keyword+field is plenty

type Admin = any;

export function normalizeCity(ort?: string | null) {
  if (!ort) return null;
  const c = (ort.split(",")[0] ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  return c || null;
}

function mapJob(j: any, field: string, keyword: string) {
  const loc = (j.stellenlokationen ?? []).find((l: any) => l?.adresse?.land === "DEUTSCHLAND") ?? j.stellenlokationen?.[0];
  const a = loc?.adresse ?? {};
  const parttime = !!(j.arbeitszeitTeilzeitAbend || j.arbeitszeitTeilzeitNachmittag || j.arbeitszeitTeilzeitVormittag || j.arbeitszeitTeilzeitFlexibel);
  return {
    refnr: j.referenznummer as string,
    title: j.stellenangebotsTitel ?? j.titel ?? j.hauptberuf ?? "Ohne Titel",
    employer: j.firma ?? null,
    employer_hash: j.arbeitgeberKundennummerHash ?? null,
    beruf: j.hauptberuf ?? null,
    alle_berufe: j.alleBerufe ?? [],
    berufsfelder: [field],
    keywords: [keyword],
    city: normalizeCity(a.ort),
    city_raw: a.ort ?? null,
    plz: a.plz ?? null,
    region: a.region ?? null,
    country: a.land ?? null,
    lat: loc?.breite ?? null,
    lng: loc?.laenge ?? null,
    published_from: j.veroeffentlichungszeitraum?.von ?? null,
    first_published: j.datumErsteVeroeffentlichung ?? null,
    changed_at: j.aenderungsdatum ?? null,
    entry_from: j.eintrittszeitraum?.von ?? null,
    contract: j.vertragsdauer ?? null,
    fulltime: j.arbeitszeitVollzeit ?? null,
    parttime,
    homeoffice: j.homeofficemoeglich ?? false,
    salary_type: j.verguetungsangabe ?? null,
    salary_from: j.gehaltsspanneVon ?? null,
    salary_to: j.gehaltsspanneBis ?? null,
    external_url: j.externeURL ?? null,
    raw: j,
  };
}

function isGermany(j: any) {
  return (j.stellenlokationen ?? []).some((l: any) => l?.adresse?.land === "DEUTSCHLAND");
}

/** Sync one keyword across all IT professional fields. Returns counters. */
export async function syncKeyword(admin: Admin, keyword: string, runStartedAt: string) {
  const c = { requests: 0, fetched: 0, skipped: 0, new: 0, updated: 0, errors: [] as string[] };
  const collected = new Map<string, ReturnType<typeof mapJob>>();

  for (const field of IT_BERUFSFELDER) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const d = await searchJobs({ was: keyword, berufsfeld: field, angebotsart: 1, page, size: PAGE_SIZE });
        c.requests++;
        const list: any[] = d.ergebnisliste ?? [];
        for (const j of list) {
          if (!j?.referenznummer) continue;
          if (!isGermany(j)) { c.skipped++; continue; }
          const prev = collected.get(j.referenznummer);
          if (prev) { if (!prev.berufsfelder.includes(field)) prev.berufsfelder.push(field); }
          else collected.set(j.referenznummer, mapJob(j, field, keyword));
        }
        await politeDelay();
        if (list.length < PAGE_SIZE || page * PAGE_SIZE >= (d.maxErgebnisse ?? 0)) break;
      } catch (e) {
        c.errors.push(`${keyword} / ${field} / Seite ${page}: ${(e as Error).message}`);
        break;
      }
    }
  }
  c.fetched = collected.size;
  if (collected.size === 0) return c;

  const refs = [...collected.keys()];
  const existing = new Map<string, { berufsfelder: string[]; keywords: string[]; first_seen: string }>();
  for (let i = 0; i < refs.length; i += 300) {
    const { data, error } = await admin.from("jobs").select("refnr, berufsfelder, keywords, first_seen").in("refnr", refs.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) existing.set(r.refnr, r);
  }

  const rows = [...collected.values()].map((r) => {
    const ex = existing.get(r.refnr);
    if (ex) {
      c.updated++;
      return {
        ...r,
        berufsfelder: [...new Set([...ex.berufsfelder, ...r.berufsfelder])],
        keywords: [...new Set([...ex.keywords, ...r.keywords])],
        first_seen: ex.first_seen,
        last_seen: runStartedAt,
        expired: false,
      };
    }
    c.new++;
    return { ...r, first_seen: runStartedAt, last_seen: runStartedAt, expired: false };
  });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "refnr" });
    if (error) throw new Error(error.message);
  }
  return c;
}

export async function startRun(admin: Admin, trigger: string) {
  const { count } = await admin.from("search_keywords").select("id", { count: "exact", head: true }).eq("active", true);
  const { data, error } = await admin.from("sync_runs").insert({ trigger, keywords_total: count ?? 0 }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function recordKeyword(admin: Admin, runId: string, c: Awaited<ReturnType<typeof syncKeyword>>) {
  const { data: run } = await admin.from("sync_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");
  await admin.from("sync_runs").update({
    keywords_done: run.keywords_done + 1,
    requests: run.requests + c.requests,
    fetched: run.fetched + c.fetched,
    skipped_non_de: run.skipped_non_de + c.skipped,
    new_count: run.new_count + c.new,
    updated_count: run.updated_count + c.updated,
    errors: [...(run.errors ?? []), ...c.errors],
  }).eq("id", runId);
}

/** Mark postings not seen for `days` as expired; only after a complete, error-free run. */
export async function finishRun(admin: Admin, runId: string, expireDays = 3) {
  const { data: run } = await admin.from("sync_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");
  let expired = 0;
  const complete = run.keywords_done >= run.keywords_total;
  const clean = (run.errors ?? []).length === 0;
  if (complete && clean) {
    const cutoff = new Date(Date.now() - expireDays * 86400000).toISOString();
    const { data } = await admin.from("jobs").update({ expired: true }).lt("last_seen", cutoff).eq("expired", false).select("refnr");
    expired = data?.length ?? 0;
  }
  const status = !complete ? "incomplete" : clean ? "success" : "partial";
  await admin.from("sync_runs").update({ status, finished_at: new Date().toISOString(), expired_count: expired }).eq("id", runId);
  return { status, expired };
}
