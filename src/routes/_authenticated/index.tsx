import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, fmt, fmtDateTime } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { fetchAllCityStats, must } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Übersicht — Smart-DE-Reise" },
      { name: "description", content: "Überblick über gesammelte IT-Stellen, Pipeline und letzte Datenabrufe." },
      { property: "og:title", content: "Übersicht — Smart-DE-Reise" },
      { property: "og:description", content: "Dein IT-Jobmarkt Deutschland auf einen Blick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const q = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [active, total, apps, run, cities] = await Promise.all([
        must(supabase.from("jobs").select("refnr", { count: "exact", head: true }).eq("expired", false)),
        must(supabase.from("jobs").select("refnr", { count: "exact", head: true })),
        must(supabase.from("applications").select("stage")),
        must(supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(1)),
        fetchAllCityStats(),
      ]);
      return { active: active.count ?? 0, total: total.count ?? 0, apps: apps.data ?? [], run: run.data?.[0], cities: cities.slice(0, 8) };
    },
  });
  const d = q.data;
  return (
    <>
      <PageHeader title="Guten Tag." subtitle="Mein Weg bei der Jobsuche — alle Zahlen stammen aus echten Stellen der Bundesagentur für Arbeit." />
      {d && d.total === 0 && (
        <div className="mb-6 rounded-lg border border-accent bg-accent/15 p-5">
          <p className="font-medium">Noch keine Daten gesammelt.</p>
          <p className="mt-1 text-sm text-muted-foreground">Starte den ersten Live-Abruf, um deine Datenbank aufzubauen.</p>
          <Button asChild className="mt-3"><Link to="/sync">Zum Live-Abruf</Link></Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Aktive IT-Stellen" value={fmt(d?.active)} />
        <Stat label="Stellen gesamt (Historie)" value={fmt(d?.total)} />
        <Stat label="In meiner Pipeline" value={fmt(d?.apps.length)} hint={`${d?.apps.filter((a) => a.stage === "applied").length ?? 0} beworben`} />
        <Stat label="Letzter Abruf" value={<span className="text-base">{fmtDateTime(d?.run?.started_at)}</span>} hint={d?.run ? `Status: ${d.run.status}` : undefined} />
      </div>
      <div className="mt-8 rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Top-Städte nach aktiven Stellen</h2>
          <Link to="/reports" className="text-sm underline">Alle Reports</Link>
        </div>
        {(d?.cities ?? []).map((c, i) => (
          <div key={c.city} className="flex items-center gap-4 border-b px-4 py-2 text-sm last:border-0">
            <span className="w-6 font-mono text-muted-foreground">{i + 1}</span>
            <span className="flex-1 font-medium">{c.city}</span>
            <span className="font-mono">{fmt(c.active_jobs)}</span>
            <span className="w-28 text-right text-muted-foreground">+{fmt(c.new_7d)} / 7 Tage</span>
          </div>
        ))}
        {d && d.cities.length === 0 && <p className="p-4 text-sm text-muted-foreground">Noch keine Städtedaten.</p>}
      </div>
    </>
  );
}
