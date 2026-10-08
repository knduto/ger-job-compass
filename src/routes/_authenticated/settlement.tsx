import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Stat, fmt, fmtDateTime } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { getSettlementData, type SettlementData } from "@/lib/settlement.functions";
import { buildSettlementRows, KAUTION_MONTHS, TIGHTNESS, type Benchmark } from "@/lib/settlement-metrics";

export const Route = createFileRoute("/_authenticated/settlement")({
  head: () => ({ meta: [
    { title: "Wohnen & Ankommen — Smart-DE-Reise" },
    { name: "description", content: "Mietkosten, Kaution und Budget je Stadt aus quellenbelegten Mietspiegel-Werten, kombiniert mit gespeicherten IT-Stellen." },
    { property: "og:title", content: "Wohnen & Ankommen — Smart-DE-Reise" },
    { property: "og:description", content: "Quellenbelegter Wohnkosten- und Ankunftsvergleich deutscher Städte für die Chancenkarte." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SettlementPage,
});

const eur = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("de-DE")} €`);

function SettlementPage() {
  const fn = useServerFn(getSettlementData);
  const q = useQuery({ queryKey: ["settlement"], queryFn: () => fn(), staleTime: 5 * 60_000 });
  return (
    <>
      <PageHeader title="Wohnen & Ankommen" subtitle="Mietkosten nur aus von dir erfassten, quellenbelegten Werten · Stellenzahlen aus deiner Datenbank" />
      {q.isLoading && <p className="text-sm text-muted-foreground">Lade Datenbasis…</p>}
      {q.error && <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{(q.error as Error).message} <Button size="sm" variant="outline" className="ml-2" onClick={() => q.refetch()}>Erneut versuchen</Button></div>}
      {q.data && <SectionErrorBoundary title="Wohnen & Ankommen konnte nicht angezeigt werden"><Settlement data={q.data} /></SectionErrorBoundary>}
    </>
  );
}

function Settlement({ data }: { data: SettlementData }) {
  const [sqm, setSqm] = useState(35);
  const [budget, setBudget] = useState(1091);
  const rows = useMemo(() => buildSettlementRows(data.cities, data.jobsByCity, data.benchmarks as Benchmark[], sqm, budget), [data, sqm, budget]);
  const withData = rows.filter((r) => r.b);
  const cheapest = withData[0];
  const bestValue = [...withData].sort((a, z) => (z.jobsPer100 ?? 0) - (a.jobsPer100 ?? 0))[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Städte mit Mietdaten" value={`${withData.length} / ${rows.length}`} hint={data.usingTracked ? "Deine verfolgten Städte" : "Top 30 nach aktiven Stellen"} />
        <Stat label="Günstigster Start" value={cheapest?.city ?? "—"} hint={cheapest ? `Startkapital ${eur(cheapest.upfront)}` : "Noch keine Mietwerte erfasst"} />
        <Stat label="Bestes Stellen/Miete-Verhältnis" value={bestValue?.city ?? "—"} hint={bestValue ? `${bestValue.jobsPer100?.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Stellen je 100 € Miete` : undefined} />
        <Stat label="Kaution" value={`${KAUTION_MONTHS} × Kaltmiete`} hint="Gesetzliches Maximum (§ 551 BGB)" />
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold">Budget-Simulator</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">Wohnfläche (m²) <Input type="number" min={10} max={150} value={sqm} onChange={(e) => setSqm(Math.max(10, Number(e.target.value) || 0))} className="w-24" /></label>
          <label className="flex items-center gap-2">Monatsbudget (€) <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} className="w-28" /></label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Monatsbudget bitte selbst prüfen (z. B. aktueller Sperrkonto-Betrag laut Auswärtigem Amt). Warmmiete wird nur berechnet, wenn Nebenkosten mit Quelle erfasst sind; sonst wird die Kaltmiete verwendet.</p>
      </section>

      <section className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b">{["Stadt", "IT-Stellen (DB)", "€/m² kalt", "Kaltmiete", "Warmmiete", "Kaution", "Startkapital", "Rest vom Budget", "Marktdruck", "Quelle"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.city} className="border-b last:border-0">
                <td className="p-3 font-medium">{r.city}</td>
                <td className="p-3 font-mono">{fmt(r.activeJobs)}</td>
                {r.b ? (<>
                  <td className="p-3 font-mono">{Number(r.b.rent_cold_sqm).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 font-mono">{eur(r.cold)}</td>
                  <td className="p-3 font-mono">{eur(r.warm)}</td>
                  <td className="p-3 font-mono">{eur(r.kaution)}</td>
                  <td className="p-3 font-mono">{eur(r.upfront)}</td>
                  <td className={`p-3 font-mono ${(r.rentShare ?? 0) > 40 ? "text-destructive" : ""}`}>{eur(r.residual)}{r.rentShare != null && <span className="ml-1 text-xs text-muted-foreground">({Math.round(r.rentShare)} % Miete)</span>}</td>
                  <td className="p-3">{TIGHTNESS[r.b.market_tightness] ?? "—"}</td>
                  <td className="p-3 text-xs">{r.b.source_url ? <a className="underline" href={r.b.source_url} target="_blank" rel="noreferrer">{r.b.source_name}</a> : r.b.source_name} ({r.b.source_year})</td>
                </>) : <td colSpan={8} className="p-3 text-xs text-muted-foreground">Keine quellenbelegten Mietdaten — unten erfassen.</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BenchmarkEditor cities={data.cities} benchmarks={data.benchmarks as Benchmark[]} />
      <ArrivalGuide />
      <p className="text-xs text-muted-foreground">Datenbasis: Stellen aus deiner Datenbank (Stand {fmtDateTime(data.generatedAt)}). Mietwerte ausschließlich aus deinen Einträgen mit Quellenangabe; fehlende Werte werden nie geschätzt. Formeln: Kaltmiete = €/m² × Fläche; Kaution = {KAUTION_MONTHS} × Kaltmiete; Startkapital = Kaution + erste Monatsmiete.</p>
    </div>
  );
}

function BenchmarkEditor({ cities, benchmarks }: { cities: string[]; benchmarks: Benchmark[] }) {
  const qc = useQueryClient();
  const empty = { city: cities[0] ?? "", rent_cold_sqm: "", utilities_sqm: "", market_tightness: "unspecified", source_name: "", source_url: "", source_year: String(new Date().getFullYear()), notes: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const edit = (b: Benchmark) => setF({ city: b.city, rent_cold_sqm: String(b.rent_cold_sqm), utilities_sqm: b.utilities_sqm == null ? "" : String(b.utilities_sqm), market_tightness: b.market_tightness, source_name: b.source_name, source_url: b.source_url ?? "", source_year: String(b.source_year), notes: b.notes ?? "" });

  async function save(): Promise<void> {
    const rent = Number(f.rent_cold_sqm.replace(",", "."));
    const util = f.utilities_sqm.trim() ? Number(f.utilities_sqm.replace(",", ".")) : null;
    if (!f.city.trim() || !(rent > 0 && rent < 100)) { toast.error("Stadt und gültige Kaltmiete €/m² angeben."); return; }
    if (util != null && !(util >= 0 && util < 50)) { toast.error("Nebenkosten €/m² ungültig."); return; }
    if (!f.source_name.trim()) { toast.error("Quelle ist Pflicht — keine Werte ohne Beleg."); return; }
    if (f.source_url && !/^https?:\/\//i.test(f.source_url)) { toast.error("Quell-Link muss mit http(s):// beginnen."); return; }
    setBusy(true);
    const { error } = await supabase.from("city_housing_benchmarks").upsert({
      city: f.city.trim(), rent_cold_sqm: rent, utilities_sqm: util, market_tightness: f.market_tightness,
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
      <h2 className="font-semibold">Mietdaten erfassen (mit Quelle)</h2>
      <p className="mb-3 text-xs text-muted-foreground">Empfohlene Quellen: offizieller Mietspiegel der Stadt, BBSR-Wohnungsmarktbeobachtung, Statistisches Landesamt. Jeder Wert braucht Quelle und Jahr.</p>
      <div className="grid gap-2 text-sm md:grid-cols-4">
        <label className="flex flex-col gap-1">Stadt<Input list="settle-cities" value={f.city} onChange={set("city")} /></label>
        <datalist id="settle-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        <label className="flex flex-col gap-1">Kaltmiete €/m²<Input inputMode="decimal" value={f.rent_cold_sqm} onChange={set("rent_cold_sqm")} /></label>
        <label className="flex flex-col gap-1">Nebenkosten €/m² (optional)<Input inputMode="decimal" value={f.utilities_sqm} onChange={set("utilities_sqm")} /></label>
        <label className="flex flex-col gap-1">Marktdruck
          <select className="h-9 rounded-md border bg-background px-2" value={f.market_tightness} onChange={set("market_tightness")}>
            {Object.entries(TIGHTNESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Quelle<Input value={f.source_name} onChange={set("source_name")} placeholder="z. B. Mietspiegel Leipzig" /></label>
        <label className="flex flex-col gap-1">Quell-Link<Input value={f.source_url} onChange={set("source_url")} placeholder="https://…" /></label>
        <label className="flex flex-col gap-1">Jahr<Input type="number" value={f.source_year} onChange={set("source_year")} /></label>
        <label className="flex flex-col gap-1">Notiz<Input value={f.notes} onChange={set("notes")} /></label>
      </div>
      <Button className="mt-3" disabled={busy} onClick={save}>{busy ? "Speichere…" : "Speichern"}</Button>
      {benchmarks.length > 0 && (
        <ul className="mt-4 divide-y text-sm">
          {benchmarks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{b.city}</b> · {Number(b.rent_cold_sqm).toLocaleString("de-DE")} €/m² · {b.source_name} ({b.source_year})</span>
              <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(b)}>Bearbeiten</Button><Button size="sm" variant="outline" onClick={() => remove(b.id)}>Löschen</Button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ArrivalGuide() {
  const steps = [
    ["Unterkunft mit Wohnungsgeberbestätigung", "Für die Anmeldung brauchst du eine Bestätigung des Vermieters (§ 19 BMG). Hotels und viele Ferienwohnungen stellen sie nicht aus — möblierte Zwischenmiete oder WG-Zimmer klären das vorab."],
    ["Anmeldung beim Bürgeramt", "Innerhalb von 2 Wochen nach Einzug (§ 17 BMG). Termine früh online buchen; in großen Städten oft Wochen Vorlauf."],
    ["Steuer-ID", "Kommt automatisch per Post nach der Anmeldung — wichtig für den ersten Arbeitsvertrag."],
    ["Bankkonto & Krankenversicherung", "Girokonto mit Meldebescheinigung eröffnen; Krankenversicherung muss für die Chancenkarte durchgehend bestehen."],
    ["Mietvertrag prüfen", `Kaution max. ${KAUTION_MONTHS} Nettokaltmieten, zahlbar in 3 Raten (§ 551 BGB). Keine Zahlung vor Besichtigung.`],
  ];
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-semibold">Ankommen mit der Chancenkarte</h2>
      <ol className="space-y-2 text-sm">
        {steps.map(([t, d], i) => <li key={t}><b>{i + 1}. {t}</b> — <span className="text-muted-foreground">{d}</span></li>)}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">Allgemeine Rechtsgrundlagen, keine Rechtsberatung. Aktuelle Details beim Bürgeramt bzw. make-it-in-germany.com prüfen.</p>
    </section>
  );
}
