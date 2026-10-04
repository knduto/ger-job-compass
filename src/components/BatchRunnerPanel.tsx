import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/components/AppShell";
import type { useBatchRunner } from "@/lib/use-batch-runner";

type Runner = ReturnType<typeof useBatchRunner>;

export function BatchRunnerPanel(props: {
  title: string;
  startLabel: string;
  runner: Runner;
  base: { analysed: number; pending: number; total: number } | null | undefined;
  baseError?: unknown;
  extraUnavailable?: number;
  testId: string;
}) {
  const { runner } = props;
  const live = runner.progress ?? props.base ?? null;
  const pct = live?.total ? (100 * live.analysed) / live.total : 0;
  const unavailable = runner.unavailable || props.extraUnavailable || 0;
  return (
    <div className="mb-4 rounded-lg border bg-card p-4" data-testid={props.testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{props.title}</h3>
          <p className="text-xs text-muted-foreground" translate="no" data-testid={`${props.testId}-counter`}>
            {live
              ? `${fmt(live.analysed)} analysiert · ${fmt(live.pending)} offen · ${pct.toFixed(1)} % von ${fmt(live.total)}${unavailable ? ` · ${fmt(unavailable)} nicht mehr verfügbar` : ""}`
              : props.baseError ? (props.baseError as Error).message : "Zählerstand wird geladen…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={runner.state === "running" || live?.pending === 0} onClick={() => void runner.start()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${runner.state === "running" ? "animate-spin" : ""}`} />
            {runner.state === "paused" ? "Fortsetzen" : props.startLabel}
          </Button>
          <Button variant="outline" disabled={runner.state !== "running"} onClick={runner.pause}>Pause</Button>
          <Button variant="outline" disabled={runner.state === "idle"} onClick={runner.stop}>Stopp</Button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <p className="mt-2 text-xs text-muted-foreground" translate="no">
        Kleine Blöcke von 10 Stellen pro Anfrage, aktive zuerst; gespeicherte Beschreibungen werden wiederverwendet, analysierte Stellen nie erneut verarbeitet.
        {runner.batches ? ` ${fmt(runner.batches)} Blöcke in dieser Sitzung.` : ""}
        {runner.state === "paused" ? " Pausiert." : runner.state === "running" ? " Läuft…" : runner.done ? " Abgeschlossen." : ""}
      </p>
      {runner.warning && !runner.error && (
        <p className="mt-2 text-xs text-muted-foreground" translate="no">Hinweis: einzelne Stelle übersprungen — {runner.warning}</p>
      )}
      {runner.error && (
        <div role="alert" className="mt-3 rounded-md border border-destructive bg-destructive/5 p-3 text-sm" data-testid={`${props.testId}-error`}>
          <p className="font-medium">Analyse angehalten</p>
          <p className="mt-1 text-muted-foreground" translate="no">{runner.error}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void runner.start()}>Erneut versuchen</Button>
            <Button size="sm" variant="ghost" onClick={runner.dismissError}>Ausblenden</Button>
          </div>
        </div>
      )}
    </div>
  );
}
