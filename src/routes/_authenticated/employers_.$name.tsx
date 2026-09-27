import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, fmt } from "@/components/AppShell";
import { JobRow, type JobListItem } from "@/components/JobRow";
import { JOB_LIST_COLS, must } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/employers_/$name")({
  head: () => ({
    meta: [
      { title: "Arbeitgeberprofil — Smart-DE-Reise" },
      { name: "description", content: "Alle IT-Stellen eines Arbeitgebers mit Verlauf und Standorten." },
      { property: "og:title", content: "Arbeitgeberprofil — Smart-DE-Reise" },
      { property: "og:description", content: "Einstellungsaktivität eines Arbeitgebers über die Zeit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployerPage,
});

function EmployerPage() {
  const { name } = Route.useParams();
  const res = useQuery({
    queryKey: ["employer", name],
    queryFn: async () => ((await must(supabase.from("jobs").select(JOB_LIST_COLS).eq("employer", name).order("first_seen", { ascending: false }).limit(1000))).data ?? []) as unknown as JobListItem[],
  });
  const jobs = res.data ?? [];
  const active = jobs.filter((j) => !j.expired);
  const byMonth = Object.entries(jobs.reduce<Record<string, number>>((m, j) => { const k = j.first_seen.slice(0, 7); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort().map(([month, n]) => ({ month, n }));
  const cities = [...new Set(active.map((j) => j.city).filter(Boolean))];
  return (
    <>
      <PageHeader title={name} subtitle="Arbeitgeberprofil" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Aktive Stellen" value={fmt(active.length)} />
        <Stat label="Stellen gesamt" value={fmt(jobs.length)} />
        <Stat label="Städte (aktiv)" value={fmt(cities.length)} hint={cities.slice(0, 5).join(", ")} />
        <Stat label="Mit Homeoffice" value={fmt(active.filter((j) => j.homeoffice).length)} />
      </div>
      {byMonth.length > 0 && (
        <div className="mb-6 h-56 rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Neu erfasste Stellen pro Monat</div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="n" name="Stellen" fill="var(--chart-1)" /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="rounded-lg border bg-card">{jobs.map((j) => <JobRow key={j.refnr} job={j} />)}</div>
    </>
  );
}
