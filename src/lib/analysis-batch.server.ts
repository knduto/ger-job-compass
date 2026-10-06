import { jobDetails, politeDelay } from "./ba-api.server";

type Admin = any;
export type AnalysisKind = "language" | "visa" | "tech";

/** Hard per-request processing budget; stays well below hosting limits. */
export const BATCH_BUDGET_MS = 18_000;
/** Single agency detail call timeout (one retry on 429/5xx). */
const DETAIL_TIMEOUT_MS = 7_000;

export type Backlog = { total: number; analysed: number; pending: number };

export async function analysisBacklog(admin: Admin, kind: AnalysisKind): Promise<Backlog> {
  const { data, error } = await admin.rpc("analysis_backlog", { p_kind: kind });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) ?? { total: 0, analysed: 0, pending: 0 };
  return { total: Number(row.total) || 0, analysed: Number(row.analysed) || 0, pending: Number(row.pending) || 0 };
}

async function pendingRefs(admin: Admin, kind: AnalysisKind, limit: number): Promise<string[]> {
  const { data, error } = await admin.rpc("pending_analysis_refs", { p_kind: kind, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => (typeof r === "string" ? r : r.pending_analysis_refs ?? r.refnr) as string).filter(Boolean);
}

type Cached = { description: string | null; notFound: boolean };

async function cachedDetails(admin: Admin, refs: string[]) {
  const map = new Map<string, Cached>();
  if (!refs.length) return map;
  const { data, error } = await admin.from("job_details").select("refnr,description,raw").in("refnr", refs);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) map.set(row.refnr, { description: row.description ?? null, notFound: Boolean(row.raw?.not_found) });
  return map;
}

export type BatchResult = Backlog & {
  requested: number;
  processed: number;
  unavailable: number;
  timedOut: boolean;
  errors: string[];
};

type Options = {
  limit: number;
  /** Upsert the analysis for a description; throw on failure. */
  save: (refnr: string, description: string | null) => Promise<void>;
  /** Record a posting removed at the agency so it never re-queues; throw on failure. */
  saveUnavailable: (refnr: string, now: string) => Promise<void>;
};

/**
 * Processes up to `limit` pending jobs inside a fixed time budget.
 * Reuses stored descriptions; only uncached jobs hit the agency, one at a time.
 */
export async function runAnalysisBatch(admin: Admin, kind: AnalysisKind, opts: Options): Promise<BatchResult> {
  const started = Date.now();
  const size = Math.max(1, Math.min(25, Math.floor(opts.limit)));
  const refs = await pendingRefs(admin, kind, size);
  const cache = await cachedDetails(admin, refs);
  let processed = 0, unavailable = 0, timedOut = false;
  const errors: string[] = [];

  for (const refnr of refs) {
    if (Date.now() - started > BATCH_BUDGET_MS) { timedOut = true; break; }
    const now = new Date().toISOString();
    try {
      const cached = cache.get(refnr);
      if (cached?.notFound) { await opts.saveUnavailable(refnr, now); unavailable++; continue; }
      if (cached) { await opts.save(refnr, cached.description); processed++; continue; }

      let raw: any;
      try {
        raw = await jobDetails(refnr, { timeoutMs: DETAIL_TIMEOUT_MS, retries: 1 });
      } catch (error) {
        if ((error as any)?.notFound) {
          const d = await admin.from("job_details").upsert(
            { refnr, description: null, raw: { not_found: true, status: 404, code: "STELLENANGEBOT_NICHT_GEFUNDEN" }, fetched_at: now },
            { onConflict: "refnr" },
          );
          if (d.error) throw new Error(d.error.message);
          await opts.saveUnavailable(refnr, now);
          unavailable++;
          await politeDelay();
          continue;
        }
        throw error;
      }
      const description = raw?.stellenangebotsBeschreibung ?? null;
      const up = await admin.from("job_details").upsert({ refnr, description, raw, fetched_at: now }, { onConflict: "refnr" });
      if (up.error) throw new Error(up.error.message);
      await opts.save(refnr, description);
      processed++;
      await politeDelay();
    } catch (error) {
      errors.push(`${refnr}: ${(error as Error).message}`);
      await politeDelay();
    }
  }

  const backlog = await analysisBacklog(admin, kind);
  return { requested: refs.length, processed, unavailable, timedOut, errors: errors.slice(0, 5), ...backlog };
}
