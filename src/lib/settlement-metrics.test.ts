import { describe, expect, it } from "vitest";
import { buildSettlementRows, kaution, runwayMonths, upfrontCapital, warmRent, type Benchmark } from "./settlement-metrics";

const b = (o: Partial<Benchmark> = {}): Benchmark => ({
  id: "1", city: "Leipzig", rent_cold_sqm: 10, utilities_sqm: 3, market_tightness: "moderate",
  source_name: "Mietspiegel", source_url: null, source_year: 2025, notes: null, ...o,
});
const off = { enabled: false, sqm: null, source: null, year: null };
const sim = { sqm: 40, savings: 10000, income: 0, otherCosts: 600, budget: 1100 };

describe("settlement metrics", () => {
  it("Kaution is 3 × Kaltmiete", () => expect(kaution(400)).toBe(1200));
  it("Warmmiete = Kalt + Nebenkosten × m²", () => expect(warmRent(10, 3, 40)).toBe(520));
  it("missing utilities → warm null", () => expect(warmRent(10, null, 40)).toBeNull());
  it("Startkapital = Kaution + erste Warmmiete", () => expect(upfrontCapital(400, 520)).toBe(1720));
  it("runway = (savings − upfront) / (burn − income)", () => {
    expect(runwayMonths(10000, 1720, 1120, 0)).toBeCloseTo(7.392857, 5);
    expect(runwayMonths(10000, 1720, 1120, 500)).toBeCloseTo(13.354839, 5);
    expect(runwayMonths(1000, 1720, 1120, 0)).toBe(0);
    expect(runwayMonths(10000, 1720, 1120, 1200)).toBe(Infinity);
    expect(runwayMonths(10000, null, null, 0)).toBeNull();
  });
  it("row without utilities shows warm/runway as missing", () => {
    const r = buildSettlementRows(["Leipzig"], { Leipzig: 50 }, [b({ utilities_sqm: null })], sim, off)[0]!;
    expect(r.warm).toBeNull(); expect(r.runway).toBeNull(); expect(r.jobsPer100).toBeNull(); expect(r.kaution).toBe(1200);
  });
  it("national fallback applies only when enabled with source", () => {
    const nat = { enabled: true, sqm: 2.5, source: "DMB Betriebskostenspiegel", year: 2024 };
    const r = buildSettlementRows(["Leipzig"], { Leipzig: 52 }, [b({ utilities_sqm: null })], sim, nat)[0]!;
    expect(r.warm).toBe(500); expect(r.utilitiesFallback).toBe(true); expect(r.jobsPer100).toBeCloseTo(10.4, 5);
    const r2 = buildSettlementRows(["Leipzig"], {}, [b({ utilities_sqm: null })], sim, { ...nat, source: null })[0]!;
    expect(r2.warm).toBeNull();
  });
});
