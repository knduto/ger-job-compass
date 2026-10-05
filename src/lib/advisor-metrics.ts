// Pure, deterministic advisor computations over stored database aggregates.
export type FactorKey = "volume" | "english" | "visa" | "diversity" | "momentum";

export const FACTORS: { key: FactorKey; label: string; hint: string }[] = [
  { key: "volume", label: "IT-Volumen", hint: "Aktive IT-Stellen in der Stadt (log-skaliert)." },
  { key: "english", label: "Englisch zugänglich", hint: "Anteil englisch zugänglicher unter den sprachlich analysierten aktiven Stellen." },
  { key: "visa", label: "Visa-freundlich", hint: "Anteil 'International offen' unter den visa-analysierten aktiven Stellen." },
  { key: "diversity", label: "Arbeitgebervielfalt", hint: "100 % minus Anteil des größten Arbeitgebers an den aktiven Stellen." },
  { key: "momentum", label: "Dynamik", hint: "Anteil der aktiven Stellen, die in den letzten 30 Tagen neu veröffentlicht wurden." },
];

export const DEFAULT_WEIGHTS: Record<FactorKey, number> = { volume: 30, english: 25, visa: 15, diversity: 15, momentum: 15 };
export const MIN_SAMPLE = 20; // below this, shares are flagged as low-evidence

export type CityRow = {
  city: string; active: number; employers: number; new30: number; new7: number;
  englishPct: number | null; englishN: number; visaPct: number | null; visaN: number;
  topEmployerPct: number | null; diversityPct: number | null; momentumPct: number | null;
  raw: Record<FactorKey, number | null>; norm: Record<FactorKey, number>; contrib: Record<FactorKey, number>; score: number;
};

const pct = (hit: number, n: number) => (n > 0 ? (hit / n) * 100 : null);

export function buildCityRows(
  stats: any[], share: any[], langBy: Record<string, { analysed: number; hit: number }>, visaBy: Record<string, { analysed: number; hit: number }>,
  cities: string[], weights: Record<FactorKey, number>,
): CityRow[] {
  const shareMap = new Map(share.map((s) => [s.city, Number(s.top_employer_pct)]));
  const statMap = new Map(stats.map((s) => [s.city, s]));
  const base = cities.map((city) => {
    const s = statMap.get(city) ?? {};
    const active = Number(s.active_jobs ?? 0);
    const l = langBy[city] ?? { analysed: 0, hit: 0 };
    const v = visaBy[city] ?? { analysed: 0, hit: 0 };
    const top = shareMap.has(city) ? shareMap.get(city)! : null;
    const englishPct = pct(l.hit, l.analysed), visaPct = pct(v.hit, v.analysed);
    const diversityPct = top == null ? null : Math.max(0, 100 - top);
    const momentumPct = active > 0 ? Math.min(100, (Number(s.new_30d ?? 0) / active) * 100) : null;
    return {
      city, active, employers: Number(s.employers ?? 0), new30: Number(s.new_30d ?? 0), new7: Number(s.new_7d ?? 0),
      englishPct, englishN: l.analysed, visaPct, visaN: v.analysed, topEmployerPct: top, diversityPct, momentumPct,
      raw: { volume: active > 0 ? Math.log10(active + 1) : 0, english: englishPct, visa: visaPct, diversity: diversityPct, momentum: momentumPct },
    };
  });
  const keys = FACTORS.map((f) => f.key);
  const range = Object.fromEntries(keys.map((k) => {
    const vals = base.map((b) => b.raw[k]).filter((x): x is number => x != null);
    return [k, vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0]];
  })) as Record<FactorKey, [number, number]>;
  const total = keys.reduce((a, k) => a + (weights[k] || 0), 0) || 1;
  return base.map((b) => {
    const norm = {} as Record<FactorKey, number>, contrib = {} as Record<FactorKey, number>;
    for (const k of keys) {
      const [lo, hi] = range[k]; const v = b.raw[k];
      norm[k] = v == null ? 0 : hi === lo ? 100 : ((v - lo) / (hi - lo)) * 100; // missing evidence scores 0, never guessed
      contrib[k] = (norm[k] * (weights[k] || 0)) / total;
    }
    return { ...b, norm, contrib, score: keys.reduce((a, k) => a + contrib[k], 0) };
  }).sort((a, b) => b.score - a.score);
}

const f0 = (n: number) => Math.round(n).toLocaleString("de-DE");
const f1 = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Deterministic statements derived only from the numbers; each is skipped when evidence is missing or thin. */
export function tradeOffs(rows: CityRow[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (a.active && b.active) {
      const [big, small] = a.active >= b.active ? [a, b] : [b, a];
      const diff = ((big.active - small.active) / small.active) * 100;
      if (diff >= 10) out.push(`${big.city} hat ${f1(diff)} % mehr aktive IT-Stellen als ${small.city} (${f0(big.active)} vs. ${f0(small.active)}).`);
    }
    if (a.englishPct != null && b.englishPct != null && a.englishN >= MIN_SAMPLE && b.englishN >= MIN_SAMPLE) {
      const [hi, lo] = a.englishPct >= b.englishPct ? [a, b] : [b, a];
      const pp = hi.englishPct! - lo.englishPct!;
      if (pp >= 3) {
        const bigger = hi.active < lo.active ? `, obwohl ${hi.city} weniger aktive Stellen hat` : "";
        out.push(`${hi.city} ist um ${f1(pp)} Prozentpunkte englisch-zugänglicher als ${lo.city} (${f1(hi.englishPct!)} % von ${f0(hi.englishN)} vs. ${f1(lo.englishPct!)} % von ${f0(lo.englishN)} analysierten Stellen)${bigger}.`);
      }
    }
    if (a.visaPct != null && b.visaPct != null && a.visaN >= MIN_SAMPLE && b.visaN >= MIN_SAMPLE) {
      const [hi, lo] = a.visaPct >= b.visaPct ? [a, b] : [b, a];
      const pp = hi.visaPct! - lo.visaPct!;
      if (pp >= 2) out.push(`${hi.city} hat einen um ${f1(pp)} Prozentpunkte höheren Anteil international offener Stellen als ${lo.city} (${f1(hi.visaPct!)} % vs. ${f1(lo.visaPct!)} %).`);
    }
    if (a.topEmployerPct != null && b.topEmployerPct != null) {
      const [conc, div] = a.topEmployerPct >= b.topEmployerPct ? [a, b] : [b, a];
      if (conc.topEmployerPct! - div.topEmployerPct! >= 5) out.push(`In ${conc.city} stellt der größte Arbeitgeber ${f1(conc.topEmployerPct!)} % der Stellen, in ${div.city} nur ${f1(div.topEmployerPct!)} % — ${div.city} ist breiter aufgestellt.`);
    }
  }
  for (const r of rows) {
    if (r.englishN < MIN_SAMPLE) out.push(`${r.city}: nur ${f0(r.englishN)} sprachlich analysierte Stellen — Englisch-Anteil ist wenig belastbar.`);
    if (r.visaN < MIN_SAMPLE) out.push(`${r.city}: nur ${f0(r.visaN)} visa-analysierte Stellen — Visa-Anteil ist wenig belastbar.`);
  }
  return out;
}
