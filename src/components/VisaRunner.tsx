import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/components/AppShell";
import { BatchRunnerPanel } from "@/components/BatchRunnerPanel";
import { runVisaBatch, visaPendingCount } from "@/lib/reports.functions";
import { useBatchRunner } from "@/lib/use-batch-runner";
import { VISA_STATUS_LABELS } from "@/lib/visa-labels";

const db = supabase as any;
export async function statusCounts() {
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
  const status = useQuery({ queryKey: ["visa-status"], queryFn: () => statusFn({ data: {} as any }), retry: 1 });
  const counts = useQuery({ queryKey: ["visa-counts"], queryFn: statusCounts, retry: 1 });
  const runner = useBatchRunner(
    () => runFn({ data: { limit: 10 } }),
    () => Promise.all([status.refetch(), counts.refetch()]),
  );

  return (
    <section className="mb-8">
      <div className="mb-3"><h2 className="text-lg font-semibold">Chancenkarte & Arbeitserlaubnis</h2><p className="text-sm text-muted-foreground">Nur wörtliche Formulierungen aus den gespeicherten Stellenbeschreibungen; ohne passende Formulierung bleibt „Keine Angabe“.</p></div>
      <BatchRunnerPanel
        title="Massenanalyse Visum / Arbeitserlaubnis"
        startLabel="Analyse starten"
        runner={runner}
        base={status.data}
        baseError={status.error}
        extraUnavailable={counts.data?.["unavailable"]}
        testId="visa-runner"
      />
      <div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Stellen</th></tr></thead><tbody>
        {Object.entries(VISA_STATUS_LABELS).map(([k, label]) => <tr key={k} className="border-t"><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right font-mono" translate="no">{counts.data ? fmt(counts.data[k]) : "–"}</td></tr>)}
        <tr className="border-t text-muted-foreground"><td className="px-3 py-2">davon Anzeige nicht mehr verfügbar</td><td className="px-3 py-2 text-right font-mono" translate="no">{counts.data ? fmt(counts.data["unavailable"]) : "–"}</td></tr>
      </tbody></table></div>
      {counts.error && <p className="mt-2 text-xs text-destructive">{(counts.error as Error).message}</p>}
    </section>
  );
}
