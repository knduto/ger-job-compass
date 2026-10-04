import { useRef, useState } from "react";

export type RunnerBatch = {
  requested: number;
  processed: number;
  unavailable: number;
  timedOut: boolean;
  errors: string[];
  total: number;
  analysed: number;
  pending: number;
};

export type RunnerState = "idle" | "running" | "paused";
const PAUSE_BETWEEN_BATCHES_MS = 800;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Client loop for server-side mass analyses: one small batch per request, short pause between,
 * stops cleanly on a failed request or a batch without progress and keeps the message inline.
 */
export function useBatchRunner(runBatch: () => Promise<RunnerBatch>, onSettled: () => Promise<unknown> | void) {
  const [state, setState] = useState<RunnerState>("idle");
  const [progress, setProgress] = useState<{ analysed: number; pending: number; total: number } | null>(null);
  const [unavailable, setUnavailable] = useState(0);
  const [batches, setBatches] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const control = useRef<"run" | "pause" | "stop">("run");
  const current = () => control.current as "run" | "pause" | "stop";

  async function start() {
    control.current = "run";
    setState("running");
    setError(null);
    setWarning(null);
    setDone(false);
    try {
      for (;;) {
        if (current() === "stop") break;
        if (current() === "pause") { setState("paused"); return; }
        const r = await runBatch();
        setBatches((n) => n + 1);
        if (r.unavailable) setUnavailable((n) => n + r.unavailable);
        setProgress({ total: r.total, pending: r.pending, analysed: r.analysed });
        const progressed = r.processed + r.unavailable;
        if (r.errors.length) setWarning(r.errors[0] ?? null);
        if (r.pending === 0 || r.requested === 0) { setDone(true); break; }
        if (progressed === 0) {
          setError(r.errors[0] ? `Block ohne Fortschritt: ${r.errors[0]}` : r.timedOut ? "Block ohne Fortschritt: Zeitlimit erreicht." : "Block ohne Fortschritt.");
          break;
        }
        await sleep(PAUSE_BETWEEN_BATCHES_MS);
      }
    } catch (e) {
      setError((e as Error)?.message || "Anfrage fehlgeschlagen.");
    } finally {
      if (current() !== "pause") {
        setState("idle");
        try { await onSettled(); } catch { /* counters refresh is best-effort */ }
      }
    }
  }

  return {
    state, progress, unavailable, batches, error, warning, done, start,
    pause: () => { control.current = "pause"; },
    stop: () => { control.current = "stop"; setState("idle"); void onSettled(); },
    dismissError: () => setError(null),
  };
}
