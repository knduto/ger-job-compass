import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { finishSyncRun, startSyncRun, syncOneKeyword } from "@/lib/sync.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { must } from "@/lib/queries";
import { IT_BERUFSFELDER } from "@/lib/it-fields";
import { RunTable } from "./data-health";

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
  const [prog, setProg] = useState<{ i: number; n: number; kw: string; fetched: number; new: number } | null>(null);
  const [newTerm, setNewTerm] = useState("");

  const kws = useQuery({ queryKey: ["keywords"], queryFn: async () => (await must(supabase.from("search_keywords").select("*").order("term"))).data ?? [] });
  const runs = useQuery({ queryKey: ["runs"], queryFn: async () => (await must(supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(15))).data ?? [], refetchInterval: prog ? 5000 : false });

  async function run() {
    try {
      const r = await start();
      if (!r.keywords.length) return toast.error("Keine aktiven Suchbegriffe.");
      let fetched = 0, nw = 0;
      for (let i = 0; i < r.keywords.length; i++) {
        setProg({ i, n: r.keywords.length, kw: r.keywords[i], fetched, new: nw });
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
    if (error) return toast.error(error.message.includes("duplicate") ? "Begriff existiert bereits" : error.message);
    setNewTerm(""); qc.invalidateQueries({ queryKey: ["keywords"] });
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
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
          <div className="max-h-[480px] space-y-1 overflow-y-auto text-sm">
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
        </aside>
      </div>
    </>
  );
}
