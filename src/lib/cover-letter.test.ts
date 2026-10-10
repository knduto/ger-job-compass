import { describe, expect, it } from "vitest";
import { buildCoverLetter, VISA_LINE_DE, VISA_LINE_EN, type CoverLetterProfile } from "./cover-letter";

const job = { title: "Data Engineer (m/w/d)", employer: "Acme GmbH", city: "Leipzig", refnr: "12345-678-S" };
const profile: CoverLetterProfile = { name: "John Nduto", contactLine: "john@example.com", availability: "ab sofort", roleFocus: "Data Engineering", salary: "", contactPerson: "", germanLevel: "B1", skills: "Python, SQL, Rust" };
const tech = { core_skills: ["Python", "Spark"], bonus_skills: ["SQL", "Kafka"] };
const today = new Date("2026-10-10T00:00:00");

describe("buildCoverLetter", () => {
  it("includes the visa line in both modes", () => {
    expect(buildCoverLetter({ mode: "de", job, profile, today })).toContain(VISA_LINE_DE);
    expect(buildCoverLetter({ mode: "en", job, profile, today })).toContain(VISA_LINE_EN);
  });
  it("includes the refnr", () => {
    expect(buildCoverLetter({ mode: "de", job, profile, today })).toContain("Referenznummer: 12345-678-S");
  });
  it("omits the skills paragraph without tech data", () => {
    const t = buildCoverLetter({ mode: "de", job, profile, tech: null, today });
    expect(t).not.toContain("Kernkompetenzen");
    expect(t).not.toContain("Python");
  });
  it("omits salary when empty and includes it when given", () => {
    expect(buildCoverLetter({ mode: "de", job, profile, today })).not.toContain("Gehaltsvorstellung");
    expect(buildCoverLetter({ mode: "de", job, profile: { ...profile, salary: "60000" }, today })).toContain("60.000 € brutto pro Jahr");
  });
  it("lists only overlapping skills as matches", () => {
    const t = buildCoverLetter({ mode: "de", job, profile, tech, today });
    expect(t).toContain("Kernkompetenzen Python bringe");
    expect(t).toContain("Erfahrung mit SQL.");
    expect(t).not.toContain("Rust");
    expect(t).not.toContain("Spark");
    expect(t).not.toContain("Kafka");
  });
  it("uses named contact salutation", () => {
    expect(buildCoverLetter({ mode: "de", job, profile: { ...profile, contactPerson: "Frau Müller" }, today })).toContain("Sehr geehrte/r Frau Müller,");
    expect(buildCoverLetter({ mode: "de", job, profile, today })).toContain("Sehr geehrte Damen und Herren,");
  });
});
