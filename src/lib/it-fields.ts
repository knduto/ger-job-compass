// IT professional fields (berufsfeld) exactly as returned by the Arbeitsagentur API
// facets (verified against live responses on 2026-09-27).
export const IT_BERUFSFELDER = [
  "Informatik",
  "IT-Netzwerktechnik, -Administration, -Organisation",
  "IT-Systemanalyse, -Anwendungsberatung und -Vertrieb",
  "Softwareentwicklung und Programmierung",
] as const;

export const STAGES = [
  { id: "saved", label: "Gespeichert" },
  { id: "applied", label: "Beworben" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Angebot" },
  { id: "rejected", label: "Absage" },
] as const;

export const CONTRACT_LABELS: Record<string, string> = {
  UNBEFRISTET: "Unbefristet",
  BEFRISTET: "Befristet",
  KEINE_ANGABE: "Vertrag k. A.",
};
