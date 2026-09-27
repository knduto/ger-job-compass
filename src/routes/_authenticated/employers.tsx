import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, fmtDate } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { must } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/employers")({
  head: () => ({
    meta: [
      { title: "Arbeitgeber — Smart-DE-Reise" },
      { name: "description", content: "Arbeitgeber nach Anzahl offener IT-Stellen, Standorten und Aktivität." },
      { property: "og:title", content: "Arbeitgeber — Smart-DE-Reise" },
      { property: "og:description", content: "Wer stellt in Deutschland IT-Fachkräfte ein?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Employers,
});

function Employers() {
  const [q, setQ] = useState("");
  const res = useQuery({
    queryKey: ["employers", q],
    queryFn: async () => {
      let x = supabase.from("employer_stats").select("*").order("active_jobs", { ascending: false }).limit(200);
      if (q.trim()) x = x.ilike("employer", `%${q.trim().slice(0, 100)}%`);
      return (await must(x)).data ?? [];
    },
  });
  return (
    <>
      <PageHeader title="Arbeitgeber" subtitle="Top 200 nach aktiven IT-Stellen in deiner Datenbank" actions={<Input className="w-64" placeholder="Arbeitgeber suchen…" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr>{["#", "Arbeitgeber", "Aktiv", "Gesamt", "Städte", "Erstmals gesehen", "Zuletzt gesehen"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {(res.data ?? []).map((e, i) => (
              <tr key={e.employer} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2"><Link to="/employers/$name" params={{ name: e.employer! }} className="font-medium hover:underline">{e.employer}</Link></td>
                <td className="px-3 py-2 font-mono">{fmt(e.active_jobs)}</td>
                <td className="px-3 py-2 font-mono">{fmt(e.total_jobs)}</td>
                <td className="px-3 py-2" title={(e.city_list ?? []).join(", ")}>{fmt(e.cities)}</td>
                <td className="px-3 py-2">{fmtDate(e.first_seen)}</td>
                <td className="px-3 py-2">{fmtDate(e.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {res.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Keine Arbeitgeber gefunden.</p>}
      </div>
    </>
  );
}
