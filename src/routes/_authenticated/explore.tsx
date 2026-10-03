import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
  fields: fallback(z.preprocess((v) => (typeof v === "string" ? (v ? [v] : []) : v), z.string().array()), []).default([]),
  contract: fallback(z.string(), "").default(""),
  worktime: fallback(z.string(), "").default(""),
  language: fallback(z.string(), "").default(""),
  visa: fallback(z.string(), "").default(""),
  homeoffice: fallback(z.coerce.boolean(), false).default(false),
  salary: fallback(z.coerce.boolean(), false).default(false),
  days: fallback(z.coerce.number().int().min(0), 0).default(0),
  status: fallback(z.enum(["aktiv", "abgelaufen", "alle"]), "aktiv").default("aktiv"),
  sort: fallback(z.string(), "newest").default("newest"),
  page: fallback(z.coerce.number().int().min(1), 1).default(1),
  per: fallback(z.coerce.number().int(), 25).default(25),
});

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const ESTIMATED_OPTIONS: [string, string][] = [
  ["est:C1-C2", "Geschätzt C1–C2 (verhandlungssicher)"], ["est:B2-C1", "Geschätzt B2–C1 (fließend)"],
  ["est:B1-B2", "Geschätzt B1–B2 (gute Deutschkenntnisse)"], ["est:A2", "Geschätzt A2 (Grundkenntnisse)"],
];
const LANG_COLS = "classification,cefr_level,estimated_cefr,german_required,english_accessible";


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

const PER_OPTIONS = [25, 50, 100] as const;
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function pageList(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => { if (i > 0 && n - (sorted[i - 1] ?? n) > 1) out.push("…"); out.push(n); });
  return out;
}

function Pager({ page, pages, per, loading, onPage, onPer }: { page: number; pages: number; per: number; loading: boolean; onPage: (n: number) => void; onPer: (n: number) => void }) {
  const [jump, setJump] = useState("");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(1)} aria-label="Erste Seite">«</Button>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Zurück</Button>
        {pageList(page, pages).map((n, i) => n === "…"
          ? <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
          : <Button key={n} size="sm" variant={n === page ? "default" : "ghost"} onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}>{n}</Button>)}
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Weiter</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Letzte Seite">»</Button>
        {loading && <span className="ml-2 text-xs text-muted-foreground">Lade…</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Seite {page} von {pages}</span>
        <Input className="h-8 w-20" type="number" min={1} max={pages} placeholder="Gehe zu" value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { const n = Math.round(Number(jump)); if (n >= 1) { onPage(Math.min(n, pages)); setJump(""); } } }} />
        <select className="h-8 rounded-md border bg-background px-2" value={per} onChange={(e) => onPer(Number(e.target.value))} aria-label="Stellen pro Seite">
          {PER_OPTIONS.map((n) => <option key={n} value={n}>{n} / Seite</option>)}
        </select>
      </div>
    </div>
  );
}

function Explore() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/explore" });
  const qc = useQueryClient();
  const set = (patch: Partial<typeof s>) => navigate({ search: (p) => ({ ...p, ...patch, page: patch.page ?? 1 }) });
  const page = Math.max(1, s.page);
  const PER = (PER_OPTIONS as readonly number[]).includes(s.per) ? s.per : 25;
  const listTop = useRef<HTMLElement>(null);
  const goPage = (n: number) => { set({ page: n }); listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const cities = useQuery({ queryKey: ["city_stats"], queryFn: fetchAllCityStats });
  const res = useQuery({
    queryKey: ["explore", s],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const lang = s.language;
      const join = lang === "pending" ? "!left" : lang ? "!inner" : "";
      const visa = s.visa;
      const vjoin = visa === "pending" ? "!left" : visa ? "!inner" : "";
      let q: any = supabase.from("jobs").select(`${JOB_LIST_COLS},job_language_analysis${join}(${LANG_COLS}),job_visa_feasibility${vjoin}(status,flags)`, { count: "exact" });
      if (visa === "pending") q = q.is("job_visa_feasibility", null);
      else if (visa) q = q.eq("job_visa_feasibility.status", visa);
      if (lang === "pending") q = q.is("job_language_analysis", null);
      else if (lang === "required") q = q.eq("job_language_analysis.german_required", true);
      else if (lang === "english") q = q.eq("job_language_analysis.english_accessible", true);
      else if (lang === "optional") q = q.eq("job_language_analysis.classification", "german_optional");
      else if (lang === "unclear") q = q.eq("job_language_analysis.german_required", true).is("job_language_analysis.cefr_level", null).is("job_language_analysis.estimated_cefr", null);
      else if (lang.startsWith("est:")) q = q.eq("job_language_analysis.estimated_cefr", lang.slice(4));
      else if (lang) q = q.eq("job_language_analysis.cefr_level", lang);
      if (s.status === "aktiv") q = q.eq("expired", false);
      else if (s.status === "abgelaufen") q = q.eq("expired", true);
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
      const r: any = await must(q);
      return { rows: (r.data ?? []) as unknown as JobListItem[], count: r.count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((res.data?.count ?? 0) / PER));

  return (
    <>
      <PageHeader title="Jobs erkunden" subtitle={`${fmt(res.data?.count)} Treffer in deiner Datenbank`} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-lg border bg-card p-4 text-sm">
          <div className="space-y-1"><Label>Titel enthält</Label><Input key={`q-${s.q}`} defaultValue={s.q} onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value })} placeholder="z.B. Service Manager (Enter)" /></div>
          <div className="space-y-1"><Label>Arbeitgeber enthält</Label><Input key={`e-${s.employer}`} defaultValue={s.employer} onKeyDown={(e) => e.key === "Enter" && set({ employer: e.currentTarget.value })} placeholder="Enter zum Anwenden" /></div>
          <div className="space-y-1"><Label>Stadt</Label>
            <select className={sel} value={s.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">Alle Städte</option>
              {(cities.data ?? []).map((c) => <option key={c.city} value={c.city!}>{c.city} ({c.active_jobs})</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Sprache</Label>
            <select className={sel} value={s.language} onChange={(e) => set({ language: e.target.value })}>
              <option value="">Alle</option>
              <option value="required">Deutsch erforderlich</option>
              <optgroup label="Explizit genannt">{CEFR_LEVELS.map((v) => <option key={v} value={v}>{v} (explizit)</option>)}</optgroup>
              <optgroup label="Geschätzt (heuristisch)">{ESTIMATED_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>
              <optgroup label="Weitere">
                <option value="unclear">Deutsch erforderlich, Niveau unklar</option>
                <option value="optional">Deutsch (optional)</option>
                <option value="english">Englisch zugänglich</option>
                <option value="pending">Noch nicht analysiert</option>
              </optgroup>
            </select>
          </div>
          <div className="space-y-1"><Label>Visum / Arbeitserlaubnis</Label>
            <select className={sel} value={s.visa} onChange={(e) => set({ visa: e.target.value })}>
              <option value="">Alle</option>
              <option value="international_friendly">International offen</option>
              <option value="work_permit_required">Arbeitserlaubnis vorausgesetzt</option>
              <option value="restricted">Eingeschränkt</option>
              <option value="unspecified">Keine Angabe</option>
              <option value="pending">Noch nicht analysiert</option>
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
          <div className="space-y-1"><Label>Status</Label>
            <select className={sel} value={s.status} onChange={(e) => set({ status: e.target.value as typeof s.status })}>
              <option value="aktiv">Aktiv</option><option value="abgelaufen">Nur abgelaufene</option><option value="alle">Alle</option>
            </select>
          </div>
          <div className="space-y-1"><Label>Sortierung</Label>
            <select className={sel} value={s.sort} onChange={(e) => set({ sort: e.target.value })}>
              <option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="salary">Höchstes Gehalt</option>
            </select>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate({ search: {} as any })}>Filter zurücksetzen</Button>
        </aside>
        <section ref={listTop} className="scroll-mt-4">
          <Pager page={page} pages={pages} per={PER} loading={res.isFetching} onPage={goPage} onPer={(n) => set({ per: n })} />
          <div className={`mt-3 rounded-lg border bg-card transition-opacity ${res.isPlaceholderData ? "opacity-60" : ""}`}>
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
          <div className="mt-3"><Pager page={page} pages={pages} per={PER} loading={res.isFetching} onPage={goPage} onPer={(n) => set({ per: n })} /></div>
        </section>
      </div>
    </>
  );
}
