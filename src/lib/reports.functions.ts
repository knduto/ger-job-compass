import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filtersSchema = z.object({
  city: z.string().max(120).default(""), region: z.string().max(120).default(""), field: z.string().max(200).default(""),
  keyword: z.string().max(120).default(""), status: z.enum(["active", "expired", "all"]).default("active"),
  days: z.number().int().min(0).max(3650).default(0), contract: z.string().max(80).default(""), worktime: z.enum(["", "full", "part"]).default(""),
  homeoffice: z.boolean().default(false), salary: z.boolean().default(false), language: z.string().max(40).default(""),
});

export type ReportFilters = z.infer<typeof filtersSchema>;

export const getReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => filtersSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      let query = context.supabase.from("jobs").select("refnr,title,employer,city,region,beruf,berufsfelder,keywords,contract,fulltime,parttime,homeoffice,salary_type,salary_from,salary_to,published_from,first_seen,last_seen,expired");
      if (data.status !== "all") query = query.eq("expired", data.status === "expired");
      if (data.city) query = query.eq("city", data.city);
      if (data.region) query = query.eq("region", data.region);
      if (data.field) query = query.contains("berufsfelder", [data.field]);
      if (data.keyword) query = query.contains("keywords", [data.keyword]);
      if (data.contract) query = query.eq("contract", data.contract);
      if (data.worktime === "full") query = query.eq("fulltime", true);
      if (data.worktime === "part") query = query.eq("parttime", true);
      if (data.homeoffice) query = query.eq("homeoffice", true);
      if (data.salary) query = query.not("salary_from", "is", null);
      if (data.days) query = query.gte("published_from", new Date(Date.now() - data.days * 86400000).toISOString().slice(0, 10));
      const result = await query.range(from, from + 999);
      if (result.error) throw new Error(result.error.message);
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    const refs = rows.map((row) => row.refnr);
    const analyses: any[] = [];
    for (let i = 0; i < refs.length; i += 500) {
      const result = await context.supabase.from("job_language_analysis").select("*").in("refnr", refs.slice(i, i + 500));
      if (result.error) throw new Error(result.error.message);
      analyses.push(...(result.data ?? []));
    }
    const analysisMap = new Map(analyses.map((item) => [item.refnr, item]));
    const joined = rows.map((row) => ({ ...row, language: analysisMap.get(row.refnr) ?? null }));
    const matchLanguage = (row: any) => {
      const lang = row.language;
      const key = data.language;
      if (key === "pending") return !lang;
      if (key === "required") return lang?.german_required === true;
      if (key === "english") return lang?.english_accessible === true;
      if (key === "unclear") return lang?.german_required === true && !lang?.cefr_level && !lang?.estimated_cefr;
      if (key.startsWith("est:")) return lang?.estimated_cefr === key.slice(4);
      return lang?.cefr_level === key;
    };
    const filtered = data.language ? joined.filter(matchLanguage) : joined;
    const snapshotResult = await context.supabase.from("market_snapshots").select("*").order("snapshot_date", { ascending: true }).limit(1000);
    if (snapshotResult.error) throw new Error(snapshotResult.error.message);
    return { rows: filtered, snapshots: snapshotResult.data ?? [], generatedAt: new Date().toISOString() };
  });

const batchInput = z.object({ limit: z.number().int().min(1).max(25).default(10) });

export const processLanguageBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => batchInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyseLanguageBatch } = await import("./language-analysis.server");
    return analyseLanguageBatch(supabaseAdmin, data.limit);
  });

export const getLanguageAnalysisStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countPendingAnalysis } = await import("./language-analysis.server");
    return countPendingAnalysis(supabaseAdmin);
  });

export const runVisaBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => batchInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyseVisaBatch } = await import("./visa-feasibility.server");
    return analyseVisaBatch(supabaseAdmin, data.limit);
  });

export const visaPendingCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countPendingVisa } = await import("./visa-feasibility.server");
    return countPendingVisa(supabaseAdmin);
  });

export const runTechBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => batchInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyseTechBatch } = await import("./tech-stack.server");
    return analyseTechBatch(supabaseAdmin, data.limit);
  });

export const techPendingCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countPendingTech } = await import("./tech-stack.server");
    return countPendingTech(supabaseAdmin);
  });
