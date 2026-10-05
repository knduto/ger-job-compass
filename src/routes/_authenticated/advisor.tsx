import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader, Stat, fmt } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { getAdvisorData, type AdvisorData } from "@/lib/advisor.functions";
import { buildCityRows, DEFAULT_WEIGHTS, FACTORS, MIN_SAMPLE, tradeOffs, type CityRow, type FactorKey } from "@/lib/advisor-metrics";

export const Route = createFileRoute("/_authenticated/advisor")({
  head: () => ({ meta: [
    { title: "Strategie-Berater — City Settlement Advisor | Smart-DE-Reise" },
    { name: "description", content: "Transparente Städte-Rangliste für den Umzug nach Deutschland: IT-Volumen, Englisch- und Visa-Zugänglichkeit, Arbeitgebervielfalt und Dynamik aus gespeicherten Daten." },
    { property: "og:title", content: "Strategie-Berater — Smart-DE-Reise" },
    { property: "og:description", content: "Evidenzbasierter Städtevergleich für IT-Jobs in Deutschland, berechnet aus gespeicherten Arbeitsagentur-Stellen." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvisorPage,
});

const pctTxt = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);

function AdvisorPage() {
  const fn = useServerFn(getAdvisorData);
  const q = useQuery({ queryKey: ["advisor"], queryFn: () => fn(), staleTime: 5 * 60_000 });
  return (
    <>
      <PageHeader title="City Settlement & Job Market Strategic Advisor" subtitle="Strategie-Berater · berechnet ausschließlich aus Stellen in deiner Datenbank (keine Live-API, keine KI-Texte)" />
      {q.isLoading && <p className="text-sm text-muted-foreground">Lade Datenbasis…</p>}
      {q.error && <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{(q.error as Error).message} <Button size="sm" variant="outline" className="ml-2" onClick={() => q.refetch()}>Erneut versuchen</Button></div>}
      {q.data && <SectionErrorBoundary title="Strategie-Berater konnte nicht angezeigt werden"><Advisor data={q.data} /></SectionErrorBoundary>}
    </>
  );
}

function Advisor({ data }: { data: AdvisorData }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const usingTracked = data.tracked.length > 0;
  const cities = useMemo(() => usingTracked ? data.tracked : data.cityStats.filter((c: any) => c.city).slice(0, 30).map((c: any) => c.city as string), [data, usingTracked]);
  const rows = useMemo(() => buildCityRows(data.cityStats, data.share, data.langBy, data.visaBy, cities, weights), [data, cities, weights]);
  const [picked, setPicked] = useState<string[]>(() => rows.slice(0, 2).map((r) => r.city));
  const cmp = rows.filter((r) => picked.includes(r.city));
  const toggle = (c: string) => setPicked((p) => p.includes(c) ? p.filter((x) => x !== c) : p.length >= 3 ? p : [...p, c]);
  const statements = useMemo(() => tradeOffs(cmp), [cmp]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1 · Ranking / Executive settlement ranking</h2>
        <p className="text-sm text-muted-foreground">
          {usingTracked ? `${cities.length} beobachtete Städte` : "Keine beobachteten Städte — Top 30 nach aktiven Stellen"}. Jeder Faktor wird relativ zu den angezeigten Städten auf 0–100 normiert (beste = 100, schwächste = 0 — auch kleine absolute Unterschiede werden so sichtbar, daher immer die Rohwerte prüfen) und mit seinem Gewicht multipliziert; fehlende Daten zählen 0.
        </p>
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-5">
          {FACTORS.map((f) => (
            <label key={f.key} className="space-y-1 text-xs" title={f.hint}>
              <span className="font-medium">{f.label}: {weights[f.key]}</span>
              <input type="range" min={0} max={50} value={weights[f.key]} className="w-full accent-primary"
                onChange={(e) => setWeights({ ...weights, [f.key]: Number(e.target.value) })} />
              <span className="block text-muted-foreground">{f.hint}</span>
            </label>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-2">#</th><th className="p-2">Stadt</th><th className="p-2">Score</th><th className="p-2">Faktorbeiträge</th><th className="p-2 text-right">Aktiv</th><th className="p-2 text-right">Englisch</th><th className="p-2 text-right">Visa-offen</th><th className="p-2 text-right">Top-AG</th><th className="p-2 text-right">Neu 30T</th></tr>
            </thead>
            <tbody translate="no">
              {rows.map((r, i) => (
                <tr key={r.city} className="border-b last:border-0">
                  <td className="p-2 font-mono">{i + 1}</td>
                  <td className="p-2 font-medium">{r.city}</td>
                  <td className="p-2 font-mono font-semibold">{r.score.toFixed(1)}</td>
                  <td className="p-2"><ContribBar r={r} /></td>
                  <td className="p-2 text-right font-mono">{fmt(r.active)}</td>
                  <td className="p-2 text-right font-mono">{pctTxt(r.englishPct)}<Small n={r.englishN} /></td>
                  <td className="p-2 text-right font-mono">{pctTxt(r.visaPct)}<Small n={r.visaN} /></td>
                  <td className="p-2 text-right font-mono">{pctTxt(r.topEmployerPct)}</td>
                  <td className="p-2 text-right font-mono">{fmt(r.new30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2 · Direktvergleich / Head-to-head</h2>
        <div className="flex flex-wrap gap-1">
          {rows.map((r) => (
            <Button key={r.city} size="sm" variant={picked.includes(r.city) ? "default" : "outline"} onClick={() => toggle(r.city)} disabled={!picked.includes(r.city) && picked.length >= 3}>{r.city}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">2–3 Städte wählen ({picked.length}/3).</p>
        {cmp.length >= 2 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cmp.length}, minmax(0, 1fr))` }} translate="no">
            {cmp.map((r) => (
              <div key={r.city} className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between"><span className="text-lg font-semibold">{r.city}</span><span className="font-mono text-xl">{r.score.toFixed(1)}</span></div>
                {FACTORS.map((f) => (
                  <div key={f.key} className="text-xs">
                    <div className="flex justify-between"><span>{f.label}</span><span className="font-mono">{rawTxt(r, f.key)} · {r.contrib[f.key].toFixed(1)} Pkt.</span></div>
                    <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${r.norm[f.key]}%` }} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3 · Abwägungen / Evidence-based trade-offs</h2>
        <p className="text-xs text-muted-foreground">Regelbasiert aus den Zahlen oben erzeugt — Aussagen erscheinen nur bei messbarem Unterschied; Anteile nur bei ≥ {MIN_SAMPLE} analysierten Stellen.</p>
        <ul className="space-y-2 rounded-lg border bg-card p-4 text-sm" translate="no">
          {cmp.length < 2 && <li className="text-muted-foreground">Mindestens zwei Städte im Direktvergleich wählen.</li>}
          {cmp.length >= 2 && statements.length === 0 && <li className="text-muted-foreground">Keine deutlichen Unterschiede in den gespeicherten Daten.</li>}
          {statements.map((s) => <li key={s} className="border-l-2 border-primary pl-3">{s}</li>)}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4 · Datenbasis / Data basis</h2>
        <DataBasis data={data} rows={rows} />
      </section>
    </div>
  );
}

function rawTxt(r: CityRow, k: FactorKey) {
  if (k === "volume") return `${fmt(r.active)} Stellen`;
  if (k === "english") return pctTxt(r.englishPct);
  if (k === "visa") return pctTxt(r.visaPct);
  if (k === "diversity") return pctTxt(r.diversityPct);
  return pctTxt(r.momentumPct);
}

const SHADES = ["bg-chart-2", "bg-chart-1", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function ContribBar({ r }: { r: CityRow }) {
  return (
    <div className="flex h-3 w-40 overflow-hidden rounded bg-muted" title={FACTORS.map((f) => `${f.label}: ${r.contrib[f.key].toFixed(1)}`).join(" · ")}>
      {FACTORS.map((f, i) => <div key={f.key} className={SHADES[i]} style={{ width: `${r.contrib[f.key]}%` }} />)}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {FACTORS.map((f, i) => <span key={f.key} className="flex items-center gap-1"><span className={`inline-block h-2 w-3 rounded ${SHADES[i]}`} />{f.label}</span>)}
      <span>· Breite = Punktbeitrag (max. 100)</span>
    </div>
  );
}

function Small({ n }: { n: number }) {
  return <span className={`ml-1 text-[10px] ${n < MIN_SAMPLE ? "text-destructive" : "text-muted-foreground"}`}>n={n}</span>;
}

function DataBasis({ data, rows }: { data: AdvisorData; rows: CityRow[] }) {
  const active = data.activeJobs;
  const shown = rows.reduce((a, r) => a + r.active, 0);
  const lastSeen = data.cityStats.reduce((m: string, c: any) => (c.last_seen && c.last_seen > m ? c.last_seen : m), "");
  const d = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE") : "—");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" translate="no">
        <Stat label="Aktive Stellen gesamt" value={fmt(active)} />
        <Stat label="In Ranking-Städten" value={fmt(shown)} hint={active ? `${((shown / active) * 100).toFixed(1)} %` : undefined} />
        <Stat label="Sprache analysiert" value={fmt(data.langAnalysedTotal)} hint={active ? `${((data.langAnalysedTotal / active) * 100).toFixed(1)} % der aktiven` : undefined} />
        <Stat label="Visa analysiert" value={fmt(data.visaAnalysedTotal)} hint={active ? `${((data.visaAnalysedTotal / active) * 100).toFixed(1)} % der aktiven` : undefined} />
        <Stat label="Letzter erfolgreicher Abruf" value={<span className="text-sm">{d(data.lastSync)}</span>} />
        <Stat label="Zuletzt gesehen" value={<span className="text-sm">{d(lastSeen || null)}</span>} />
      </div>
      <p className="text-xs text-muted-foreground">
        Quelle: gespeicherte Stellen der Bundesagentur für Arbeit (Jobsuche). Englisch- und Visa-Anteile beziehen sich nur auf bereits analysierte aktive Stellen; nicht verfügbare Beschreibungen (404) sind ausgeschlossen. Berechnet am {d(data.generatedAt)}.
      </p>
    </div>
  );
}
