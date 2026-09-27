import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, fmt } from "@/components/AppShell";
import { RunTable } from "@/components/RunTable";
import { must } from "@/lib/queries";
import { IT_BERUFSFELDER } from "@/lib/it-fields";

export const Route = createFileRoute("/_authenticated/data-health")({
  head: () => ({
    meta: [
      { title: "Datenqualität — Smart-DE-Reise" },
      { name: "description", content: "Vollständigkeit, Aktualität und Abrufstatus der gesammelten Stellendaten." },
      { property: "og:title", content: "Datenqualität — Smart-DE-Reise" },
      { property: "og:description", content: "Wie vollständig und aktuell ist die Datenbank?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Health,
});

const cnt = async (f: (q: any) => any) => (await must(f(supabase.from("jobs").select("refnr", { count: "exact", head: true })))).count ?? 0;

function Health() {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const stale = new Date(Date.now() - 2 * 86400000).toISOString();
      const [total, active, expired, salary, employer, geo, city, staleN, details, runs, ...fields] = await Promise.all([
        cnt((x) => x), cnt((x) => x.eq("expired", false)), cnt((x) => x.eq("expired", true)),
        cnt((x) => x.eq("expired", false).not("salary_from", "is", null)),
        cnt((x) => x.eq("expired", false).not("employer", "is", null)),
        cnt((x) => x.eq("expired", false).not("lat", "is", null)),
        cnt((x) => x.eq("expired", false).not("city", "is", null)),
        cnt((x) => x.eq("expired", false).lt("last_seen", stale)),
        (async () => (await must(supabase.from("job_details").select("refnr", { count: "exact", head: true }))).count ?? 0)(),
        (async () => (await must(supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(30))).data ?? [])(),
        ...IT_BERUFSFELDER.map((f) => cnt((x) => x.eq("expired", false).contains("berufsfelder", [f]))),
      ]);
      return { total, active, expired, salary, employer, geo, city, staleN, details, runs, fields };
    },
  });
  const d = q.data;
  const pct = (n?: number) => (d && d.active ? `${((100 * (n ?? 0)) / d.active).toFixed(1)} %` : "–");
  const growth = [...(d?.runs ?? [])].reverse().reduce<{ date: string; total: number }[]>((acc, r) => {
    const prev = acc.at(-1)?.total ?? 0; acc.push({ date: r.started_at.slice(0, 10), total: prev + r.new_count }); return acc;
  }, []);
  return (
    <>
      <PageHeader title="Datenqualität" subtitle="Prüfe, wie verlässlich die Zahlen in den Reports sind." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Stellen gesamt" value={fmt(d?.total)} />
        <Stat label="Aktiv" value={fmt(d?.active)} />
        <Stat label="Abgelaufen (behalten)" value={fmt(d?.expired)} />
        <Stat label="Veraltet (>2 Tage nicht gesehen)" value={fmt(d?.staleN)} hint="Noch aktiv, aber im letzten Abruf fehlend" />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Vollständigkeit (aktive Stellen)</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Mit Gehaltsangabe" value={pct(d?.salary)} />
        <Stat label="Mit Arbeitgeber" value={pct(d?.employer)} />
        <Stat label="Mit Stadt" value={pct(d?.city)} />
        <Stat label="Mit Geo-Koordinaten" value={pct(d?.geo)} />
        <Stat label="Details geladen" value={fmt(d?.details)} hint="Beschreibungen werden beim Öffnen geladen" />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Aktive Stellen je IT-Berufsfeld</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {IT_BERUFSFELDER.map((f, i) => <Stat key={f} label={f} value={fmt(d?.fields[i])} />)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Eine Stelle kann mehreren Berufsfeldern zugeordnet sein. Duplikate sind über die Referenznummer ausgeschlossen.</p>
      {growth.length > 1 && (
        <div className="mt-8 h-64 rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Datenbankwachstum (neue Stellen je Abruf, kumuliert, letzte 30 Abrufe)</div>
          <ResponsiveContainer width="100%" height="88%"><AreaChart data={growth}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Area dataKey="total" stroke="var(--chart-2)" fill="var(--chart-1)" /></AreaChart></ResponsiveContainer>
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Abruf-Protokoll</h2>
      <RunTable runs={d?.runs ?? []} />
    </>
  );
}

