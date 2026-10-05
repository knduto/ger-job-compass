import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Counts = { analysed: number; hit: number };

async function paged<T>(build: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await build(from);
    if (r.error) throw new Error(r.error.message);
    out.push(...(r.data ?? []));
    if ((r.data?.length ?? 0) < 1000) break;
  }
  return out;
}

/** Aggregates stored database data only (no Arbeitsagentur calls) for the advisor page. */
export const getAdvisorData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [cityStats, share, tracked, lang, visa, lastRun, activeCount] = await Promise.all([
      db.from("city_stats").select("*").order("active_jobs", { ascending: false }).limit(1000),
      db.from("city_employer_share").select("city,top_employer_pct").limit(5000),
      db.from("tracked_cities").select("city"),
      paged<any>((f) => db.from("job_language_analysis").select("english_accessible,german_required,jobs!inner(city,expired)").eq("jobs.expired", false).range(f, f + 999)),
      paged<any>((f) => db.from("job_visa_feasibility").select("status,flags,jobs!inner(city,expired)").eq("jobs.expired", false).range(f, f + 999)),
      db.from("sync_runs").select("finished_at,status").eq("status", "success").order("finished_at", { ascending: false }).limit(1),
      db.from("jobs").select("refnr", { count: "exact", head: true }).eq("expired", false),
    ]);
    for (const r of [cityStats, share, tracked, lastRun, activeCount]) if (r.error) throw new Error(r.error.message);

    const langBy: Record<string, Counts> = {};
    for (const row of lang) {
      const c = row.jobs?.city; if (!c) continue;
      const e = (langBy[c] ??= { analysed: 0, hit: 0 });
      e.analysed++; if (row.english_accessible === true) e.hit++;
    }
    const visaBy: Record<string, Counts> = {};
    for (const row of visa) {
      const c = row.jobs?.city; if (!c) continue;
      if ((row.flags ?? []).includes("unavailable")) continue; // no description → no evidence
      const e = (visaBy[c] ??= { analysed: 0, hit: 0 });
      e.analysed++; if (row.status === "international_friendly") e.hit++;
    }
    return {
      cityStats: cityStats.data ?? [],
      share: share.data ?? [],
      tracked: (tracked.data ?? []).map((t: any) => t.city as string),
      activeJobs: (activeCount.count ?? 0) as number,
      langBy, visaBy,
      langAnalysedTotal: lang.length, visaAnalysedTotal: visa.length,
      lastSync: lastRun.data?.[0]?.finished_at ?? null,
      generatedAt: new Date().toISOString(),
    };
  });

export type AdvisorData = Awaited<ReturnType<typeof getAdvisorData>>;
