import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/components/AppShell";
import { BatchRunnerPanel } from "@/components/BatchRunnerPanel";
import { runTechBatch, techPendingCount } from "@/lib/reports.functions";
import { useBatchRunner } from "@/lib/use-batch-runner";
import { REMOTE_LABELS, SENIORITY_LABELS } from "@/lib/tech-stack";

const db = supabase as any;

type Agg = { analysed: number; unavailable: number; core: [string, number][]; bonus: [string, number][]; seniority: Record<string, number>; remote: Record<string, number> };

/** Aggregates all stored rows (paged) — counts come only from the database. */
export async function aggregate(): Promise<Agg> {
  const core = new Map<string, number>(), bonus = new Map<string, number>();
  const seniority: Record<string, number> = {}, remote: Record<string, number> = {};
  let analysed = 0, unavailable = 0;
  for (let from = 0; ; from += 1000) {
    const r = await db.from("job_tech_stack").select("core_skills,bonus_skills,seniority,remote_mode,flags").order("refnr").range(from, from + 999);
    if (r.error) throw new Error(r.error.message);
    const rows = r.data ?? [];
    for (const row of rows) {
      if (row.flags?.includes("unavailable")) { unavailable++; continue; }
      analysed++;
      for (const s of row.core_skills ?? []) core.set(s, (core.get(s) ?? 0) + 1);
      for (const s of row.bonus_skills ?? []) bonus.set(s, (bonus.get(s) ?? 0) + 1);
      seniority[row.seniority] = (seniority[row.seniority] ?? 0) + 1;
      remote[row.remote_mode] = (remote[row.remote_mode] ?? 0) + 1;
    }
    if (rows.length < 1000) break;
  }
  const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
  return { analysed, unavailable, core: top(core, 15), bonus: top(bonus, 10), seniority, remote };
}

function Dist({ title, labels, data, base }: { title: string; labels: Record<string, string>; data: Record<string, number> | undefined; base: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm"><tbody>
        {Object.entries(labels).map(([k, label]) => {
          const n = data?.[k] ?? 0;
          return <tr key={k} className="border-t first:border-0"><td className="py-1.5">{label}</td><td className="py-1.5 text-right font-mono" translate="no">{data ? fmt(n) : "–"}</td><td className="w-16 py-1.5 text-right text-muted-foreground" translate="no">{data && base ? `${Math.round((100 * n) / base)} %` : ""}</td></tr>;
        })}
      </tbody></table>
    </div>
  );
}

function Top({ title, rows, base }: { title: string; rows: [string, number][] | undefined; base: number }) {
  const max = rows?.[0]?.[1] ?? 1;
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {!rows ? <p className="text-sm text-muted-foreground">Lade…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Daten.</p> : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(([name, n]) => (
            <li key={name}>
              <div className="flex justify-between"><span translate="no">{name}</span><span className="font-mono text-muted-foreground" translate="no">{fmt(n)} · {base ? Math.round((100 * n) / base) : 0} %</span></div>
              <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(100 * n) / max}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TechStackRunner() {
  const runFn = useServerFn(runTechBatch);
  const statusFn = useServerFn(techPendingCount);
  const status = useQuery({ queryKey: ["tech-status"], queryFn: () => statusFn({ data: {} as any }), retry: 1 });
  const agg = useQuery({ queryKey: ["tech-agg"], queryFn: aggregate, retry: 1 });
  const runner = useBatchRunner(
    () => runFn({ data: { limit: 10 } }),
    () => Promise.all([status.refetch(), agg.refetch()]),
  );
  const base = agg.data?.analysed ?? 0;
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Tech-Stack & Anforderungen</h2>
        <p className="text-sm text-muted-foreground">Nur wörtlich genannte Technologien aus den gespeicherten Stellenbeschreibungen (kuratierte Liste), verneinte Nennungen werden ignoriert. Bonus = ausdrücklich „wünschenswert / von Vorteil / nice to have“.</p>
      </div>
      <BatchRunnerPanel title="Massenanalyse Tech-Stack" startLabel="Analyse starten" runner={runner} base={status.data} baseError={status.error} extraUnavailable={agg.data?.unavailable} testId="tech-runner" />
      <p className="mb-3 text-xs text-muted-foreground" translate="no">
        Datenbasis: {fmt(base)} ausgewertete Stellen von {status.data ? fmt(status.data.total) : "–"} gespeicherten{agg.data?.unavailable ? ` · ${fmt(agg.data.unavailable)} Anzeigen nicht mehr verfügbar (ausgeschlossen)` : ""}. Prozentwerte beziehen sich auf die ausgewerteten Stellen.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Top title="Top-Kernkompetenzen" rows={agg.data?.core} base={base} />
        <Top title="Top-Bonuskompetenzen" rows={agg.data?.bonus} base={base} />
        <Dist title="Seniorität" labels={SENIORITY_LABELS} data={agg.data?.seniority} base={base} />
        <Dist title="Arbeitsmodell" labels={REMOTE_LABELS} data={agg.data?.remote} base={base} />
      </div>
      {agg.error && <p className="mt-2 text-xs text-destructive">{(agg.error as Error).message}</p>}
    </section>
  );
}
