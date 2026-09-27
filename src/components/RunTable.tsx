import { Badge } from "@/components/ui/badge";
import { fmt, fmtDateTime } from "./AppShell";

export function RunTable({ runs }: { runs: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{["Start", "Auslöser", "Status", "Suchbegriffe", "Anfragen", "Gefunden", "Neu", "Aktualisiert", "Abgelaufen", "Nicht-DE verworfen", "Fehler"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.started_at)}</td>
              <td className="px-3 py-2">{r.trigger === "daily" ? "Täglich" : r.trigger === "city" ? "Stadt" : "Manuell"}</td>
              <td className="px-3 py-2"><Badge variant={r.status === "success" ? "default" : r.status === "running" ? "secondary" : "destructive"}>{r.status}</Badge></td>
              <td className="px-3 py-2 font-mono">{r.keywords_done}/{r.keywords_total}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.requests)}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.fetched)}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.new_count)}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.updated_count)}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.expired_count)}</td>
              <td className="px-3 py-2 font-mono">{fmt(r.skipped_non_de)}</td>
              <td className="max-w-xs px-3 py-2 text-xs text-destructive">{(r.errors ?? []).slice(0, 3).join(" · ")}{(r.errors ?? []).length > 3 ? ` (+${r.errors.length - 3})` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Noch keine Abrufe.</p>}
    </div>
  );
}
