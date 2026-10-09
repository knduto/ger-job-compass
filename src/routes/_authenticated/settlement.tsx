import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Stat, fmt, fmtDateTime } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { getSettlementData, type SettlementData } from "@/lib/settlement.functions";
import { buildSettlementRows, sortRows, KAUTION_MONTHS, TIGHTNESS, type Benchmark, type NationalUtilities, type SortKey } from "@/lib/settlement-metrics";

export const Route = createFileRoute("/_authenticated/settlement")({
  head: () => ({ meta: [
    { title: "Wohnen & Ankommen — Smart-DE-Reise" },
    { name: "description", content: "Warmmiete, Kaution, Startkapital und Runway je Stadt aus quellenbelegten Werten, kombiniert mit gespeicherten IT-Stellen." },
    { property: "og:title", content: "Wohnen & Ankommen — Smart-DE-Reise" },
    { property: "og:description", content: "Quellenbelegter Wohnkosten- und Ankunftsvergleich deutscher Städte für die Chancenkarte." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SettlementPage,
});

const eur = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("de-DE")} €`);
const num2 = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const months = (n: number | null) => (n == null ? "—" : n === Infinity ? "∞ (gedeckt)" : n.toLocaleString("de-DE", { maximumFractionDigits: 1 }));
const numIn = (s: string) => { const v = Number(s.replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : 0; };
const Missing = () => <span className="text-xs text-muted-foreground">fehlt</span>;

function SettlementPage() {
  const fn = useServerFn(getSettlementData);
  const q = useQuery({ queryKey: ["settlement"], queryFn: () => fn(), staleTime: 5 * 60_000 });
  return (
    <>
      <PageHeader title="Wohnen & Ankommen" subtitle="Warmmiete nur aus von dir erfassten, quellenbelegten Werten · Stellenzahlen aus deiner Datenbank" />
      {q.isLoading && <p className="text-sm text-muted-foreground">Lade Datenbasis…</p>}
      {q.error && <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{(q.error as Error).message} <Button size="sm" variant="outline" className="ml-2" onClick={() => q.refetch()}>Erneut versuchen</Button></div>}
      {q.data && <SectionErrorBoundary title="Wohnen & Ankommen konnte nicht angezeigt werden"><Settlement data={q.data} /></SectionErrorBoundary>}
    </>
  );
}

function Settlement({ data }: { data: SettlementData }) {
  const [sqm, setSqm] = useState(35);
  const [savings, setSavings] = useState("");
  const [budget, setBudget] = useState("");
  const [income, setIncome] = useState("");
  const [other, setOther] = useState("");
  const [sort, setSort] = useState<SortKey>("runway");
  const nat = data.national as NationalUtilities;
  const sim = { sqm, savings: numIn(savings), budget: numIn(budget), income: numIn(income), otherCosts: numIn(other) };
  const rows = useMemo(
    () => sortRows(buildSettlementRows(data.cities, data.jobsByCity, data.benchmarks as Benchmark[], sim, nat), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, sqm, savings, budget, income, other, sort],
  );
  const withWarm = rows.filter((r) => r.warm != null);
  const longest = sortRows(withWarm, "runway")[0];
  const bestValue = sortRows(withWarm, "jobsPer100")[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Städte mit Warmmiete" value={`${withWarm.length} / ${rows.length}`} hint={data.usingTracked ? "Deine verfolgten Städte" : "Top 30 nach aktiven Stellen"} />
        <Stat label="Längster Runway" value={longest?.city ?? "—"} hint={longest && sim.savings > 0 ? `${months(longest.runway)} Monate` : "Ersparnisse eingeben"} />
        <Stat label="Beste Stellen je Warmmiete" value={bestValue?.city ?? "—"} hint={bestValue ? `${bestValue.jobsPer100?.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Stellen je 100 € Warmmiete` : undefined} />
        <Stat label="Kaution" value={`${KAUTION_MONTHS} × Kaltmiete`} hint="Gesetzliches Maximum (§ 551 BGB)" />
      </div>

      <Explainer />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold">Runway-Simulator</h2>
        <div className="grid gap-3 text-sm md:grid-cols-5">
          <label className="flex flex-col gap-1">Ersparnisse (€)<Input inputMode="decimal" value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="z. B. Sperrkonto + Rücklagen" /></label>
          <label className="flex flex-col gap-1">Monatsbudget (€)<Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="für Mietanteil" /></label>
          <label className="flex flex-col gap-1">Monatl. Einkommen (€)<Input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="leer = 0" /></label>
          <label className="flex flex-col gap-1">Sonstige Lebenskosten (€/Monat)<Input inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} placeholder="eigene Werte" /></label>
          <label className="flex flex-col gap-1">Wohnfläche (m²)<Input type="number" min={10} max={150} value={sqm} onChange={(e) => setSqm(Math.max(10, Number(e.target.value) || 0))} /></label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Sonstige Lebenskosten selbst addieren, z. B. Deutschlandticket, Lebensmittel, Krankenversicherung, Handy — die App setzt keine Werte ein. Formeln: Warmmiete = (Kalt + Nebenkosten) €/m² × m²; Kaution = {KAUTION_MONTHS} × Kaltmiete; Startkapital = Kaution + erste Warmmiete; Monatliche Belastung = Warmmiete + sonstige Kosten; Runway = (Ersparnisse − Startkapital) ÷ (Belastung − Einkommen).</p>
        <NationalUtilitiesForm nat={nat} />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
          <span className="text-muted-foreground">Sortieren:</span>
          {([["runway", "Runway"], ["warm", "Warmmiete"], ["jobsPer100", "Jobs/Warmmiete"], ["jobs", "IT-Stellen"]] as [SortKey, string][]).map(([k, l]) => (
            <Button key={k} size="sm" variant={sort === k ? "default" : "outline"} onClick={() => setSort(k)}>{l}</Button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b">{["Stadt", "IT-Stellen (DB)", "Kalt €/m²", "Nebenkosten €/m² (Quelle)", "Warmmiete", "Phase-1 möbliert", "Kaution", "Startkapital", "Monatliche Belastung", "Runway (Monate)", "Jobs je 100 € Warmmiete", "Quelle"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.city} className="border-b last:border-0 align-top">
                  <td className="p-3 font-medium">{r.city}</td>
                  <td className="p-3 font-mono">{fmt(r.activeJobs)}</td>
                  {r.b ? (<>
                    <td className="p-3 font-mono">{num2(r.b.rent_cold_sqm)}</td>
                    <td className="p-3">
                      {r.utilitiesSqm == null ? <Missing /> : <span className="font-mono">{num2(r.utilitiesSqm)}</span>}
                      <div className="text-xs text-muted-foreground">
                        {r.utilitiesFallback ? <>Nebenkosten: bundesweiter Wert · {nat.source} ({nat.year})</> : r.b.utilities_sqm != null ? `${r.b.utilities_source_name ?? r.b.source_name} (${r.b.utilities_source_year ?? r.b.source_year})` : null}
                      </div>
                    </td>
                    <td className="p-3 font-mono">{r.warm == null ? <Missing /> : eur(r.warm)}{r.rentShare != null && <div className={`text-xs ${r.rentShare > 40 ? "text-destructive" : "text-muted-foreground"}`}>{Math.round(r.rentShare)} % vom Budget</div>}</td>
                    <td className="p-3">{r.furnished == null ? <Missing /> : <><span className="font-mono">{eur(r.furnished)}</span><div className="text-xs text-muted-foreground">{r.b.furnished_source_name} ({r.b.furnished_source_year})</div></>}</td>
                    <td className="p-3 font-mono">{eur(r.kaution)}</td>
                    <td className="p-3 font-mono">{r.upfront == null ? <Missing /> : eur(r.upfront)}</td>
                    <td className="p-3 font-mono">{r.burn == null ? <Missing /> : eur(r.burn)}</td>
                    <td className="p-3 font-mono">{r.runway == null ? <Missing /> : sim.savings > 0 ? months(r.runway) : "—"}</td>
                    <td className="p-3 font-mono">{r.jobsPer100 == null ? <Missing /> : r.jobsPer100.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</td>
                    <td className="p-3 text-xs">{r.b.source_url ? <a className="underline" href={r.b.source_url} target="_blank" rel="noreferrer">{r.b.source_name}</a> : r.b.source_name} ({r.b.source_year}) · {TIGHTNESS[r.b.market_tightness] ?? "—"}</td>
                  </>) : <td colSpan={10} className="p-3 text-xs text-muted-foreground">Keine quellenbelegten Mietdaten — unten erfassen.</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BenchmarkEditor cities={data.cities} benchmarks={data.benchmarks as Benchmark[]} />
      <ArrivalTimeline />
      <p className="text-xs text-muted-foreground">Datenbasis: Stellen aus deiner Datenbank (Stand {fmtDateTime(data.generatedAt)}). Mietwerte ausschließlich aus deinen Einträgen mit Quellenangabe; fehlende Werte werden nie geschätzt.</p>
    </div>
  );
}

function NationalUtilitiesForm({ nat }: { nat: NationalUtilities }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(nat.enabled);
  const [val, setVal] = useState(nat.sqm == null ? "" : String(nat.sqm));
  const [src, setSrc] = useState(nat.source ?? "");
  const [year, setYear] = useState(nat.year == null ? "" : String(nat.year));
  const [busy, setBusy] = useState(false);
  async function save(next: boolean): Promise<void> {
    const v = val.trim() ? Number(val.replace(",", ".")) : null;
    if (next && (v == null || !(v >= 0 && v < 50) || !src.trim() || !(Number(year) >= 2000 && Number(year) <= 2100))) {
      toast.error("Für den bundesweiten Wert sind €/m², Quelle und Jahr Pflicht."); return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("user_settlement_settings").upsert({
      user_id: u.user?.id, use_national_utilities: next, national_utilities_sqm: v,
      national_utilities_source: src.trim() || null, national_utilities_year: year ? Number(year) : null, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEnabled(next);
    toast.success(next ? "Bundesweiter Betriebskostenwert aktiv" : "Bundesweiter Wert deaktiviert");
    qc.invalidateQueries({ queryKey: ["settlement"] });
  }
  return (
    <div className="mt-4 rounded-md border p-3 text-sm">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => save(e.target.checked)} />
        Bundesweiten Betriebskostenspiegel verwenden
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Nur für Städte ohne eigene Nebenkosten-Quelle. Diese Zeilen werden als „Nebenkosten: bundesweiter Wert“ markiert. Wert und Quelle trägst du selbst ein (z. B. Deutscher Mieterbund Betriebskostenspiegel).</p>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1">€/m² Nebenkosten<Input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /></label>
        <label className="flex flex-col gap-1">Quelle<Input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Deutscher Mieterbund Betriebskostenspiegel" /></label>
        <label className="flex flex-col gap-1">Jahr<Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <div className="flex items-end"><Button size="sm" variant="outline" disabled={busy} onClick={() => save(enabled)}>Wert speichern</Button></div>
      </div>
    </div>
  );
}

function BenchmarkEditor({ cities, benchmarks }: { cities: string[]; benchmarks: Benchmark[] }) {
  const qc = useQueryClient();
  const year = String(new Date().getFullYear());
  const empty = { city: cities[0] ?? "", rent_cold_sqm: "", utilities_sqm: "", utilities_source_name: "", utilities_source_year: year, furnished_warm_month: "", furnished_source_name: "", furnished_source_year: year, market_tightness: "unspecified", source_name: "", source_url: "", source_year: year, notes: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const s = (v: unknown) => (v == null ? "" : String(v));

  const edit = (b: Benchmark) => setF({
    city: b.city, rent_cold_sqm: s(b.rent_cold_sqm), utilities_sqm: s(b.utilities_sqm), utilities_source_name: s(b.utilities_source_name), utilities_source_year: s(b.utilities_source_year) || year,
    furnished_warm_month: s(b.furnished_warm_month), furnished_source_name: s(b.furnished_source_name), furnished_source_year: s(b.furnished_source_year) || year,
    market_tightness: b.market_tightness, source_name: b.source_name, source_url: s(b.source_url), source_year: String(b.source_year), notes: s(b.notes),
  });
  const validYear = (y: string) => Number(y) >= 2000 && Number(y) <= 2100;

  async function save(): Promise<void> {
    const rent = Number(f.rent_cold_sqm.replace(",", "."));
    const util = f.utilities_sqm.trim() ? Number(f.utilities_sqm.replace(",", ".")) : null;
    const furn = f.furnished_warm_month.trim() ? Number(f.furnished_warm_month.replace(",", ".")) : null;
    if (!f.city.trim() || !(rent > 0 && rent < 100)) { toast.error("Stadt und gültige Kaltmiete €/m² angeben."); return; }
    if (!f.source_name.trim() || !validYear(f.source_year)) { toast.error("Quelle und Jahr der Kaltmiete sind Pflicht."); return; }
    if (util != null && !(util >= 0 && util < 50)) { toast.error("Nebenkosten €/m² ungültig."); return; }
    if (util != null && (!f.utilities_source_name.trim() || !validYear(f.utilities_source_year))) { toast.error("Nebenkosten brauchen eine eigene Quelle und Jahr."); return; }
    if (furn != null && !(furn > 0 && furn < 10000)) { toast.error("Phase-1-Preis ungültig."); return; }
    if (furn != null && (!f.furnished_source_name.trim() || !validYear(f.furnished_source_year))) { toast.error("Phase-1-Preis braucht Quelle und Jahr."); return; }
    if (f.source_url && !/^https?:\/\//i.test(f.source_url)) { toast.error("Quell-Link muss mit http(s):// beginnen."); return; }
    setBusy(true);
    const { error } = await supabase.from("city_housing_benchmarks").upsert({
      city: f.city.trim(), rent_cold_sqm: rent, market_tightness: f.market_tightness,
      utilities_sqm: util, utilities_source_name: util == null ? null : f.utilities_source_name.trim(), utilities_source_year: util == null ? null : Number(f.utilities_source_year),
      furnished_warm_month: furn, furnished_source_name: furn == null ? null : f.furnished_source_name.trim(), furnished_source_year: furn == null ? null : Number(f.furnished_source_year),
      source_name: f.source_name.trim(), source_url: f.source_url.trim() || null, source_year: Number(f.source_year), notes: f.notes.trim() || null,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id,city" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Mietdaten für ${f.city} gespeichert`);
    setF(empty);
    qc.invalidateQueries({ queryKey: ["settlement"] });
  }
  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from("city_housing_benchmarks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["settlement"] });
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Mietdaten erfassen (jeder Wert mit Quelle)</h2>
      <p className="mb-3 text-xs text-muted-foreground">Empfohlene Quellen: offizieller Mietspiegel, BBSR-Wohnungsmarktbeobachtung, Betriebskostenspiegel des Mieterbunds, für Phase 1 z. B. Angebote von Plattformen für möblierte Wohnungen (Datum notieren).</p>
      <datalist id="settle-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="space-y-3 text-sm">
        <fieldset className="grid gap-2 md:grid-cols-4">
          <legend className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Phase 2 · Kaltmiete</legend>
          <label className="flex flex-col gap-1">Stadt<Input list="settle-cities" value={f.city} onChange={set("city")} /></label>
          <label className="flex flex-col gap-1">Kaltmiete €/m²<Input inputMode="decimal" value={f.rent_cold_sqm} onChange={set("rent_cold_sqm")} /></label>
          <label className="flex flex-col gap-1">Quelle<Input value={f.source_name} onChange={set("source_name")} placeholder="z. B. Mietspiegel Leipzig" /></label>
          <label className="flex flex-col gap-1">Jahr<Input type="number" value={f.source_year} onChange={set("source_year")} /></label>
          <label className="flex flex-col gap-1">Quell-Link<Input value={f.source_url} onChange={set("source_url")} placeholder="https://…" /></label>
          <label className="flex flex-col gap-1">Marktdruck
            <select className="h-9 rounded-md border bg-background px-2" value={f.market_tightness} onChange={set("market_tightness")}>
              {Object.entries(TIGHTNESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Notiz<Input value={f.notes} onChange={set("notes")} /></label>
        </fieldset>
        <fieldset className="grid gap-2 md:grid-cols-4">
          <legend className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Nebenkosten (optional)</legend>
          <label className="flex flex-col gap-1">Nebenkosten €/m²<Input inputMode="decimal" value={f.utilities_sqm} onChange={set("utilities_sqm")} /></label>
          <label className="flex flex-col gap-1">Quelle<Input value={f.utilities_source_name} onChange={set("utilities_source_name")} /></label>
          <label className="flex flex-col gap-1">Jahr<Input type="number" value={f.utilities_source_year} onChange={set("utilities_source_year")} /></label>
        </fieldset>
        <fieldset className="grid gap-2 md:grid-cols-4">
          <legend className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Phase 1 · möbliert / WG, warm pro Monat (optional)</legend>
          <label className="flex flex-col gap-1">Warm €/Monat<Input inputMode="decimal" value={f.furnished_warm_month} onChange={set("furnished_warm_month")} /></label>
          <label className="flex flex-col gap-1">Quelle<Input value={f.furnished_source_name} onChange={set("furnished_source_name")} /></label>
          <label className="flex flex-col gap-1">Jahr<Input type="number" value={f.furnished_source_year} onChange={set("furnished_source_year")} /></label>
        </fieldset>
      </div>
      <Button className="mt-3" disabled={busy} onClick={save}>{busy ? "Speichere…" : "Speichern"}</Button>
      {benchmarks.length > 0 && (
        <ul className="mt-4 divide-y text-sm">
          {benchmarks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{b.city}</b> · {num2(b.rent_cold_sqm)} €/m² kalt · {b.source_name} ({b.source_year})</span>
              <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(b)}>Bearbeiten</Button><Button size="sm" variant="outline" onClick={() => remove(b.id)}>Löschen</Button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Explainer() {
  const items: [string, string][] = [
    ["Kaltmiete", "Reine Miete für die Wohnung, ohne Nebenkosten. Darauf beziehen sich Mietspiegel und die Kaution."],
    ["Nebenkosten (Betriebskosten)", "Heizung, Wasser, Müll, Hausmeister, Grundsteuer usw., monatlich als Vorauszahlung, einmal im Jahr abgerechnet. Strom und Internet meist extra."],
    ["Warmmiete", "Kaltmiete + Nebenkosten — das, was du wirklich jeden Monat zahlst. Vermieter prüfen dein Einkommen gegen die Warmmiete."],
    ["Kaution", `Sicherheit für den Vermieter, höchstens ${KAUTION_MONTHS} Kaltmieten (§ 551 BGB), zahlbar in drei Monatsraten. Kommt zusätzlich zur ersten Miete.`],
    ["Warum zuerst möbliert oder WG?", "Für eine reguläre Wohnung verlangen Vermieter meist SCHUFA-Auskunft, drei Gehaltsnachweise und einen Arbeitsvertrag — das hast du bei Ankunft noch nicht. Möblierte Wohnungen und WGs sind teurer, aber erreichbar. Wichtig: nur mit Wohnungsgeberbestätigung, sonst keine Anmeldung."],
  ];
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-semibold">So funktioniert Wohnen in Deutschland</h2>
      <div className="mb-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-md border p-3 text-sm"><b>Phase 1: Ankunft (möbliert/WG mit Wohnungsgeberbestätigung)</b><p className="text-muted-foreground">All-inclusive Warmpreis pro Monat, kurze Laufzeit, keine SCHUFA nötig.</p></div>
        <div className="rounded-md border p-3 text-sm"><b>Phase 2: Reguläre Wohnung (nach Arbeitsvertrag)</b><p className="text-muted-foreground">Kalt- + Nebenkosten = Warmmiete, plus Kaution. Basis der Tabelle und des Runways.</p></div>
      </div>
      <dl className="space-y-2 text-sm">
        {items.map(([t, d]) => <div key={t}><dt className="font-medium">{t}</dt><dd className="text-muted-foreground">{d}</dd></div>)}
      </dl>
    </section>
  );
}

const TIMELINE: [string, string][] = [
  ["Unterkunft mit Wohnungsgeberbestätigung", "Möblierte Zwischenmiete oder WG-Zimmer, das die Bestätigung des Vermieters ausstellt (§ 19 BMG). Hotels meist nicht."],
  ["Anmeldung beim Bürgeramt", "Innerhalb von 2 Wochen nach Einzug (§ 17 BMG). Termin früh online buchen; du bekommst die Meldebescheinigung."],
  ["Steuer-ID", "Kommt automatisch per Post an deine gemeldete Adresse, meist innerhalb weniger Wochen."],
  ["Bankkonto & Krankenversicherung", "Girokonto mit Meldebescheinigung eröffnen; Krankenversicherung muss durchgehend bestehen."],
  ["Job & Arbeitsvertrag", "Mit Steuer-ID und Konto kann der Arbeitgeber dich anstellen und Gehalt zahlen."],
  ["Blaue Karte / Aufenthaltstitel", "Mit dem Arbeitsvertrag bei der Ausländerbehörde den passenden Titel beantragen."],
  ["Reguläre Wohnung", `Mit Arbeitsvertrag, Gehaltsnachweisen und SCHUFA bewerben. Kaution max. ${KAUTION_MONTHS} Kaltmieten; nie vor Besichtigung zahlen.`],
];
const TL_KEY = "smart-de-reise:arrival-timeline";

function ArrivalTimeline() {
  const [done, setDone] = useState<boolean[]>(() => TIMELINE.map(() => false));
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(TL_KEY) ?? "[]"); if (Array.isArray(v)) setDone(TIMELINE.map((_, i) => !!v[i])); } catch { /* ignore */ }
  }, []);
  const toggle = (i: number) => setDone((d) => { const n = d.map((x, j) => (j === i ? !x : x)); localStorage.setItem(TL_KEY, JSON.stringify(n)); return n; });
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 font-semibold">Ankommen mit der Chancenkarte — Zeitstrahl</h2>
      <p className="mb-3 text-xs text-muted-foreground">{done.filter(Boolean).length} von {TIMELINE.length} erledigt · Fortschritt wird nur in diesem Browser gespeichert.</p>
      <ol className="relative space-y-3 border-l pl-5 text-sm">
        {TIMELINE.map(([t, d], i) => (
          <li key={t} className="relative">
            <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border ${done[i] ? "bg-primary" : "bg-background"}`} />
            <label className="flex cursor-pointer gap-2">
              <input type="checkbox" className="mt-1" checked={done[i]} onChange={() => toggle(i)} />
              <span><b className={done[i] ? "line-through" : ""}>{i + 1}. {t}</b><br /><span className="text-muted-foreground">{d}</span></span>
            </label>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">Allgemeine Rechtsgrundlagen, keine Rechtsberatung. Aktuelle Details beim Bürgeramt bzw. make-it-in-germany.com prüfen.</p>
    </section>
  );
}
