import type { ReportFilters } from "./reports.functions";
import { VISA_STATUS_LABELS } from "./visa-labels";
import { REMOTE_LABELS, SENIORITY_LABELS } from "./tech-stack";

type CityRow = { city: string; active: number; total: number; expired: number; new7: number; employers: number; remotePct: number; salaryPct: number; languageCoverage: number; englishPct: number; expiryPct: number; avgDays: number; score: number };
export type TechAgg = { analysed: number; unavailable: number; core: [string, number][]; bonus: [string, number][]; seniority: Record<string, number>; remote: Record<string, number> };
export type TrendRow = { date: string; active: number; new7: number; englishPct: number; analysed: number };

export type ReportPdfInput = {
  filters: ReportFilters; total: number; analysed: number; generatedAt: string; cities: CityRow[]; lifecycleCities: CityRow[];
  kpis: { topCity?: { city: string; score: number } | undefined; newestCity?: { city: string; new7: number } | undefined; salaryRatePct: number; analysedPct: number };
  language: { label: string; count: number }[]; estimatedLanguage: { label: string; count: number }[];
  employers: { name: string; count: number; kind: string }[];
  market: { largest?: [string, number] | undefined; agencyPct: number; salaryMin: number | null; salaryMax: number | null };
  visa: Record<string, number> | null; tech: TechAgg | null; trends: TrendRow[]; methodology: string[];
};

const NO = "keine Daten";
const de = (n: number, d = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (n: number) => `${de(n, 1)} %`;
const HEAD: [number, number, number] = [39, 47, 58];

export async function buildReportPdf(input: ReportPdfInput) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14, W = 182;
  const last = () => (doc as any).lastAutoTable.finalY as number;
  const h2 = (t: string, y: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20); doc.text(t, M, y); };
  const note = (t: string, y: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90); const w = doc.splitTextToSize(t, W); doc.text(w, M, y); doc.setTextColor(20); return y + w.length * 3.6; };
  const table = (opts: any) => autoTable(doc, { theme: "striped", margin: { left: M, right: M }, styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4, overflow: "linebreak" }, headStyles: { fillColor: HEAD, textColor: 255 }, didParseCell: (d: any) => { if (d.section === "head") { const h = opts.columnStyles?.[d.column.index]?.halign; if (h) d.cell.styles.halign = h; } }, ...opts });
  const empty = (y: number) => { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(110); doc.text(NO, M, y); doc.setTextColor(20); return y + 6; };
  const pageHead = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(110); doc.text(`Smart-DE-Reise · ${t}`, M, 10); doc.setTextColor(20); };

  // ---------- Page 1 ----------
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Smart-DE-Reise", M, 18);
  doc.setFontSize(12); doc.text("Datenbasierter IT-Arbeitsmarktbericht · Mein Weg bei der Jobsuche", M, 25);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`Erstellt: ${new Date(input.generatedAt).toLocaleString("de-DE")}  |  Quelle: gespeicherte Datenbank (Bundesagentur für Arbeit)`, M, 31);
  const active = Object.entries(input.filters).filter(([, v]) => v !== "" && v !== false && v !== 0 && v !== "active").map(([k, v]) => `${k}: ${String(v)}`);
  let y = note(`Filter: ${active.join("; ") || "Aktive Stellen, alle weiteren Merkmale"}`, 36) + 3;
  h2("Entscheidungsübersicht", y);
  const k = input.kpis;
  table({ startY: y + 2, head: [["Kennzahl", "Wert", "Hinweis"]], columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 55, fontStyle: "bold" } }, body: [
    ["Gefilterte Stellen", de(input.total), ""],
    ["Bestbewertete Stadt", k.topCity?.city ?? NO, k.topCity ? `Score ${de(k.topCity.score)}` : ""],
    ["Frischester Markt", k.newestCity?.city ?? NO, k.newestCity ? `${de(k.newestCity.new7)} neue Stellen in 7 Tagen` : ""],
    ["Gehaltsangaben", input.total ? pc(k.salaryRatePct) : NO, "Anteil gefüllter Gehaltsfelder (von/bis)"],
    ["Sprachabdeckung", input.total ? pc(k.analysedPct) : NO, `${de(input.analysed)} von ${de(input.total)} analysiert`],
  ] });
  y = last() + 7;
  h2(`Städteranking (${input.cities.length} Städte)`, y);
  if (!input.cities.length) y = empty(y + 6);
  else {
    table({ startY: y + 2, head: [["#", "Stadt", "Score", "Aktiv", "Neu 7T", "Arbeitgeber", "Remote", "Englisch*", "Gehalt"]], styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.1 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 48 } },
      body: input.cities.map((r, i) => [i + 1, r.city, de(r.score), de(r.active), de(r.new7), de(r.employers), pc(r.remotePct), r.languageCoverage ? pc(r.englishPct) : "–", pc(r.salaryPct)]) });
    y = note("* Anteil nur innerhalb sprachlich analysierter Stellen der jeweiligen Stadt. Score 0–100 nach den im Reports-Tab eingestellten Gewichten.", last() + 4);
  }

  // ---------- Page 2 ----------
  doc.addPage(); pageHead("Visum & Tech-Stack");
  h2("Chancenkarte & Arbeitserlaubnis", 18);
  y = note("Gesamter gespeicherter Bestand (unabhängig von den Filtern). Status nur aus wörtlichen, nicht verneinten Formulierungen.", 23);
  if (!input.visa) y = empty(y + 3);
  else {
    const v = input.visa; const sum = Object.keys(VISA_STATUS_LABELS).reduce((s, key) => s + (v[key] ?? 0), 0);
    table({ startY: y + 1, head: [["Status", "Stellen", "Anteil"]], columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      body: [...["restricted", "work_permit_required", "international_friendly", "unspecified"].map((key) => [VISA_STATUS_LABELS[key], de(v[key] ?? 0), sum ? pc(100 * (v[key] ?? 0) / sum) : "–"]),
        ["davon Anzeige nicht mehr verfügbar", de(v["unavailable"] ?? 0), sum ? pc(100 * (v["unavailable"] ?? 0) / sum) : "–"]] });
    y = last() + 4;
  }
  y += 4; h2("Tech-Stack & Anforderungen", y);
  const t = input.tech;
  y = note(t ? `Datenbasis: ${de(t.analysed)} ausgewertete Stellen (gesamter Bestand); ${de(t.unavailable)} nicht mehr verfügbare Anzeigen ausgeschlossen. Prozent bezogen auf ausgewertete Stellen.` : "Tech-Stack-Daten konnten nicht geladen werden.", y + 5);
  if (!t || !t.analysed) y = empty(y + 3);
  else {
    const base = t.analysed; const rowsOf = (list: [string, number][]) => list.length ? list.map(([n, c]) => [n, de(c), pc(100 * c / base)]) : [[NO, "", ""]];
    const half = (W - 6) / 2; const startY = y + 1;
    table({ startY, margin: { left: M, right: M + half + 6 }, tableWidth: half, head: [["Top-Kernkompetenzen", "Stellen", "%"]], body: rowsOf(t.core) });
    const leftEnd = last();
    table({ startY, margin: { left: M + half + 6, right: M }, tableWidth: half, head: [["Top-Bonuskompetenzen", "Stellen", "%"]], body: rowsOf(t.bonus) });
    y = Math.max(leftEnd, last()) + 6;
    const dist = (labels: Record<string, string>, d: Record<string, number>) => Object.entries(labels).map(([key, l]) => [l, de(d[key] ?? 0), pc(100 * (d[key] ?? 0) / base)]);
    table({ startY: y, margin: { left: M, right: M + half + 6 }, tableWidth: half, head: [["Seniorität", "Stellen", "%"]], body: dist(SENIORITY_LABELS, t.seniority) });
    const l2 = last();
    table({ startY: y, margin: { left: M + half + 6, right: M }, tableWidth: half, head: [["Arbeitsmodell", "Stellen", "%"]], body: dist(REMOTE_LABELS, t.remote) });
    y = Math.max(l2, last());
  }

  // ---------- Page 3 ----------
  doc.addPage(); pageHead("Deutsch & Arbeitgeber");
  h2("Deutschanforderungen", 18);
  y = note("Explizite CEFR-Niveaus nur bei wörtlicher Nennung; geschätzte Niveaus sind heuristische Ableitungen ausdrücklicher Formulierungen.", 23);
  const langBody = [...input.language.map((r) => [r.label, de(r.count)]), [{ content: "Geschätzt (heuristisch)", colSpan: 2, styles: { fontStyle: "bold", fillColor: [235, 230, 220] } }], ...input.estimatedLanguage.map((r) => [r.label, de(r.count)])];
  if (!input.total) y = empty(y + 3);
  else { table({ startY: y + 1, head: [["Kategorie", "Stellen"]], columnStyles: { 1: { halign: "right", cellWidth: 30 } }, body: langBody }); y = last(); }
  y += 8; h2("Markt & Arbeitgeber", y);
  const mk = input.market;
  table({ startY: y + 2, head: [["Kennzahl", "Wert"]], columnStyles: { 0: { cellWidth: 50 } }, body: [
    ["Größter Arbeitgeber", mk.largest ? `${mk.largest[0]} (${de(mk.largest[1])} Stellen)` : NO],
    ["Agenturhinweis", input.total ? `${pc(mk.agencyPct)} (nur klare Namensmerkmale)` : NO],
    ["Gehaltsspanne", mk.salaryMin !== null && mk.salaryMax !== null ? `${de(mk.salaryMin)}–${de(mk.salaryMax)} €` : NO],
  ] });
  y = last() + 5;
  if (!input.employers.length) y = empty(y + 3);
  else table({ startY: y, head: [["Arbeitgeber", "Klassifikation", "Stellen"]], columnStyles: { 1: { cellWidth: 45 }, 2: { halign: "right", cellWidth: 20 } }, body: input.employers.map((e) => [e.name, e.kind, de(e.count)]) });

  // ---------- Page 4 ----------
  doc.addPage(); pageHead("Lebenszyklus, Trends & Methodik");
  h2("Stellen-Lebenszyklus nach Stadt", 18);
  if (!input.lifecycleCities.length) y = empty(24);
  else { table({ startY: 21, head: [["Stadt", "Beobachtet", "Abgelaufen", "Ablaufquote", "Ø beobachtete Tage"]], styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1 }, body: input.lifecycleCities.map((r) => [r.city, de(r.total), de(r.expired), pc(r.expiryPct), de(r.avgDays, 1)]) }); y = last(); }
  y += 7; h2("Historische Trends (tägliche Snapshots)", y);
  if (input.trends.length === 0) y = empty(y + 6);
  else {
    const tr = input.trends.length > 10 ? input.trends.slice(-10) : input.trends;
    table({ startY: y + 2, head: [["Datum", "Aktiv", "Neu 7T", "Englisch %"]], styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1 }, body: tr.map((r) => [new Date(r.date).toLocaleDateString("de-DE"), de(r.active), de(r.new7), r.analysed ? pc(r.englishPct) : "–"]) });
    y = note(`${input.trends.length} Snapshot-Tage gespeichert${input.trends.length > 10 ? "; die letzten 10 werden gezeigt" : ""}.${input.trends.length < 2 ? " Noch nicht genug Historie für einen belastbaren Trend." : ""}`, last() + 4);
  }
  if (y > 225) { doc.addPage(); pageHead("Methodik"); y = 14; }
  y += 5; h2("Datenbasis & Methodik", y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const lines = [...input.methodology, `Bericht erstellt am ${new Date(input.generatedAt).toLocaleString("de-DE")} ausschließlich aus gespeicherten Datenbankinhalten.`];
  if (input.kpis.analysedPct < 50) lines.push(`Abdeckungshinweis: Nur ${pc(input.kpis.analysedPct)} der gefilterten Stellen sind sprachlich analysiert — Sprachwerte sind noch nicht repräsentativ.`);
  for (const line of lines) { const w = doc.splitTextToSize(`• ${line}`, W); doc.text(w, M, y); y += w.length * 3.8 + 1.2; }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(`Smart-DE-Reise · Daten: Bundesagentur für Arbeit (gespeicherter Bestand) · Seite ${p}/${pages}`, M, 290); }
  return doc;
}

export async function downloadReportPdf(input: ReportPdfInput) {
  const doc = await buildReportPdf(input);
  doc.save(`Smart-DE-Reise-Bericht-${new Date().toISOString().slice(0, 10)}.pdf`);
}
