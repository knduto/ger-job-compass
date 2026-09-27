import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
