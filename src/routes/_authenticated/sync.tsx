import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cityRunStep, finishCityRun, finishSyncRun, startCityRun, startSyncRun, syncOneKeyword } from "@/lib/sync.functions";
import { processLanguageBatch } from "@/lib/reports.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { must } from "@/lib/queries";
import { IT_BERUFSFELDER } from "@/lib/it-fields";
import { RunTable } from "@/components/RunTable";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({
    meta: [
      { title: "Live-Abruf — Smart-DE-Reise" },
      { name: "description", content: "Aktuelle IT-Stellen von der Bundesagentur für Arbeit abrufen und Suchbegriffe verwalten." },
      { property: "og:title", content: "Live-Abruf — Smart-DE-Reise" },
      { property: "og:description", content: "Täglicher und manueller Datenabruf." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SyncPage,
});

function SyncPage() {
  const qc = useQueryClient();
  const start = useServerFn(startSyncRun);
  const one = useServerFn(syncOneKeyword);
  const finish = useServerFn(finishSyncRun);
  const analyse = useServerFn(processLanguageBatch);
  const cityStart = useServerFn(startCityRun);
  const cityStep = useServerFn(cityRunStep);
  const cityFinish = useServerFn(finishCityRun);
  const [cityStatus, setCityStatus] = useState<string | null>(null);
  const [prog, setProg] = useState<{ i: number; n: number; kw: string; fetched: number; new: number } | null>(null);
  const [newTerm, setNewTerm] = useState("");
  const [city, setCity] = useState("");
  const [cityRadius, setCityRadius] = useState("25");
  const [cityMode, setCityMode] = useState<"all" | "keywords">("all");
  const [cityBusy, setCityBusy] = useState(false);

  const kws = useQuery({ queryKey: ["keywords"], queryFn: async () => (await must(supabase.from("search_keywords").select("*").order("term"))).data ?? [] });
  const runs = useQuery({ queryKey: ["runs"], queryFn: async () => (await must(supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(15))).data ?? [], refetchInterval: prog ? 5000 : false });

  async function run() {
    try {
      const r = await start();
      if (!r.keywords.length) { toast.error("Keine aktiven Suchbegriffe."); return; }
      let fetched = 0, nw = 0;
      for (let i = 0; i < r.keywords.length; i++) {
        const kw = r.keywords[i]!;
        setProg({ i, n: r.keywords.length, kw, fetched, new: nw });
        try {
          const c = await one({ data: { runId: r.runId, startedAt: r.startedAt, keyword: r.keywords[i] } });
          fetched += c.fetched; nw += c.new;
          if (c.errors.length) toast.warning(`${r.keywords[i]}: ${c.errors.length} Fehler`);
        } catch (e) {
          toast.error(`${r.keywords[i]}: ${(e as Error).message}`);
        }
      }
      const res = await finish({ data: { runId: r.runId } });
      toast.success(`Abruf fertig (${res.status}): ${nw} neue Stellen, ${res.expired} als abgelaufen markiert.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProg(null);
      qc.invalidateQueries();
    }
  }

  async function addTerm() {
    const t = newTerm.trim().slice(0, 120);
    if (!t) return;
    const { error } = await supabase.from("search_keywords").insert({ term: t });
    if (error) { toast.error(error.message.includes("duplicate") ? "Begriff existiert bereits" : error.message); return; }
    setNewTerm(""); qc.invalidateQueries({ queryKey: ["keywords"] });
  }

  async function runCity() {
    const c = city.trim();
    if (c.length < 2) { toast.error("Bitte eine Stadt eingeben."); return; }
    setCityBusy(true);
    try {
      const radiusKm = Number(cityRadius);
      const s = await cityStart({ data: { mode: cityMode } });
      const t = { fetched: 0, new: 0, updated: 0, errors: 0 };
      const seenRefs = new Set<string>();
      const newRefs = new Set<string>();
      for (let i = 0; i < s.steps.length; i++) {
        const step = s.steps[i];
        if (!step) continue;
        setCityStatus(`${i + 1}/${s.steps.length}: ${step.keyword ?? "Alle IT-Stellen"} · ${step.field} · ${seenRefs.size} gefunden`);
        const r = await cityStep({ data: { runId: s.runId, keyword: step.keyword, field: step.field, city: c, radiusKm, startedAt: s.startedAt } });
        r.refs.forEach((ref) => seenRefs.add(ref));
        r.newRefs.forEach((ref) => newRefs.add(ref));
        t.fetched = seenRefs.size; t.new = newRefs.size; t.updated = t.fetched - t.new; t.errors += r.errors.length;
      }
      const f = await cityFinish({ data: { runId: s.runId, fetched: t.fetched, newCount: t.new, updated: t.updated } });
      if (t.errors) toast.warning(`${t.errors} Fehler – Details im Abruf-Protokoll.`);
      toast.success(`Stadt-Abruf ${c} (${f.status}): ${t.fetched} gefunden, ${t.new} neu, ${t.updated} aktualisiert.`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCityBusy(false);
      setCityStatus(null);
    }
  }

  return (
    <>
      <PageHeader title="Live-Abruf" subtitle="Holt aktuelle Stellen der Bundesagentur für Arbeit – automatisch täglich um 05:00 Uhr (UTC) und jederzeit manuell."
        actions={<Button size="lg" onClick={run} disabled={!!prog}>{prog ? "Läuft…" : "Jetzt abrufen"}</Button>} />
      {prog && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="mb-2 flex justify-between text-sm"><span>Suchbegriff {prog.i + 1}/{prog.n}: <b>{prog.kw}</b></span><span className="font-mono">{prog.fetched} gefunden · {prog.new} neu</span></div>
          <Progress value={(100 * prog.i) / prog.n} />
          <p className="mt-2 text-xs text-muted-foreground">Bitte Seite offen lassen. Anfragen werden bewusst verlangsamt, um die Schnittstelle zu schonen.</p>
        </div>
      )}
       <div className="grid gap-6">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-1 text-lg font-semibold">Stadt-Abruf (On-Demand)</h2>
          <p className="mb-3 text-sm text-muted-foreground">Holt Stellen gezielt für eine Stadt – unabhängig vom täglichen Vollabruf. Stadt-Abrufe markieren keine Stellen als abgelaufen.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Stadt</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="z. B. Leipzig" onKeyDown={(e) => e.key === "Enter" && runCity()} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Umkreis</label>
              <Select value={cityRadius} onValueChange={setCityRadius}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nur Stadt</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="25">25 km</SelectItem>
                  <SelectItem value="50">50 km</SelectItem>
                  <SelectItem value="100">100 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Umfang</label>
              <Select value={cityMode} onValueChange={(v) => setCityMode(v as "all" | "keywords")}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle IT-Stellen der Stadt</SelectItem>
                  <SelectItem value="keywords">Nur meine Suchbegriffe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runCity} disabled={cityBusy || !!prog}>{cityBusy ? "Läuft…" : "Stadt abrufen"}</Button>
            {cityBusy && cityStatus && <span className="text-xs text-muted-foreground">{cityStatus}</span>}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Letzte Abrufe</h2>
          <RunTable runs={runs.data ?? []} />
          <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">So arbeitet der Abruf</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Jeder aktive Suchbegriff wird in genau diesen IT-Berufsfeldern gesucht: {IT_BERUFSFELDER.join(" · ")}.</li>
              <li>Nur Stellenangebote (keine Ausbildung/Praktika) mit Arbeitsort in Deutschland werden gespeichert.</li>
              <li>Doppelte Stellen werden über die Referenznummer zusammengeführt.</li>
              <li>Stellen gelten erst als abgelaufen, wenn sie 3 Tage in vollständigen, fehlerfreien Abrufen fehlen.</li>
            </ul>
          </div>
        </div>
          <aside className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-semibold">Suchbegriffe ({kws.data?.filter((k) => k.active).length ?? 0} aktiv)</h2>
          <div className="mb-3 flex gap-2"><Input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTerm()} placeholder="Neuer Begriff" /><Button onClick={addTerm}>+</Button></div>
            <div className="grid max-h-72 gap-x-6 overflow-y-auto pr-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {(kws.data ?? []).map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted">
                <span className={k.active ? "" : "text-muted-foreground line-through"}>{k.term}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={k.active} onCheckedChange={async (v) => { await supabase.from("search_keywords").update({ active: v }).eq("id", k.id); qc.invalidateQueries({ queryKey: ["keywords"] }); }} />
                  <button className="text-xs text-destructive" onClick={async () => { await supabase.from("search_keywords").delete().eq("id", k.id); qc.invalidateQueries({ queryKey: ["keywords"] }); }}>✕</button>
                </div>
              </div>
            ))}
          </div>
           <Button variant="outline" className="mt-3 w-full" onClick={async () => {
             try { const result = await analyse({ data: { limit: 20 } }); toast.success(`${result.processed} Beschreibungen analysiert`); qc.invalidateQueries(); }
             catch (error) { toast.error((error as Error).message); }
           }}>Sprachanalyse: nächste 20</Button>
        </aside>
      </div>
    </>
  );
}
