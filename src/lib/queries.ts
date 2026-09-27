import { supabase } from "@/integrations/supabase/client";

export async function must<R extends { error: any }>(p: PromiseLike<R>): Promise<R> {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r;
}

export const JOB_LIST_COLS =
  "refnr,title,employer,city,plz,region,berufsfelder,contract,fulltime,parttime,homeoffice,salary_type,salary_from,salary_to,published_from,first_seen,last_seen,expired,external_url";

export async function fetchAllCityStats() {
  const { data } = await must(supabase.from("city_stats").select("*").order("active_jobs", { ascending: false }).limit(1000));
  return data ?? [];
}

export async function fetchTrackedCities() {
  const { data } = await must(supabase.from("tracked_cities").select("id,city").order("city"));
  return data ?? [];
}

export async function addTrackedCity(city: string) {
  const { error } = await supabase.from("tracked_cities").insert({ city });
  if (error) throw new Error(error.message);
}

export async function removeTrackedCity(id: string) {
  const { error } = await supabase.from("tracked_cities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchMyApplications() {
  const { data } = await must(
    supabase.from("applications").select(`*, job:jobs(${JOB_LIST_COLS})`).order("updated_at", { ascending: false }),
  );
  return data ?? [];
}

export async function saveToPipeline(refnr: string) {
  const { error } = await supabase.from("applications").upsert({ refnr, stage: "saved" }, { onConflict: "user_id,refnr", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
