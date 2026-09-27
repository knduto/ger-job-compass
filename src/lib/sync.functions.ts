import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IT_BERUFSFELDER } from "./it-fields";

export const startSyncRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { startRun } = await import("./sync.server");
    const run = await startRun(supabaseAdmin, "manual");
    const { data: kws } = await supabaseAdmin.from("search_keywords").select("term").eq("active", true).order("term");
    return { runId: run.id as string, startedAt: run.started_at as string, keywords: (kws ?? []).map((k) => k.term) };
  });

export const syncOneKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().uuid(), startedAt: z.string(), keyword: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncKeyword, recordKeyword } = await import("./sync.server");
    const c = await syncKeyword(supabaseAdmin, data.keyword, data.startedAt);
    await recordKeyword(supabaseAdmin, data.runId, c);
    return { fetched: c.fetched, new: c.new, updated: c.updated, errors: c.errors };
  });

export const finishSyncRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { finishRun } = await import("./sync.server");
    return finishRun(supabaseAdmin, data.runId);
  });

/** On-demand fetch for one city: either all IT jobs there, or the active keywords limited to that city. */
// City fetch is split into start / step / finish so each server call stays short
// (a single call looping over all keywords exceeds the request time limit).
export const startCityRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mode: z.enum(["all", "keywords"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let keywords: (string | null)[];
    if (data.mode === "all") {
      keywords = [null];
    } else {
      const { data: kws } = await supabaseAdmin.from("search_keywords").select("term").eq("active", true).order("term");
      keywords = (kws ?? []).map((k) => k.term as string);
      if (!keywords.length) throw new Error("Keine aktiven Suchbegriffe.");
    }
    const steps = keywords.flatMap((keyword) => IT_BERUFSFELDER.map((field) => ({ keyword, field })));
    const { data: run, error } = await supabaseAdmin.from("sync_runs").insert({ trigger: "city", keywords_total: steps.length }).select().single();
    if (error) throw new Error(error.message);
    return { runId: run.id as string, steps, startedAt: new Date().toISOString() };
  });

export const cityRunStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    runId: z.string().uuid(),
    keyword: z.string().max(120).nullable(),
    field: z.string().min(1).max(120),
    city: z.string().trim().min(2).max(80),
    radiusKm: z.number().int().min(0).max(200),
    startedAt: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncKeyword, recordKeyword } = await import("./sync.server");
    const loc: { wo: string; umkreis?: number } = data.radiusKm ? { wo: data.city, umkreis: data.radiusKm } : { wo: data.city };
    if (!(IT_BERUFSFELDER as readonly string[]).includes(data.field)) {
      return { fetched: 0, new: 0, updated: 0, refs: [] as string[], newRefs: [] as string[], errors: ["Ungültiges Berufsfeld."] };
    }
    try {
      const c = await syncKeyword(supabaseAdmin, data.keyword, data.startedAt, loc, [data.field]);
      await recordKeyword(supabaseAdmin, data.runId, c);
      return { fetched: c.fetched, new: c.new, updated: c.updated, refs: c.refs, newRefs: c.newRefs, errors: c.errors };
    } catch (e) {
      return { fetched: 0, new: 0, updated: 0, refs: [] as string[], newRefs: [] as string[], errors: [`${data.keyword ?? data.city} / ${data.field}: ${(e as Error).message}`] };
    }
  });

export const finishCityRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    runId: z.string().uuid(),
    fetched: z.number().int().nonnegative(),
    newCount: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run, error: readError } = await supabaseAdmin.from("sync_runs").select("keywords_done,keywords_total,errors").eq("id", data.runId).single();
    if (readError || !run) throw new Error(readError?.message ?? "Abruf nicht gefunden");
    const complete = run.keywords_done >= run.keywords_total;
    const errors = Array.isArray(run.errors) ? run.errors : [];
    const status = !complete ? "incomplete" : errors.length ? "partial" : "success";
    const { error } = await supabaseAdmin.from("sync_runs").update({
      status,
      finished_at: new Date().toISOString(),
      fetched: data.fetched,
      new_count: data.newCount,
      updated_count: data.updated,
    }).eq("id", data.runId);
    if (error) throw new Error(error.message);
    return { status };
  });

export const loadJobDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ refnr: z.string().min(3).max(120), refresh: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cached } = await context.supabase.from("job_details").select("*").eq("refnr", data.refnr).maybeSingle();
    if (cached && !data.refresh) return { description: cached.description, raw: cached.raw as any, fetched_at: cached.fetched_at, error: null as string | null };
    try {
      const { jobDetails } = await import("./ba-api.server");
      const raw = await jobDetails(data.refnr);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const row = { refnr: data.refnr, description: raw.stellenangebotsBeschreibung ?? null, raw, fetched_at: new Date().toISOString() };
      await supabaseAdmin.from("job_details").upsert(row, { onConflict: "refnr" });
      const { classifyLanguage } = await import("./language-analysis.server");
      await supabaseAdmin.from("job_language_analysis").upsert({ refnr: data.refnr, ...classifyLanguage(row.description) }, { onConflict: "refnr" });
      return { description: row.description, raw, fetched_at: row.fetched_at, error: null };
    } catch (e) {
      console.error("detail fetch failed", e);
      if (cached) return { description: cached.description, raw: cached.raw as any, fetched_at: cached.fetched_at, error: "Aktualisierung fehlgeschlagen – zeige gespeicherte Version." };
      return { description: null, raw: null, fetched_at: null, error: "Details konnten nicht geladen werden (Anzeige evtl. nicht mehr online)." };
    }
  });
