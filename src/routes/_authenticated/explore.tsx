import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt } from "@/components/AppShell";
import { JobRow, type JobListItem } from "@/components/JobRow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IT_BERUFSFELDER } from "@/lib/it-fields";
import { JOB_LIST_COLS, fetchAllCityStats, must, saveToPipeline } from "@/lib/queries";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  employer: fallback(z.string(), "").default(""),
  fields: fallback(z.string().array(), []).default([]),
  contract: fallback(z.string(), "").default(""),
  worktime: fallback(z.string(), "").default(""),
  homeoffice: fallback(z.boolean(), false).default(false),
  salary: fallback(z.boolean(), false).default(false),
  days: fallback(z.number(), 0).default(0),
  expired: fallback(z.boolean(), false).default(false),
  sort: fallback(z.string(), "newest").default("newest"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/explore")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Jobs erkunden — Smart-DE-Reise" },
      { name: "description", content: "IT-Stellen in Deutschland nach Berufsfeld, Stadt, Arbeitgeber, Vertrag und mehr filtern." },
      { property: "og:title", content: "Jobs erkunden — Smart-DE-Reise" },
      { property: "og:description", content: "Gefilterte IT-Stellen aus der Bundesagentur für Arbeit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explore,
});

const PER = 25;
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function Explore() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/explore" });
  const qc = useQueryClient();
  const set = (patch: Partial<typeof s>) => navigate({ search: (p) => ({ ...p, ...patch, page: patch.page ?? 1 }) });
  const page = Math.max(1, s.page);

  const cities = useQuery({ queryKey: ["city_stats"], queryFn: fetchAllCityStats });
  const res = useQuery({
    queryKey: ["explore", s],
    queryFn: async () => {
      let q = supabase.from("jobs").select(JOB_LIST_COLS, { count: "exact" });
      if (!s.expired) q = q.eq("expired", false);
      if (s.q.trim()) q = q.ilike("title", `%${s.q.trim().slice(0, 100)}%`);
      if (s.city) q = q.eq("city", s.city);
      if (s.employer.trim()) q = q.ilike("employer", `%${s.employer.trim().slice(0, 100)}%`);
      if (s.fields.length) q = q.overlaps("berufsfelder", s.fields);
      if (s.contract) q = q.eq("contract", s.contract);
      if (s.worktime === "voll") q = q.eq("fulltime", true);
      if (s.worktime === "teil") q = q.eq("parttime", true);
      if (s.homeoffice) q = q.eq("homeoffice", true);
      if (s.salary) q = q.not("salary_from", "is", null);
      if (s.days > 0) q = q.gte("published_from", new Date(Date.now() - s.days * 86400000).toISOString().slice(0, 10));
      if (s.sort === "salary") q = q.order("salary_from", { ascending: false, nullsFirst: false });
      else if (s.sort === "oldest") q = q.order("published_from", { ascending: true });
      else q = q.order("published_from", { ascending: false, nullsFirst: false });
      q = q.range((page - 1) * PER, page * PER - 1);
      const r = await must(q);
      return { rows: (r.data ?? []) as unknown as JobListItem[], count: r.count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((res.data?.count ?? 0) / PER));

  return (
    <>
      <PageHeader title="Jobs erkunden" subtitle={`${fmt(res.data?.count)} Treffer in deiner Datenbank`} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-lg border bg-card p-4 text-sm">
          <div className="space-y-1"><Label>Titel enthält</Label><Input defaultValue={s.q} onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value })} onBlur={(e) => e.currentTarget.value !== s.q && set({ q: e.currentTarget.value })} placeholder="z.B. Service Manager" /></div>
          <div className="space-y-1"><Label>Arbeitgeber enthält</Label><Input defaultValue={s.employer} onKeyDown={(e) => e.key === "Enter" && set({ employer: e.currentTarget.value })} onBlur={(e) => e.currentTarget.value !== s.employer && set({ employer: e.currentTarget.value })} /></div>
          <div className="space-y-1"><Label>Stadt</Label>
            <select className={sel} value={s.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">Alle Städte</option>
              {(cities.data ?? []).map((c) => <option key={c.city} value={c.city!}>{c.city} ({c.active_jobs})</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label>IT-Berufsfeld</Label>
            {IT_BERUFSFELDER.map((f) => (
              <label key={f} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={s.fields.includes(f)} onChange={(e) => set({ fields: e.target.checked ? [...s.fields, f] : s.fields.filter((x) => x !== f) })} />
                <span>{f}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1"><Label>Vertrag</Label>
            <select className={sel} value={s.contract} onChange={(e) => set({ contract: e.target.value })}>
              <option value="">Alle</option><option value="UNBEFRISTET">Unbefristet</option><option value="BEFRISTET">Befristet</option><option value="KEINE_ANGABE">Keine Angabe</option>
            </select>
          </div>
          <div className="space-y-1"><Label>Arbeitszeit</Label>
            <select className={sel} value={s.worktime} onChange={(e) => set({ worktime: e.target.value })}>
              <option value="">Alle</option><option value="voll">Vollzeit</option><option value="teil">Teilzeit</option>
            </select>
          </div>
          <div className="space-y-1"><Label>Veröffentlicht seit</Label>
            <select className={sel} value={s.days} onChange={(e) => set({ days: Number(e.target.value) })}>
              <option value={0}>Beliebig</option><option value={1}>1 Tag</option><option value={7}>7 Tagen</option><option value={14}>14 Tagen</option><option value={28}>28 Tagen</option>
            </select>
          </div>
          <label className="flex items-center justify-between">Nur Homeoffice <Switch checked={s.homeoffice} onCheckedChange={(v) => set({ homeoffice: v })} /></label>
          <label className="flex items-center justify-between">Nur mit Gehaltsangabe <Switch checked={s.salary} onCheckedChange={(v) => set({ salary: v })} /></label>
          <label className="flex items-center justify-between">Abgelaufene zeigen <Switch checked={s.expired} onCheckedChange={(v) => set({ expired: v })} /></label>
          <div className="space-y-1"><Label>Sortierung</Label>
            <select className={sel} value={s.sort} onChange={(e) => set({ sort: e.target.value })}>
              <option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="salary">Höchstes Gehalt</option>
            </select>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate({ search: {} as any })}>Filter zurücksetzen</Button>
        </aside>
        <section>
          <div className="rounded-lg border bg-card">
            {res.isLoading && <p className="p-4 text-sm text-muted-foreground">Lade…</p>}
            {res.error && <p className="p-4 text-sm text-destructive">{(res.error as Error).message}</p>}
            {res.data?.rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Keine Stellen für diese Filter.</p>}
            {res.data?.rows.map((j) => (
              <JobRow key={j.refnr} job={j} action={
                <Button size="sm" variant="outline" onClick={async () => {
                  try { await saveToPipeline(j.refnr); toast.success("In Pipeline gespeichert"); qc.invalidateQueries({ queryKey: ["applications"] }); }
                  catch (e) { toast.error((e as Error).message); }
                }}>+ Pipeline</Button>
              } />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Zurück</Button>
            <span>Seite {page} von {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Weiter</Button>
          </div>
        </section>
      </div>
    </>
  );
}
