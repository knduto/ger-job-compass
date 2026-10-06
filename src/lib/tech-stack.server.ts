import { analysisBacklog, runAnalysisBatch } from "./analysis-batch.server";
import { TECH_VERSION, evaluateTechStack } from "./tech-stack";

type Admin = any;

export function countPendingTech(admin: Admin) {
  return analysisBacklog(admin, "tech");
}

async function jobMeta(admin: Admin, refnr: string) {
  const { data, error } = await admin.from("jobs").select("title,homeoffice").eq("refnr", refnr).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { title: null, homeoffice: null }) as { title: string | null; homeoffice: boolean | null };
}

export function analyseTechBatch(admin: Admin, limit = 10) {
  return runAnalysisBatch(admin, "tech", {
    limit,
    save: async (refnr, description) => {
      const meta = await jobMeta(admin, refnr);
      const row = evaluateTechStack({ title: meta.title, description, homeoffice: meta.homeoffice });
      const res = await admin.from("job_tech_stack").upsert({ refnr, ...row, analysed_at: new Date().toISOString() }, { onConflict: "refnr" });
      if (res.error) throw new Error(res.error.message);
    },
    saveUnavailable: async (refnr, now) => {
      const res = await admin.from("job_tech_stack").upsert(
        { refnr, core_skills: [], bonus_skills: [], seniority: "unspecified", remote_mode: "unspecified", flags: ["unavailable"], evidence: [], version: TECH_VERSION, analysed_at: now },
        { onConflict: "refnr" },
      );
      if (res.error) throw new Error(res.error.message);
    },
  });
}
