import { describe, expect, it, vi } from "vitest";
vi.mock("./ba-api.server", () => ({ jobDetails: vi.fn(), politeDelay: vi.fn() }));
import { evaluateVisaFeasibility as ev } from "./visa-feasibility.server";

describe("evaluateVisaFeasibility", () => {
  it("empty → unspecified", () => {
    expect(ev(null)).toMatchObject({ status: "unspecified", flags: [], evidence: [] });
    expect(ev("Wir suchen einen DevOps Engineer mit Kubernetes.").status).toBe("unspecified");
  });
  it("restricted: Sicherheitsüberprüfung, SÜ2, citizenship, Verschlusssachen, clearance", () => {
    expect(ev("Bereitschaft zur Sicherheitsüberprüfung nach SÜG").status).toBe("restricted");
    expect(ev("Voraussetzung ist eine Ü2-Prüfung.").flags).toContain("security_clearance");
    expect(ev("Deutsche Staatsangehörigkeit erforderlich.").flags).toContain("citizenship_required");
    expect(ev("Umgang mit Verschlusssachen").flags).toContain("classified_information");
    expect(ev("Active security clearance required").status).toBe("restricted");
  });
  it("negation does not flag", () => {
    expect(ev("Es ist keine Sicherheitsüberprüfung notwendig.").status).toBe("unspecified");
    expect(ev("Eine Sicherheitsüberprüfung ist nicht erforderlich.").status).toBe("unspecified");
    expect(ev("No security clearance required.").status).toBe("unspecified");
    expect(ev("We cannot offer visa sponsorship.").status).toBe("unspecified");
    expect(ev("Leider keine Relocation möglich.").status).toBe("unspecified");
  });
  it("work permit required", () => {
    expect(ev("Eine gültige Arbeitserlaubnis für Deutschland").status).toBe("work_permit_required");
    expect(ev("Aufenthaltstitel mit Arbeitserlaubnis ist vorhanden").status).toBe("work_permit_required");
    expect(ev("You must have the right to work in Germany.").flags).toContain("right_to_work");
    expect(ev("A valid work permit is required").status).toBe("work_permit_required");
  });
  it("international friendly", () => {
    expect(ev("We offer visa sponsorship and relocation package").flags).toEqual(expect.arrayContaining(["visa_support", "relocation_support"]));
    expect(ev("Umzugsunterstützung und Hilfe bei der Blauen Karte").status).toBe("international_friendly");
    expect(ev("International applicants welcome!").flags).toContain("international_welcome");
    expect(ev("Unterstützung beim Visumsantrag").status).toBe("international_friendly");
  });
  it("precedence restricted > permit > friendly", () => {
    expect(ev("Relocation support. Sicherheitsüberprüfung Ü2 erforderlich. Gültige Arbeitserlaubnis.").status).toBe("restricted");
    expect(ev("Relocation support. Gültige Arbeitserlaubnis erforderlich.").status).toBe("work_permit_required");
  });
  it("evidence is exact excerpts, max 4", () => {
    const text = "Relocation. ".repeat(10) + "Sicherheitsüberprüfung erforderlich";
    const r = ev(text);
    expect(r.evidence.length).toBeLessThanOrEqual(4);
    expect(r.evidence[0]).toContain("Sicherheitsüberprüfung");
    for (const e of r.evidence) expect(text.replace(/\s+/g, " ")).toContain(e);
  });
});
