// Pure, deterministic settlement computations. Rent inputs come only from user-entered,
// source-cited benchmarks; job counts come from stored Arbeitsagentur listings.
// Warmmiete is the primary metric; missing utilities never get estimated.

export type Benchmark = {
  id: string; city: string; rent_cold_sqm: number; utilities_sqm: number | null;
  utilities_source_name?: string | null; utilities_source_year?: number | null;
  furnished_warm_month?: number | null; furnished_source_name?: string | null; furnished_source_year?: number | null;
  market_tightness: string; source_name: string; source_url: string | null; source_year: number; notes: string | null;
};

/** Opt-in, user-cited national utilities value (e.g. DMB Betriebskostenspiegel). */
export type NationalUtilities = { enabled: boolean; sqm: number | null; source: string | null; year: number | null };

export const TIGHTNESS: Record<string, string> = {
  unspecified: "Keine Angabe", relaxed: "Entspannt", moderate: "Moderat", tight: "Angespannt", very_tight: "Sehr angespannt",
};

/** Legal maximum Mietkaution in Germany: 3 net cold monthly rents (§ 551 BGB). */
export const KAUTION_MONTHS = 3;

export const coldRent = (coldSqm: number, sqm: number) => coldSqm * sqm;
export const warmRent = (coldSqm: number, utilitiesSqm: number | null, sqm: number): number | null =>
  utilitiesSqm == null ? null : (coldSqm + utilitiesSqm) * sqm;
export const kaution = (cold: number) => cold * KAUTION_MONTHS;
/** Startkapital = Kaution + erste Warmmiete; null when warm rent is missing. */
export const upfrontCapital = (cold: number, warm: number | null) => (warm == null ? null : kaution(cold) + warm);
export const monthlyBurn = (warm: number | null, otherCosts: number) => (warm == null ? null : warm + otherCosts);

/**
 * Runway in months = (savings − upfront) / max(burn − income, 0).
 * Infinity when income covers the burn; 0 when savings cannot cover the upfront capital; null when inputs are missing.
 */
export function runwayMonths(savings: number, upfront: number | null, burn: number | null, income: number): number | null {
  if (upfront == null || burn == null) return null;
  const left = savings - upfront;
  if (left <= 0) return 0;
  const net = burn - income;
  if (net <= 0) return Infinity;
  return left / net;
}

/** Resolve utilities €/m²: city-sourced value first, otherwise the explicit national fallback, otherwise null. */
export function resolveUtilities(b: Benchmark, nat: NationalUtilities): { sqm: number | null; fallback: boolean } {
  if (b.utilities_sqm != null) return { sqm: Number(b.utilities_sqm), fallback: false };
  if (nat.enabled && nat.sqm != null && nat.source && nat.year) return { sqm: Number(nat.sqm), fallback: true };
  return { sqm: null, fallback: false };
}

export type SimInput = { sqm: number; savings: number; income: number; otherCosts: number; budget: number };

export type SettlementRow = {
  city: string; activeJobs: number; b: Benchmark | null;
  utilitiesSqm: number | null; utilitiesFallback: boolean;
  cold: number | null; warm: number | null; furnished: number | null; kaution: number | null; upfront: number | null;
  burn: number | null; runway: number | null; residual: number | null; rentShare: number | null; jobsPer100: number | null;
};

export type SortKey = "runway" | "warm" | "jobsPer100" | "jobs";

export function buildSettlementRows(
  cities: string[], jobsByCity: Record<string, number>, benchmarks: Benchmark[], sim: SimInput, nat: NationalUtilities,
): SettlementRow[] {
  const bm = new Map(benchmarks.map((b) => [b.city, b]));
  return cities.map((city) => {
    const b = bm.get(city) ?? null;
    const activeJobs = jobsByCity[city] ?? 0;
    const empty = { city, activeJobs, b, utilitiesSqm: null, utilitiesFallback: false, cold: null, warm: null, furnished: null, kaution: null, upfront: null, burn: null, runway: null, residual: null, rentShare: null, jobsPer100: null };
    if (!b) return empty;
    const u = resolveUtilities(b, nat);
    const cold = coldRent(Number(b.rent_cold_sqm), sim.sqm);
    const warm = warmRent(Number(b.rent_cold_sqm), u.sqm, sim.sqm);
    const upfront = upfrontCapital(cold, warm);
    const burn = monthlyBurn(warm, sim.otherCosts);
    return {
      ...empty, utilitiesSqm: u.sqm, utilitiesFallback: u.fallback, cold, warm,
      furnished: b.furnished_warm_month == null ? null : Number(b.furnished_warm_month),
      kaution: kaution(cold), upfront, burn,
      runway: runwayMonths(sim.savings, upfront, burn, sim.income),
      residual: warm != null && sim.budget > 0 ? sim.budget - warm : null,
      rentShare: warm != null && sim.budget > 0 ? (warm / sim.budget) * 100 : null,
      jobsPer100: warm != null && warm > 0 ? (activeJobs / warm) * 100 : null,
    };
  });
}

export function sortRows(rows: SettlementRow[], key: SortKey): SettlementRow[] {
  const v = (r: SettlementRow): number | null =>
    key === "runway" ? r.runway : key === "warm" ? r.warm : key === "jobsPer100" ? r.jobsPer100 : r.activeJobs;
  const asc = key === "warm";
  return [...rows].sort((a, z) => {
    const x = v(a), y = v(z);
    if (x == null && y == null) return a.city.localeCompare(z.city);
    if (x == null) return 1;
    if (y == null) return -1;
    return asc ? x - y : y - x;
  });
}
