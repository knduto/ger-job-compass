import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, fmt } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { IT_BERUFSFELDER } from "@/lib/it-fields";
import { getLanguageAnalysisStatus, getReportData, processLanguageBatch, type ReportFilters } from "@/lib/reports.functions";
import { buildReportMetrics, employerKind, type ReportJob } from "@/lib/report-metrics";
import { addTrackedCity, fetchAllCityStats, fetchTrackedCities, must, removeTrackedCity } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [
    { title: "Arbeitsmarkt-Reports — Smart-DE-Reise" },
    { name: "description", content: "Datenbasierte Stadt-, Sprach-, Arbeitgeber- und Marktberichte für IT-Jobs in Deutschland." },
    { property: "og:title", content: "Arbeitsmarkt-Reports — Smart-DE-Reise" },
    { property: "og:description", content: "Arbeitsagentur-Daten für die fundierte Wahl einer Stadt in Deutschland." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Reports,
});

const defaultFilters: ReportFilters = { city: "", region: "", field: "", keyword: "", status: "active", days: 0, contract: "", worktime: "", homeoffice: false, salary: false, language: "" };
const defaultWeights = { volume: 5, growth: 3, remote: 2, permanent: 2, diversity: 3, language: 2 };
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const weightLabels: Record<string, string> = { volume: "Stellenvolumen", growth: "Neue Stellen", remote: "Homeoffice", permanent: "Unbefristet", diversity: "Arbeitgebervielfalt", language: "Englisch zugänglich" };
const weightHints: Record<string, string> = {
  volume: "Wie viele aktive Stellen die Stadt insgesamt bietet — mehr Auswahl, mehr Chancen.",
  growth: "Wie viele Stellen in den letzten 7 Tagen neu veröffentlicht wurden — Zeichen eines aktiven Markts.",
  remote: "Anteil der Stellen mit Homeoffice-Option.",
  permanent: "Anteil unbefristeter Verträge — mehr Jobsicherheit.",
  diversity: "Wie viele verschiedene Arbeitgeber in der Stadt ausschreiben — weniger Abhängigkeit von einem einzelnen Arbeitgeber.",
  language: "Anteil englisch zugänglicher Stellen unter den sprachlich analysierten Beschreibungen der Stadt.",
};

const ESTIMATED_OPTIONS: [string, string][] = [
  ["est:C1-C2", "Geschätzt C1–C2 (verhandlungssicher)"], ["est:B2-C1", "Geschätzt B2–C1 (fließend)"],
  ["est:B1-B2", "Geschätzt B1–B2 (gute Deutschkenntnisse)"], ["est:A2", "Geschätzt A2 (Grundkenntnisse)"],
];

function Reports() {
  const reportFn = useServerFn(getReportData);
  const analyseFn = useServerFn(processLanguageBatch);
  const statusFn = useServerFn(getLanguageAnalysisStatus);
  const [filters, setFilters] = useState(defaultFilters);
  const [weights, setWeights] = useState(defaultWeights);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailCity, setDetailCity] = useState<string | null>(null);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [runState, setRunState] = useState<"idle" | "running" | "paused">("idle");
  const runControl = useRef<"run" | "pause" | "stop">("run");
  const [progress, setProgress] = useState<{ analysed: number; pending: number; total: number } | null>(null);
  const [unavailable, setUnavailable] = useState(0);
  const status = useQuery({ queryKey: ["language-status"], queryFn: () => statusFn({ data: {} as any }) });
  const live = progress ?? status.data ?? null;
  const livePct = live && live.total ? 100 * live.analysed / live.total : 0;

  const control = () => runControl.current as "run" | "pause" | "stop";
  async function runBulk() {
    runControl.current = "run";
    setRunState("running");
    try {
      for (;;) {
        if (control() === "stop") break;
        if (control() === "pause") { setRunState("paused"); return; }
        const result = await analyseFn({ data: { limit: 25 } });
        if (result.errors.length) toast.error(result.errors[0]);
        if (result.unavailable) setUnavailable((n) => n + result.unavailable);
        setProgress((current) => {
          const total = current?.total ?? live?.total ?? result.remaining + result.processed;
          return { total, pending: result.remaining, analysed: Math.max(0, total - result.remaining) };
        });
        // Stop instead of looping forever when a block makes no progress at all.
        // Removed postings count as progress: they are permanently recorded.
        if (result.remaining === 0 || result.requested === 0 || result.processed + result.unavailable === 0) break;
      }
      toast.success("Massenanalyse abgeschlossen");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (control() !== "pause") {
        setRunState("idle");
        await Promise.all([status.refetch(), report.refetch()]);
      }
    }
  }

  const cities = useQuery({ queryKey: ["city_stats"], queryFn: fetchAllCityStats });
  const tracked = useQuery({ queryKey: ["tracked_cities"], queryFn: fetchTrackedCities });
  const [cityPick, setCityPick] = useState("");
  const keywords = useQuery({ queryKey: ["keywords-report"], queryFn: async () => (await must(supabase.from("search_keywords").select("term").eq("active", true).order("term"))).data ?? [] });
  const report = useQuery({ queryKey: ["decision-report", filters], queryFn: () => reportFn({ data: filters }) });
  const rows = (report.data?.rows ?? []) as ReportJob[];
  const metrics = useMemo(() => buildReportMetrics(rows, weights), [rows, weights]);
  const trackedNames = (tracked.data ?? []).map((t) => t.city);
  const rankedCities = useMemo(() => {
    if (!trackedNames.length) return metrics.cities.slice(0, 30);
    const byName = new Map(metrics.cities.map((c) => [c.city, c]));
    const empty = (city: string) => ({ city, active: 0, total: 0, expired: 0, new7: 0, employers: 0, remotePct: 0, permanentPct: 0, salaryPct: 0, languageCoverage: 0, englishPct: 0, expiryPct: 0, avgDays: 0, contributions: { volume: 0, growth: 0, remote: 0, permanent: 0, diversity: 0, language: 0 }, score: 0 });
    return trackedNames.map((name) => byName.get(name) ?? empty(name)).sort((a, b) => b.score - a.score);
  }, [metrics.cities, trackedNames]);
  const analysedPct = rows.length ? 100 * metrics.analysed / rows.length : 0;
  const topCity = rankedCities[0];
  const newestCity = [...rankedCities].sort((a, b) => b.new7 / Math.max(1, b.active) - a.new7 / Math.max(1, a.active))[0];
  const salaryValues = rows.flatMap((r) => [r.salary_from, r.salary_to]).filter((n): n is number => n !== null);
  const snapshotSeries = (report.data?.snapshots ?? []).filter((s) => !selected.length || selected.includes(s.city)).reduce<Record<string, any>>((acc, s) => {
    const row = acc[s.snapshot_date] ?? { date: s.snapshot_date, active: 0, new7: 0, english: 0, analysed: 0 };
    row.active += s.active_jobs; row.new7 += s.new_7d; row.english += s.english_accessible; row.analysed += s.analysed_jobs; acc[s.snapshot_date] = row; return acc;
  }, {});
  const trends = Object.values(snapshotSeries).map((r: any) => ({ ...r, englishPct: r.analysed ? +(100 * r.english / r.analysed).toFixed(1) : 0 }));
  const update = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const methodology = ["Quelle: Bundesagentur für Arbeit Jobsuche API; keine erfundenen oder extern ergänzten Stellen.", "A1–C2 wird nur vergeben, wenn das Niveau ausdrücklich in der Stellenbeschreibung steht.", "Geschätzte Niveaus (z. B. „Geschätzt B2–C1“) sind heuristische Ableitungen ausdrücklicher Formulierungen wie „verhandlungssicher“ oder „fließend“ in den gespeicherten Beschreibungen — sie ersetzen kein explizites Niveau und werden nie erfunden.", "Vage Angaben ohne passende Formulierung bleiben als „Deutsch erforderlich, Niveau unklar“ separat.", `Sprachabdeckung: ${metrics.analysed} von ${rows.length} gefilterten Stellen (${analysedPct.toFixed(1)} %).`, "Agenturhinweise beruhen ausschließlich auf klaren Begriffen im Arbeitgebernamen; alle anderen bleiben unklassifiziert.", "Historische Trends entstehen erst aus täglichen vollständigen Abrufen; ältere Punkte werden nicht rückwirkend erfunden.", "Alle Analysen basieren auf gespeicherten Datenbankinhalten; beim Anzeigen oder Herunterladen der Berichte werden keine Live-API-Aufrufe durchgeführt."];

  async function pdf() {
    if (!rows.length) return;
    const { downloadReportPdf } = await import("@/lib/report-pdf");
    await downloadReportPdf({ filters, total: rows.length, analysed: metrics.analysed, generatedAt: report.data?.generatedAt ?? new Date().toISOString(), cities: metrics.cities, language: metrics.language, estimatedLanguage: metrics.estimatedLanguage, topEmployers: metrics.employerCounts.slice(0, 15), methodology });
  }
  async function excel() {
    if (!rows.length) return;
    const { downloadReportXlsx } = await import("@/lib/report-xlsx");
    await downloadReportXlsx({ filters, rows, cities: metrics.cities, language: metrics.language, estimatedLanguage: metrics.estimatedLanguage, employers: metrics.employerCounts, snapshots: report.data?.snapshots ?? [], generatedAt: report.data?.generatedAt ?? new Date().toISOString() });
  }

  return <>
    <PageHeader title="Arbeitsmarkt-Reports" subtitle="Städte, Sprache und Marktchancen auf Basis realer Arbeitsagentur-Stellen." actions={<div className="flex gap-2"><Button variant="outline" disabled={!rows.length} onClick={pdf}><Download className="mr-2 h-4 w-4" />PDF</Button><Button disabled={!rows.length} onClick={excel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button></div>} />
    <section className="mb-6 border-y bg-card/40 py-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Filter label="Stadt"><select className={selectClass} value={filters.city} onChange={(e) => update("city", e.target.value)}><option value="">Alle Städte</option>{(cities.data ?? []).map((c) => <option key={c.city} value={c.city ?? ""}>{c.city}</option>)}</select></Filter>
        <Filter label="Bundesland"><input className={selectClass} value={filters.region} onChange={(e) => update("region", e.target.value)} placeholder="z.B. Bayern" /></Filter>
        <Filter label="IT-Berufsfeld"><select className={selectClass} value={filters.field} onChange={(e) => update("field", e.target.value)}><option value="">Alle</option>{IT_BERUFSFELDER.map((v) => <option key={v}>{v}</option>)}</select></Filter>
        <Filter label="Suchbegriff"><select className={selectClass} value={filters.keyword} onChange={(e) => update("keyword", e.target.value)}><option value="">Alle</option>{(keywords.data ?? []).map((k) => <option key={k.term}>{k.term}</option>)}</select></Filter>
        <Filter label="Status"><select className={selectClass} value={filters.status} onChange={(e) => update("status", e.target.value as ReportFilters["status"])}><option value="active">Aktiv</option><option value="expired">Abgelaufen</option><option value="all">Alle</option></select></Filter>
        <Filter label="Zeitraum"><select className={selectClass} value={filters.days} onChange={(e) => update("days", Number(e.target.value))}><option value={0}>Gesamter Zeitraum</option><option value={7}>7 Tage</option><option value={30}>30 Tage</option><option value={90}>90 Tage</option></select></Filter>
        <Filter label="Vertrag"><select className={selectClass} value={filters.contract} onChange={(e) => update("contract", e.target.value)}><option value="">Alle</option><option value="UNBEFRISTET">Unbefristet</option><option value="BEFRISTET">Befristet</option></select></Filter>
        <Filter label="Arbeitszeit"><select className={selectClass} value={filters.worktime} onChange={(e) => update("worktime", e.target.value as ReportFilters["worktime"])}><option value="">Alle</option><option value="full">Vollzeit</option><option value="part">Teilzeit</option></select></Filter>
        <Filter label="Sprache"><select className={selectClass} value={filters.language} onChange={(e) => update("language", e.target.value)}>
          <option value="">Alle</option>
          <option value="required">Deutsch erforderlich</option>
          <optgroup label="Explizit genannt">{["A1","A2","B1","B2","C1","C2"].map((v) => <option key={v} value={v}>{v} (explizit)</option>)}</optgroup>
          <optgroup label="Geschätzt (heuristisch)">{ESTIMATED_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>
          <optgroup label="Weitere">
            <option value="unclear">Deutsch erforderlich, Niveau unklar</option>
            <option value="english">Englisch zugänglich</option>
            <option value="pending">Noch nicht analysiert</option>
          </optgroup>
        </select></Filter>
        <Toggle label="Homeoffice" checked={filters.homeoffice} onChange={(v) => update("homeoffice", v)} /><Toggle label="Mit Gehalt" checked={filters.salary} onChange={(v) => update("salary", v)} />
        <Button variant="outline" className="self-end" onClick={() => setFilters(defaultFilters)}>Filter zurücksetzen</Button>
      </div>
    </section>
    {report.isLoading ? <p className="py-12 text-center text-muted-foreground">Bericht wird berechnet…</p> : report.error ? <p className="py-12 text-center text-destructive">{(report.error as Error).message}</p> : !rows.length ? <p className="py-12 text-center text-muted-foreground">Keine Stellen entsprechen diesen Filtern.</p> : <>
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Entscheidungsübersicht</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Gefilterte Stellen" value={fmt(rows.length)} /><Stat label="Bestbewertete Stadt" value={topCity?.city ?? "–"} hint={topCity ? `Score ${topCity.score.toFixed(0)}` : undefined} /><Stat label="Frischester Markt" value={newestCity?.city ?? "–"} hint={newestCity ? `${newestCity.new7} in 7 Tagen` : undefined} /><Stat label="Gehaltsangaben" value={`${(100 * salaryValues.length / Math.max(1, rows.length * 2)).toFixed(1)} %`} /><Stat label="Sprachabdeckung" value={`${analysedPct.toFixed(1)} %`} hint={`${metrics.analysed} von ${rows.length}`} /></div>
        {analysedPct < 50 && <p className="mt-3 border-l-2 border-warning pl-3 text-sm text-muted-foreground">Die Sprachauswertung ist noch nicht repräsentativ. Ergebnisse beziehen sich nur auf {metrics.analysed} analysierte Beschreibungen.</p>}
      </section>
      <section className="mb-8">
        <div className="mb-3"><h2 className="text-lg font-semibold">Deutsch & Zugänglichkeit</h2><p className="text-sm text-muted-foreground">Explizite Nachweise aus Stellenbeschreibungen; geschätzte Niveaus stehen separat darunter.</p></div>
        <div className="mb-4 rounded-lg border bg-card p-4" data-testid="bulk-runner">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Massenanalyse der Sprachanforderungen</h3>
              <p className="text-xs text-muted-foreground">{live ? `${fmt(live.analysed)} analysiert · ${fmt(live.pending)} offen · ${livePct.toFixed(1)} % von ${fmt(live.total)}${unavailable ? ` · ${fmt(unavailable)} nicht mehr verfügbar` : ""}` : "Zählerstand wird geladen…"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={runState === "running" || (live?.pending === 0)} onClick={runBulk}><RefreshCw className={`mr-2 h-4 w-4 ${runState === "running" ? "animate-spin" : ""}`} />Massenanalyse starten</Button>
              <Button variant="outline" disabled={runState !== "running"} onClick={() => { runControl.current = "pause"; }}>Pause</Button>
              <Button variant="outline" disabled={runState === "idle"} onClick={() => { runControl.current = "stop"; setRunState("idle"); void Promise.all([status.refetch(), report.refetch()]); }}>Stopp</Button>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${Math.min(100, livePct)}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Läuft in Blöcken von 25 Stellen; bereits analysierte Stellen werden nie erneut abgerufen. {runState === "paused" ? "Pausiert." : runState === "running" ? "Läuft…" : ""}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Kategorie</th><th className="px-3 py-2 text-right">Stellen</th></tr></thead><tbody>{metrics.language.map((r) => <tr className="border-t" key={r.label}><td className="px-3 py-2">{r.label}</td><td className="px-3 py-2 text-right font-mono">{fmt(r.count)}</td></tr>)}<tr className="border-t-2 bg-muted/50"><td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={2}>Geschätzt (heuristisch, aus expliziten Formulierungen)</td></tr>{metrics.estimatedLanguage.map((r) => <tr className="border-t italic text-muted-foreground" key={r.label}><td className="px-3 py-2">{r.label}</td><td className="px-3 py-2 text-right font-mono">{fmt(r.count)}</td></tr>)}</tbody></table></div><div className="h-72 rounded-lg border bg-card p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.cities.slice(0, 12)}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="city" fontSize={10}/><YAxis fontSize={10}/><Tooltip/><Bar dataKey="englishPct" name="Englisch zugänglich %" fill="var(--chart-2)"/></BarChart></ResponsiveContainer></div></div>
      </section>
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2"><h2 className="text-lg font-semibold">Städteranking</h2><Button variant="ghost" size="sm" onClick={() => setShowScoreInfo((v) => !v)}>{showScoreInfo ? "Erklärung ausblenden" : "Wie wird der Score berechnet?"}</Button></div>
        <div className="mb-4 rounded-lg border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Meine Städte</span>
            <select className={`${selectClass} max-w-xs`} value={cityPick} onChange={(e) => setCityPick(e.target.value)}>
              <option value="">Stadt auswählen…</option>
              {(cities.data ?? []).filter((c) => c.city && !trackedNames.includes(c.city)).map((c) => <option key={c.city} value={c.city ?? ""}>{c.city} ({c.active_jobs})</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!cityPick} onClick={async () => { try { await addTrackedCity(cityPick); setCityPick(""); await tracked.refetch(); } catch (e) { toast.error((e as Error).message); } }}>Hinzufügen</Button>
          </div>
          {trackedNames.length ? <div className="flex flex-wrap gap-2">{tracked.data!.map((t) => <span key={t.id} className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">{t.city}<button aria-label={`${t.city} entfernen`} onClick={async () => { await removeTrackedCity(t.id); await tracked.refetch(); }}><X className="h-3 w-3" /></button></span>)}</div> : <p className="text-sm text-muted-foreground">Noch keine eigenen Städte — das Ranking zeigt automatisch die 30 aktivsten Städte. Fügen Sie Städte hinzu, um das Ranking auf Ihre Auswahl zu beschränken.</p>}
        </div>
        {showScoreInfo && <div className="mb-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground"><ul className="list-disc space-y-1 pl-5">
          <li>Jede Stadt erhält 0–100 Punkte aus sechs Faktoren (siehe Regler unten).</li>
          <li>Jeder Faktor wird gegen die beste Stadt skaliert: die beste Stadt erhält die vollen Punkte, alle anderen anteilig.</li>
          <li>Der Regler (0–10) bestimmt, wie stark ein Faktor zählt. Bei 0 fließt der Faktor gar nicht ein.</li>
          <li>Endscore = gewichtete Summe aller Faktoren, auf 100 skaliert. Klicken Sie eine Stadt an, um ihre Punktaufteilung zu sehen.</li>
        </ul></div>}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">{Object.entries(weights).map(([key, value]) => <div key={key} className="space-y-2 text-sm"><div className="flex justify-between"><span title={weightHints[key]}>{weightLabels[key]}</span><span className="font-mono">{value}</span></div><Slider min={0} max={10} value={[value]} onValueChange={([v]) => setWeights((w) => ({ ...w, [key]: v }))}/><p className="text-xs text-muted-foreground">{weightHints[key]}{key === "language" && analysedPct < 50 ? ` (bisher nur ${analysedPct.toFixed(0)} % analysiert)` : ""}</p></div>)}</div>
        <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Vgl.","#","Stadt","Score","Aktiv","Neu 7T","Arbeitgeber","Remote","Englisch*","Gehalt"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{rankedCities.map((r,i) => <tr key={r.city} onClick={() => setDetailCity(detailCity === r.city ? null : r.city)} className={`cursor-pointer border-t hover:bg-muted/50 ${detailCity === r.city ? "bg-muted/40" : ""}`}><td className="px-3 py-2"><input type="checkbox" onClick={(e) => e.stopPropagation()} checked={selected.includes(r.city)} onChange={(e) => setSelected(e.target.checked ? [...selected,r.city] : selected.filter((v) => v !== r.city))}/></td><td className="px-3 py-2 text-muted-foreground">{i+1}</td><td className="px-3 py-2 font-medium">{r.city}</td><td className="px-3 py-2 font-mono text-accent">{r.score.toFixed(0)}</td><td className="px-3 py-2 font-mono">{r.active}</td><td className="px-3 py-2 font-mono">{r.new7}</td><td className="px-3 py-2 font-mono">{r.employers}</td><td className="px-3 py-2 font-mono">{r.remotePct.toFixed(1)} %</td><td className="px-3 py-2 font-mono">{r.languageCoverage ? `${r.englishPct.toFixed(1)} %` : "–"}</td><td className="px-3 py-2 font-mono">{r.salaryPct.toFixed(1)} %</td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-muted-foreground">* Anteil nur innerhalb sprachlich analysierter Stellen der jeweiligen Stadt.</p>
        {detailCity && (() => { const city = rankedCities.find((c) => c.city === detailCity); if (!city) return null; const total = Object.values(city.contributions).reduce((s, v) => s + v, 0) || 1; return <div className="mt-3 rounded-lg border bg-card p-4"><h3 className="mb-2 text-sm font-semibold">Punktaufteilung: {city.city} (Score {city.score.toFixed(0)})</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(city.contributions).map(([key, value]) => <div key={key} className="text-sm"><div className="flex justify-between"><span className="text-muted-foreground">{weightLabels[key]}</span><span className="font-mono">{(value / total * city.score).toFixed(1)} Pkt.</span></div><div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-accent" style={{ width: `${total ? 100 * value / total : 0}%` }} /></div></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Anteil jedes Faktors am Endscore, nach Ihren Regler-Gewichten.</p></div>; })()}
      </section>
      <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">Markt & Arbeitgeber</h2><div className="grid gap-4 lg:grid-cols-3"><Stat label="Größter Arbeitgeber" value={metrics.employerCounts[0]?.[0] ?? "–"} hint={`${fmt(metrics.employerCounts[0]?.[1])} Stellen`} /><Stat label="Agenturhinweis" value={`${(100 * metrics.agency / rows.length).toFixed(1)} %`} hint="Nur klare Namensmerkmale" /><Stat label="Gehaltsspanne" value={salaryValues.length ? `${fmt(Math.min(...salaryValues))}–${fmt(Math.max(...salaryValues))} €` : "–"} /></div><div className="mt-4 overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Arbeitgeber</th><th className="px-3 py-2 text-left">Klassifikation</th><th className="px-3 py-2 text-right">Stellen</th></tr></thead><tbody>{metrics.employerCounts.slice(0,15).map(([name,n]) => <tr key={name} className="border-t"><td className="px-3 py-2">{name}</td><td className="px-3 py-2 text-muted-foreground">{employerKind(name)}</td><td className="px-3 py-2 text-right font-mono">{n}</td></tr>)}</tbody></table></div></section>
      <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">Stellen-Lebenszyklus</h2><div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Stadt","Gesamt beobachtet","Abgelaufen","Ablaufquote","Ø beobachtete Tage"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{metrics.cities.slice(0,20).map((r) => <tr key={r.city} className="border-t"><td className="px-3 py-2 font-medium">{r.city}</td><td className="px-3 py-2">{r.total}</td><td className="px-3 py-2">{r.expired}</td><td className="px-3 py-2">{r.expiryPct.toFixed(1)} %</td><td className="px-3 py-2">{r.avgDays.toFixed(1)}</td></tr>)}</tbody></table></div></section>
      <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">Historische Trends</h2>{trends.length < 2 ? <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Noch nicht genug Historie für einen belastbaren Trend. Jeder erfolgreiche tägliche Abruf ergänzt einen echten Datenpunkt.</p> : <div className="h-80 rounded-lg border bg-card p-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={trends}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="date" fontSize={10}/><YAxis fontSize={10}/><Tooltip/><Legend/><Line type="monotone" dataKey="active" name="Aktiv" stroke="var(--chart-2)"/><Line type="monotone" dataKey="new7" name="Neu 7T" stroke="var(--chart-1)"/><Line type="monotone" dataKey="englishPct" name="Englisch %" stroke="var(--chart-4)"/></LineChart></ResponsiveContainer></div>}</section>
      <section className="border-t pt-5"><h2 className="mb-2 text-lg font-semibold">Datenbasis & Methodik</h2><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{methodology.map((line) => <li key={line}>{line}</li>)}</ul></section>
    </>}
  </>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-9 items-center justify-between self-end rounded-md border px-3 text-sm">{label}<Switch checked={checked} onCheckedChange={onChange}/></label>; }