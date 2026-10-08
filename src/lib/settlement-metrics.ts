// Pure, deterministic settlement computations. Rent inputs come only from user-entered,
// source-cited benchmarks; job counts come from stored Arbeitsagentur listings.

export type Benchmark = {
  id: string; city: string; rent_cold_sqm: number; utilities_sqm: number | null;
  market_tightness: string; source_name: string; source_url: string | null; source_year: number; notes: string | null;
};

export const TIGHTNESS: Record<string, string> = {
  unspecified: "Keine Angabe", relaxed: "Entspannt", moderate: "Moderat", tight: "Angespannt", very_tight: "Sehr angespannt",
};

/** Legal maximum Mietkaution in Germany: 3 net cold monthly rents (§ 551 BGB). */
export const KAUTION_MONTHS = 3;

export type SettlementRow = {
  city: string; activeJobs: number; b: Benchmark | null;
  cold: number | null; warm: number | null; kaution: number | null; upfront: number | null;
  residual: number | null; rentShare: number | null; jobsPer100: number | null;
};

export function buildSettlementRows(
  cities: string[], jobsByCity: Record<string, number>, benchmarks: Benchmark[], sqm: number, budget: number,
): SettlementRow[] {
  const bm = new Map(benchmarks.map((b) => [b.city, b]));
  return cities.map((city) => {
    const b = bm.get(city) ?? null;
    const activeJobs = jobsByCity[city] ?? 0;
    if (!b) return { city, activeJobs, b, cold: null, warm: null, kaution: null, upfront: null, residual: null, rentShare: null, jobsPer100: null };
    const cold = Number(b.rent_cold_sqm) * sqm;
    // Warm rent only when utilities are sourced; never guessed.
    const warm = b.utilities_sqm == null ? null : cold + Number(b.utilities_sqm) * sqm;
    const kaution = cold * KAUTION_MONTHS;
    const monthly = warm ?? cold;
    return {
      city, activeJobs, b, cold, warm, kaution,
      upfront: kaution + monthly,
      residual: budget > 0 ? budget - monthly : null,
      rentShare: budget > 0 ? (monthly / budget) * 100 : null,
      jobsPer100: monthly > 0 ? (activeJobs / monthly) * 100 : null,
    };
  }).sort((a, z) => (a.upfront ?? Infinity) - (z.upfront ?? Infinity));
}
