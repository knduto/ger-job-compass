import { describe, expect, it } from "vitest";
import { evaluateTechStack as ev, extractRemote, extractSeniority, extractSkills } from "./tech-stack";

const core = (d: string) => ev({ description: d }).core_skills;

describe("skills: boundaries and aliases", () => {
  it("aliases map to canonical names", () => {
    expect(core("Erfahrung mit k8s und JS")).toEqual(expect.arrayContaining(["Kubernetes", "JavaScript"]));
    expect(core("Kenntnisse in Postgres")).toContain("PostgreSQL");
    expect(core("Wir nutzen Amazon Web Services")).toContain("AWS");
  });
  it("Java vs JavaScript, SQL vs MySQL", () => {
    expect(core("JavaScript-Entwicklung")).not.toContain("Java");
    expect(core("Java und Spring Boot")).toEqual(expect.arrayContaining(["Java", "Spring"]));
    expect(core("Betrieb von MySQL")).toEqual(["MySQL"]);
  });
  it("C#, C++ and C/C++", () => {
    expect(core("C# und .NET Core")).toEqual(expect.arrayContaining(["C#", ".NET"]));
    expect(core("Embedded C/C++")).toEqual(expect.arrayContaining(["C", "C++"]));
  });
  it("no false positives for Go, R, C in normal text", () => {
    expect(core("Let's go! Wir gehen go-live im Herbst. Go for it.")).toEqual([]);
    expect(core("Abteilung R und D, Kategorie C")).not.toContain("C");
    expect(core("Das R steht für Rechnen")).toEqual([]);
    expect(core("Rest des Teams, Spring Semester")).not.toContain("REST");
  });
  it("Go, R detected in language lists", () => {
    expect(core("Sprachen: Python, Go, Rust")).toEqual(expect.arrayContaining(["Python", "Go", "Rust"]));
    expect(core("Golang Erfahrung")).toContain("Go");
    expect(core("Statistik mit Python, R und SQL")).toEqual(expect.arrayContaining(["R", "Python", "SQL"]));
  });
});

describe("negation", () => {
  it("ignores negated mentions", () => {
    expect(core("Keine Java-Kenntnisse erforderlich.")).not.toContain("Java");
    expect(core("Python ist nicht erforderlich.")).not.toContain("Python");
    expect(core("No Docker experience needed")).not.toContain("Docker");
    expect(core("Nicht nur Python, auch Go-Entwicklung")).toEqual(expect.arrayContaining(["Python", "Go"]));
  });
});

describe("core vs bonus split", () => {
  it("section headings", () => {
    const r = extractSkills("Dein Profil:\n- Python\n- Docker\nWünschenswert:\n- Terraform\n- Python\nWir bieten:\n- Jira-Lizenz");
    expect([...r.core.keys()]).toEqual(expect.arrayContaining(["Python", "Docker", "Jira"]));
    expect([...r.bonus.keys()]).toEqual(["Terraform"]);
  });
  it("inline phrase cues (DE/EN)", () => {
    const r = ev({ description: "Sehr gute Kenntnisse in React. Erfahrung mit GraphQL ist von Vorteil. Kafka is a plus." });
    expect(r.core_skills).toEqual(["React"]);
    expect(r.bonus_skills).toEqual(["GraphQL", "Kafka"]);
  });
  it("stores exact evidence for each skill", () => {
    const r = ev({ description: "Requirements:\nStrong AWS skills" });
    expect(r.evidence.some((e) => e.startsWith("core:AWS|") && e.includes("Strong AWS skills"))).toBe(true);
  });
});

describe("seniority", () => {
  it("title first", () => {
    expect(extractSeniority("Senior Data Engineer (m/w/d)", "Junior-Position").seniority).toBe("senior");
    expect(extractSeniority("Lead Developer", null).seniority).toBe("lead");
    expect(extractSeniority("Software Architekt (m/w/d)", null).seniority).toBe("lead");
    expect(extractSeniority("Junior Frontend Entwickler", null).seniority).toBe("junior");
    expect(extractSeniority("Trainee IT", null).seniority).toBe("junior");
  });
  it("description fallback, ambiguous stays unspecified", () => {
    expect(extractSeniority("Software Engineer", "Ideal für Berufseinsteiger").seniority).toBe("junior");
    expect(extractSeniority("Engineer", "Berufseinsteiger oder als Senior Engineer").seniority).toBe("unspecified");
    expect(extractSeniority("Entwickler", "Wir freuen uns auf dich").seniority).toBe("unspecified");
  });
});

describe("remote", () => {
  it("modes", () => {
    expect(extractRemote("100% Remote möglich").remote_mode).toBe("remote");
    expect(extractRemote("Fully remote within Germany").remote_mode).toBe("remote");
    expect(extractRemote("Hybrides Arbeiten mit 2 Tagen Homeoffice").remote_mode).toBe("hybrid");
    expect(extractRemote("Mobiles Arbeiten nach Absprache").remote_mode).toBe("hybrid");
    expect(extractRemote("Homeoffice ist leider nicht möglich").remote_mode).toBe("onsite");
    expect(extractRemote("Präsenzpflicht am Standort").remote_mode).toBe("onsite");
    expect(extractRemote("Spannende Aufgaben").remote_mode).toBe("unspecified");
  });
  it("homeoffice flag is supporting evidence only", () => {
    const r = extractRemote("Spannende Aufgaben", true);
    expect(r.remote_mode).toBe("unspecified");
    expect(r.flags).toContain("ba_homeoffice");
  });
});
