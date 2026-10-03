import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmt } from "@/components/AppShell";
import { runVisaBatch, visaPendingCount } from "@/lib/reports.functions";
import { VISA_STATUS_LABELS } from "@/lib/visa-labels";

const db = supabase as any;
async function statusCounts() {
  const out: Record<string, number> = {};
  for (const s of Object.keys(VISA_STATUS_LABELS)) {
    const r = await db.from("job_visa_feasibility").select("refnr", { count: "exact", head: true }).eq("status", s);
    if (r.error) throw new Error(r.error.message);
    out[s] = r.count ?? 0;
  }
  const u = await db.from("job_visa_feasibility").select("refnr", { count: "exact", head: true }).contains("flags", ["unavailable"]);
  if (u.error) throw new Error(u.error.message);
  out["unavailable"] = u.count ?? 0;
  return out;
}

export function VisaRunner() {
  const runFn = useServerFn(runVisaBatch);
  const statusFn = useServerFn(visaPendingCount);
  const status = useQuery({ queryKey: ["visa-status"], queryFn: () => statusFn({ data: {} as any }) });
  const counts = useQuery({ queryKey: ["visa-counts"], queryFn: statusCounts });
  const [state, setState] = useState<"idle" | "running" | "paused">("idle");
  const ctl = useRef<"run" | "pause" | "stop">("run");
  const c = () => ctl.current as "run" | "pause" | "stop";
  const [progress, setProgress] = useState<{ analysed: number; pending: number; total: number } | null>(null);
  const [unavailable, setUnavailable] = useState(0);
  const live = progress ?? status.data ?? null;
  const pct = live?.total ? (100 * live.analysed) / live.total : 0;

  async function run() {
    ctl.current = "run"; setState("running");
    try {
      for (;;) {
        if (c() === "stop") break;
        if (c() === "pause") { setState("paused"); return; }
        const r = await runFn({ data: { limit: 25 } });
        if (r.errors.length) toast.error(r.errors[0]);
        if (r.unavailable) setUnavailable((n) => n + r.unavailable);
        setProgress((c) => { const total = c?.total ?? live?.total ?? r.pending + r.processed; return { total, pending: r.pending, analysed: Math.max(0, total - r.pending) }; });
        if (r.pending === 0 || r.requested === 0 || r.processed + r.unavailable === 0) break;
      }
      toast.success("Visum-Analyse abgeschlossen");
    } catch (e) { toast.error((e as Error).message); }
    finally { if (c() !== "pause") { setState("idle"); await Promise.all([status.refetch(), counts.refetch()]); } }
  }

  return (
    <section className="mb-8">
      <div className="mb-3"><h2 className="text-lg font-semibold">Chancenkarte & Arbeitserlaubnis</h2><p className="text-sm text-muted-foreground">Nur wörtliche Formulierungen aus den gespeicherten Stellenbeschreibungen; ohne passende Formulierung bleibt „Keine Angabe“.</p></div>
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Massenanalyse Visum / Arbeitserlaubnis</h3>
            <p className="text-xs text-muted-foreground">{live ? `${fmt(live.analysed)} analysiert · ${fmt(live.pending)} offen · ${pct.toFixed(1)} % von ${fmt(live.total)} · ${fmt(unavailable || counts.data?.["unavailable"] || 0)} nicht mehr verfügbar` : status.error ? (status.error as Error).message : "Zählerstand wird geladen…"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={state === "running" || live?.pending === 0} onClick={run}><RefreshCw className={`mr-2 h-4 w-4 ${state === "running" ? "animate-spin" : ""}`} />{state === "paused" ? "Fortsetzen" : "Analyse starten"}</Button>
            <Button variant="outline" disabled={state !== "running"} onClick={() => { ctl.current = "pause"; }}>Pause</Button>
            <Button variant="outline" disabled={state === "idle"} onClick={() => { ctl.current = "stop"; setState("idle"); void status.refetch(); void counts.refetch(); }}>Stopp</Button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <p className="mt-2 text-xs text-muted-foreground">Blöcke von 25 Stellen, aktive zuerst; analysierte Stellen werden nie erneut verarbeitet. {state === "paused" ? "Pausiert." : state === "running" ? "Läuft…" : ""}</p>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Stellen</th></tr></thead><tbody>
        {Object.entries(VISA_STATUS_LABELS).map(([k, label]) => <tr key={k} className="border-t"><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right font-mono">{counts.data ? fmt(counts.data[k]) : "–"}</td></tr>)}
        <tr className="border-t text-muted-foreground"><td className="px-3 py-2">davon Anzeige nicht mehr verfügbar</td><td className="px-3 py-2 text-right font-mono">{counts.data ? fmt(counts.data["unavailable"]) : "–"}</td></tr>
      </tbody></table></div>
    </section>
  );
}
