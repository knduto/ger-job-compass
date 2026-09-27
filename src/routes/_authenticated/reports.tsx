import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, fmtDate } from "@/components/AppShell";
import { Slider } from "@/components/ui/slider";
import { fetchAllCityStats, must } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Städte-Reports — Smart-DE-Reise" },
      { name: "description", content: "Top-30 deutsche Städte für IT-Jobs: Volumen, Wachstum, Homeoffice, Arbeitgebervielfalt und gewichteter Score." },
      { property: "og:title", content: "Städte-Reports — Smart-DE-Reise" },
      { property: "og:description", content: "Datenbasiert die passende Stadt für die Chancenkarte wählen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

const WEIGHTS = [
  { k: "volume", label: "Stellenvolumen" },
  { k: "growth", label: "Neue Stellen (7 Tage)" },
  { k: "remote", label: "Homeoffice-Anteil" },
  { k: "permanent", label: "Unbefristet-Anteil" },
  { k: "diversity", label: "Arbeitgebervielfalt" },
] as const;
type WK = (typeof WEIGHTS)[number]["k"];

function Reports() {
  const stats = useQuery({ queryKey: ["city_stats"], queryFn: fetchAllCityStats });
  const share = useQuery({ queryKey: ["city_share"], queryFn: async () => (await must(supabase.from("city_employer_share").select("*").limit(5000))).data ?? [] });
  const [w, setW] = useState<Record<WK, number>>({ volume: 5, growth: 3, remote: 2, permanent: 2, diversity: 3 });
  const [selected, setSelected] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);

  const rows = useMemo(() => {
    const top = (stats.data ?? []).filter((c) => (c.active_jobs ?? 0) > 0).slice(0, 30);
    const shareMap = new Map((share.data ?? []).map((s) => [s.city, Number(s.top_employer_pct ?? 0)]));
    const max = (f: (c: (typeof top)[number]) => number) => Math.max(1, ...top.map(f));
    const mV = max((c) => c.active_jobs ?? 0), mG = max((c) => c.new_7d ?? 0);
    const totalW = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return top.map((c) => {
      const conc = shareMap.get(c.city) ?? 0;
      const parts: Record<WK, number> = {
        volume: (c.active_jobs ?? 0) / mV,
        growth: (c.new_7d ?? 0) / mG,
        remote: Number(c.remote_pct ?? 0) / 100,
        permanent: Number(c.permanent_pct ?? 0) / 100,
        diversity: 1 - conc / 100,
      };
      const score = (WEIGHTS.reduce((s, x) => s + parts[x.k] * w[x.k], 0) / totalW) * 100;
      return { ...c, conc, score };
    }).sort((a, b) => b.score - a.score);
  }, [stats.data, share.data, w]);

  const totalActive = rows.reduce((s, r) => s + (r.active_jobs ?? 0), 0);
  const cmp = rows.filter((r) => selected.includes(r.city!));
  const range = stats.data?.length ? `${fmtDate(stats.data.reduce((m, c) => (c.first_seen! < m ? c.first_seen! : m), stats.data[0]!.first_seen!))} – ${fmtDate(stats.data.reduce((m, c) => (c.last_seen! > m ? c.last_seen! : m), stats.data[0]!.last_seen!))}` : "–";

  return (
    <>
      <PageHeader title="Städte-Reports" subtitle={`Top 30 Städte · Basis: ${fmt(totalActive)} aktive Stellen · Datenzeitraum ${range}`} />
      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">Gewichtung für deinen Standort-Score</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WEIGHTS.map((x) => (
            <div key={x.k} className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{x.label}</span><span className="font-mono">{w[x.k]}</span></div>
              <Slider min={0} max={10} step={1} value={[w[x.k]]} onValueChange={([v]) => setW({ ...w, [x.k]: v })} />
            </div>
          ))}
        </div>
      </div>

      {cmp.length > 1 && (
        <div className="mb-6 h-80 rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Vergleich ({cmp.length} Städte)</div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={cmp.map((c) => ({ city: c.city, "Aktive Stellen": c.active_jobs, "Neu 7T": c.new_7d, Arbeitgeber: c.employers }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="city" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
              <Bar dataKey="Aktive Stellen" fill="var(--chart-2)" /><Bar dataKey="Neu 7T" fill="var(--chart-1)" /><Bar dataKey="Arbeitgeber" fill="var(--chart-4)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Vgl.", "#", "Stadt", "Score", "Aktiv", "Neu 7T", "Neu 30T", "Arbeitgeber", "Top-AG-Anteil", "Homeoffice", "Unbefristet", "Ø Jahresgehalt*"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.city} className={`cursor-pointer border-t hover:bg-muted/50 ${focus === r.city ? "bg-accent/15" : ""}`} onClick={() => setFocus(r.city)}>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(r.city!)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.city!] : selected.filter((x) => x !== r.city))} />
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.city}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded bg-muted"><div className="h-full bg-accent" style={{ width: `${r.score}%` }} /></div><span className="font-mono">{r.score.toFixed(0)}</span></div></td>
                <td className="px-3 py-2 font-mono">{fmt(r.active_jobs)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.new_7d)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.new_30d)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.employers)}</td>
                <td className="px-3 py-2 font-mono">{r.conc.toFixed(0)} %</td>
                <td className="px-3 py-2 font-mono">{r.remote_pct ?? 0} %</td>
                <td className="px-3 py-2 font-mono">{r.permanent_pct ?? 0} %</td>
                <td className="px-3 py-2 font-mono">{r.avg_salary ? `${fmt(r.avg_salary)} €` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Noch keine Daten – starte zuerst einen Live-Abruf.</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">* Ø Jahresgehalt nur aus Anzeigen mit Jahresgehaltsangabe ({"<"} 25 % der Stellen typisch) – als Richtwert lesen. Top-AG-Anteil: Anteil des größten Arbeitgebers an den aktiven Stellen der Stadt (niedriger = breiter Markt).</p>
      {focus && <CityDetail city={focus} />}
    </>
  );
}

function CityDetail({ city }: { city: string }) {
  const res = useQuery({
    queryKey: ["city-detail", city],
    queryFn: async () => (await must(supabase.from("jobs").select("employer,beruf,first_seen").eq("city", city).eq("expired", false).limit(5000))).data ?? [],
  });
  const top = (key: "employer" | "beruf") =>
    Object.entries((res.data ?? []).reduce<Record<string, number>>((m, j) => { const k = j[key] ?? "Unbekannt"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const weekly = Object.entries((res.data ?? []).reduce<Record<string, number>>((m, j) => {
    const d = new Date(j.first_seen); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); m[k] = (m[k] ?? 0) + 1; return m;
  }, {})).sort().map(([week, n]) => ({ week, n }));
  return (
    <div className="mt-8">
      <h2 className="mb-4 text-2xl font-semibold">{city} im Detail <span className="text-sm font-normal text-muted-foreground">({fmt(res.data?.length)} aktive Stellen)</span></h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {[["Top-Arbeitgeber", top("employer")], ["Top-Berufe", top("beruf")]].map(([t, list]) => (
          <div key={t as string} className="rounded-lg border bg-card p-4 text-sm">
            <div className="mb-2 font-semibold">{t as string}</div>
            {(list as [string, number][]).map(([k, n]) => <div key={k} className="flex justify-between border-b py-1 last:border-0"><span className="truncate pr-2">{k}</span><span className="font-mono">{n}</span></div>)}
          </div>
        ))}
        <div className="h-72 rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Neu erfasste Stellen pro Woche</div>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="week" fontSize={10} /><YAxis allowDecimals={false} fontSize={10} /><Tooltip /><Bar dataKey="n" name="Neu" fill="var(--chart-1)" /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
