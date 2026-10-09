import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stored-database data only: tracked cities, active IT job counts and the user's cited rent benchmarks. */
export const getSettlementData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [stats, tracked, bench, settings] = await Promise.all([
      db.from("city_stats").select("city,active_jobs").order("active_jobs", { ascending: false }).limit(1000),
      db.from("tracked_cities").select("city"),
      db.from("city_housing_benchmarks").select("*").order("city"),
      db.from("user_settlement_settings").select("*").maybeSingle(),
    ]);
    for (const r of [stats, tracked, bench, settings]) if (r.error) throw new Error(r.error.message);
    const jobsByCity: Record<string, number> = {};
    for (const s of stats.data ?? []) if (s.city) jobsByCity[s.city] = Number(s.active_jobs ?? 0);
    const trackedCities = (tracked.data ?? []).map((t: any) => t.city as string);
    const cities = trackedCities.length ? trackedCities : (stats.data ?? []).slice(0, 30).map((s: any) => s.city as string).filter(Boolean);
    const s = settings.data as any;
    const national = { enabled: !!s?.use_national_utilities, sqm: s?.national_utilities_sqm == null ? null : Number(s.national_utilities_sqm), source: (s?.national_utilities_source as string | null) ?? null, year: (s?.national_utilities_year as number | null) ?? null };
    return { cities, usingTracked: trackedCities.length > 0, jobsByCity, benchmarks: bench.data ?? [], national, generatedAt: new Date().toISOString() };
  });

export type SettlementData = Awaited<ReturnType<typeof getSettlementData>>;
