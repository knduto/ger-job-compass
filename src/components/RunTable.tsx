import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmt, fmtDateTime } from "./AppShell";

// A run still "running" after this long without finishing was interrupted (tab closed / server timeout).
const STALE_MS = 30 * 60 * 1000;

function displayStatus(r: any) {
  if (r.status === "running" && !r.finished_at && Date.now() - new Date(r.started_at).getTime() > STALE_MS) return "unterbrochen";
  return r.status;
}

export function RunTable({ runs }: { runs: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{["Start", "Auslöser", "Status", "Suchbegriffe", "Anfragen", "Gefunden", "Neu", "Aktualisiert", "Abgelaufen", "Nicht-DE verworfen", "Fehler"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>
          {runs.map((r) => {
            const status = displayStatus(r);
            const errors: string[] = Array.isArray(r.errors) ? r.errors : [];
            return (
              <tr key={r.id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.started_at)}</td>
                <td className="px-3 py-2">{r.trigger === "daily" ? "Täglich" : r.trigger === "city" ? "Stadt" : "Manuell"}</td>
                <td className="px-3 py-2">
                  <Badge variant={status === "success" ? "default" : status === "running" ? "secondary" : "destructive"}
                    title={status === "unterbrochen" ? "Abruf wurde nicht abgeschlossen (Tab geschlossen oder Zeitlimit erreicht)." : undefined}>{status}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{r.keywords_done}/{r.keywords_total}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.requests)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.fetched)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.new_count)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.updated_count)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.expired_count)}</td>
                <td className="px-3 py-2 font-mono">{fmt(r.skipped_non_de)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {errors.length === 0 ? <span className="text-muted-foreground">—</span> : (
                    <Dialog>
                      <DialogTrigger className="text-destructive underline underline-offset-2">{errors.length} Fehler ansehen</DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Fehler – Abruf vom {fmtDateTime(r.started_at)}</DialogTitle></DialogHeader>
                        <ol className="max-h-[60vh] list-decimal space-y-2 overflow-y-auto pl-5 text-sm">
                          {errors.map((e, i) => <li key={i} className="break-words">{e}</li>)}
                        </ol>
                      </DialogContent>
                    </Dialog>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {runs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Noch keine Abrufe.</p>}
    </div>
  );
}
