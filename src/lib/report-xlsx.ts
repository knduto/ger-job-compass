import type { ReportFilters } from "./reports.functions";
import type { ReportJob } from "./report-metrics";
import { employerKind } from "./report-metrics";

export async function downloadReportXlsx(input: { filters: ReportFilters; rows: ReportJob[]; cities: any[]; language: { label: string; count: number }[]; employers: [string, number][]; snapshots: any[]; generatedAt: string }) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const source = input.rows.map((r) => ({ Referenz: r.refnr, Titel: r.title, Arbeitgeber: r.employer, Stadt: r.city, Bundesland: r.region, Beruf: r.beruf,
    Berufsfelder: r.berufsfelder.join(" | "), Suchbegriffe: r.keywords.join(" | "), Status: r.expired ? "Abgelaufen" : "Aktiv", Veröffentlicht: r.published_from,
    Homeoffice: r.homeoffice ? "Ja" : "Nein", Vertrag: r.contract, Vollzeit: r.fulltime ? "Ja" : "Nein", Teilzeit: r.parttime ? "Ja" : "Nein",
    Gehalt_von: r.salary_from, Gehalt_bis: r.salary_to, Sprachklasse: r.language?.classification ?? "Noch nicht analysiert", CEFR: r.language?.cefr_level,
    Deutsch_erforderlich: r.language?.german_required ?? null, Englisch_zugänglich: r.language?.english_accessible ?? null, Sprachnachweis: r.language?.evidence.join(" | ") ?? "" }));
  const overview = [
    ["Smart-DE-Reise Arbeitsmarktbericht"], ["Erstellt", new Date(input.generatedAt).toLocaleString("de-DE")], ["Quelle", "Bundesagentur für Arbeit Jobsuche API"],
    ["Gefilterte Stellen", { f: `COUNTA('Gefilterte Stellen'!A2:A${source.length + 1})` }], ["Sprachlich analysiert", input.rows.filter((r) => r.language).length],
    ["Hinweis", "CEFR-Niveaus werden nur bei expliziter Nennung vergeben; vage Anforderungen bleiben separat."], [], ["Aktive Filter"],
    ...Object.entries(input.filters).map(([key, value]) => [key, String(value)]),
  ];
  const sheets: [string, any[]][] = [
    ["Übersicht", overview], ["Städte", input.cities], ["Sprache", input.language],
    ["Arbeitgeber", input.employers.map(([name, jobs]) => ({ Arbeitgeber: name, Stellen: jobs, Klassifikation: employerKind(name) }))],
    ["Lebenszyklus", input.cities.map((c) => ({ Stadt: c.city, Gesamt: c.total, Abgelaufen: c.expired, Ablaufquote: c.expiryPct / 100, Durchschnitt_Tage: c.avgDays }))],
    ["Trends", input.snapshots], ["Gefilterte Stellen", source],
  ];
  for (const [name, data] of sheets) {
    const ws = Array.isArray(data[0]) ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Array.from({ length: Math.min(20, Math.max(2, Object.keys((data as any[])[0] ?? {}).length)) }, (_, i) => ({ wch: i === 0 ? 30 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  if (!wb.Workbook) wb.Workbook = {};
  (wb.Workbook as any).CalcPr = { calcMode: "auto" };
  XLSX.writeFile(wb, `Smart-DE-Reise-Bericht-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}