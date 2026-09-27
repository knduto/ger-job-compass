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

/** Sync one keyword (or all IT jobs when keyword is null) across all IT professional fields. Returns counters. */
export async function syncKeyword(admin: Admin, keyword: string | null, runStartedAt: string, loc?: { wo: string; umkreis?: number }, fields = IT_BERUFSFELDER) {
  const c = { requests: 0, fetched: 0, skipped: 0, new: 0, updated: 0, errors: [] as string[] };
  const collected = new Map<string, ReturnType<typeof mapJob>>();
  const label = keyword ?? `stadt:${loc?.wo ?? ""}`;

  for (const field of fields) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const params: Parameters<typeof searchJobs>[0] = { berufsfeld: field, angebotsart: 1, page, size: PAGE_SIZE };
        if (keyword) params.was = keyword;
        if (loc?.wo) { params.wo = loc.wo; if (loc.umkreis) params.umkreis = loc.umkreis; }
        const d = await searchJobs(params);
        c.requests++;
        const list: any[] = d.ergebnisliste ?? [];
        for (const j of list) {
          if (!j?.referenznummer) continue;
          if (!isGermany(j)) { c.skipped++; continue; }
          const prev = collected.get(j.referenznummer);
          if (prev) { if (!prev.berufsfelder.includes(field)) prev.berufsfelder.push(field); }
          else collected.set(j.referenznummer, mapJob(j, field, label));
        }
        await politeDelay();
        if (list.length < PAGE_SIZE || page * PAGE_SIZE >= (d.maxErgebnisse ?? 0)) break;
      } catch (e) {
        c.errors.push(`${label} / ${field} / Seite ${page}: ${(e as Error).message}`);
        break;
      }
    }
  }
  c.fetched = collected.size;
  if (collected.size === 0) return { ...c, refs: [] as string[], newRefs: [] as string[] };

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
  return { ...c, refs, newRefs: rows.filter((row) => !existing.has(row.refnr)).map((row) => row.refnr) };
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

/** Mark postings not seen for `days` as expired; only after a complete, error-free full run (never city runs). */
export async function finishRun(admin: Admin, runId: string, expireDays = 3) {
  const { data: run } = await admin.from("sync_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");
  let expired = 0;
  const complete = run.keywords_done >= run.keywords_total;
  const clean = (run.errors ?? []).length === 0;
  const isFullRun = run.trigger !== "city";
  if (complete && clean && isFullRun) {
    const cutoff = new Date(Date.now() - expireDays * 86400000).toISOString();
    const { data } = await admin.from("jobs").update({ expired: true }).lt("last_seen", cutoff).eq("expired", false).select("refnr");
    expired = data?.length ?? 0;
  }
  const status = !complete ? "incomplete" : clean ? "success" : "partial";
  await admin.from("sync_runs").update({ status, finished_at: new Date().toISOString(), expired_count: expired }).eq("id", runId);
  if (status === "success") await recordMarketSnapshots(admin);
  return { status, expired };
}

async function recordMarketSnapshots(admin: Admin) {
  const jobs: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("jobs").select("refnr,city,employer,expired,first_published,published_from,homeoffice,salary_from").range(from, from + 999);
    if (error) throw new Error(error.message);
    jobs.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  const refs = jobs.map((job) => job.refnr);
  const analyses: any[] = [];
  for (let i = 0; i < refs.length; i += 500) {
    const { data } = await admin.from("job_language_analysis").select("refnr,german_required,english_accessible").in("refnr", refs.slice(i, i + 500));
    analyses.push(...(data ?? []));
  }
  const language = new Map(analyses.map((row) => [row.refnr, row]));
  const groups = new Map<string, any[]>();
  for (const job of jobs) {
    const city = job.city ?? "";
    groups.set(city, [...(groups.get(city) ?? []), job]);
  }
  const date = new Date().toISOString().slice(0, 10);
  const rows = [...groups].map(([city, list]) => {
    const active = list.filter((job) => !job.expired);
    const analysed = active.filter((job) => language.has(job.refnr));
    return { snapshot_date: date, city, active_jobs: active.length, expired_jobs: list.length - active.length,
      new_7d: active.filter((job) => { const published = job.first_published ?? job.published_from; return published && Date.now() - new Date(published).getTime() <= 7 * 86400000; }).length,
      employers: new Set(active.map((job) => job.employer).filter(Boolean)).size,
      salary_pct: active.length ? 100 * active.filter((job) => job.salary_from !== null).length / active.length : 0,
      remote_pct: active.length ? 100 * active.filter((job) => job.homeoffice).length / active.length : 0,
      analysed_jobs: analysed.length, german_required: analysed.filter((job) => language.get(job.refnr)?.german_required).length,
      english_accessible: analysed.filter((job) => language.get(job.refnr)?.english_accessible).length };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("market_snapshots").upsert(rows.slice(i, i + 200), { onConflict: "snapshot_date,city" });
    if (error) throw new Error(error.message);
  }
}
