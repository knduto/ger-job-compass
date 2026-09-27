import type { ReportFilters } from "./reports.functions";

type CityRow = { city: string; active: number; new7: number; employers: number; remotePct: number; salaryPct: number; languageCoverage: number; englishPct: number; score: number };

export async function downloadReportPdf(input: {
  filters: ReportFilters; total: number; analysed: number; generatedAt: string; cities: CityRow[];
  language: { label: string; count: number }[]; topEmployers: [string, number][]; methodology: string[];
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Smart-DE-Reise", margin, 18);
  doc.setFontSize(13); doc.text("Datenbasierter IT-Arbeitsmarktbericht", margin, 27);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Erstellt: ${new Date(input.generatedAt).toLocaleString("de-DE")}  |  Stellen: ${input.total}  |  Sprachlich analysiert: ${input.analysed}`, margin, 34);
  const activeFilters = Object.entries(input.filters).filter(([, value]) => value !== "" && value !== false && value !== 0 && value !== "active").map(([key, value]) => `${key}: ${String(value)}`);
  doc.text(`Filter: ${activeFilters.join("; ") || "Aktive Stellen, alle weiteren Merkmale"}`, margin, 40, { maxWidth: 178 });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Städteranking", margin, 51);
  autoTable(doc, { startY: 55, head: [["#", "Stadt", "Score", "Aktiv", "Neu 7T", "Arbeitgeber", "Remote", "Englisch"]], body: input.cities.slice(0, 20).map((r, i) => [i + 1, r.city, r.score.toFixed(0), r.active, r.new7, r.employers, `${r.remotePct.toFixed(1)}%`, r.languageCoverage ? `${r.englishPct.toFixed(1)}%` : "n/a"]), styles: { fontSize: 8 }, headStyles: { fillColor: [39, 47, 58] } });
  let y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 230) { doc.addPage(); y = 18; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Deutschanforderungen", margin, y);
  autoTable(doc, { startY: y + 4, head: [["Kategorie", "Stellen"]], body: input.language.map((r) => [r.label, r.count]), styles: { fontSize: 9 }, headStyles: { fillColor: [39, 47, 58] } });
  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 220) { doc.addPage(); y = 18; }
  doc.setFont("helvetica", "bold"); doc.text("Top-Arbeitgeber", margin, y);
  autoTable(doc, { startY: y + 4, head: [["Arbeitgeber", "Stellen"]], body: input.topEmployers.slice(0, 15), styles: { fontSize: 9 }, headStyles: { fillColor: [39, 47, 58] } });
  doc.addPage(); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Datenbasis und Methodik", margin, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  let lineY = 30;
  for (const line of input.methodology) { const wrapped = doc.splitTextToSize(`• ${line}`, 174); doc.text(wrapped, margin, lineY); lineY += wrapped.length * 5 + 3; }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(8); doc.setTextColor(100); doc.text(`Smart-DE-Reise · Bundesagentur für Arbeit · Seite ${page}/${pages}`, margin, 290); }
  doc.save(`Smart-DE-Reise-Bericht-${new Date().toISOString().slice(0, 10)}.pdf`);
}