// Client for the Bundesagentur für Arbeit Jobsuche API (verified endpoints).
// Search: pc/v6/jobs  |  Details: pc/v4/jobdetails/{base64(refnr)}
const BASE = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const HEADERS = { "X-API-KEY": "jobboerse-jobsuche", Accept: "application/json" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function baFetch(path: string, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (res.status === 429 || res.status >= 500) {
    if (attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      return baFetch(path, attempt + 1);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Arbeitsagentur ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export type BaSearchParams = {
  was?: string;
  wo?: string;
  umkreis?: number;
  berufsfeld?: string;
  angebotsart?: number;
  veroeffentlichtseit?: number;
  page?: number;
  size?: number;
};

export function searchJobs(p: BaSearchParams) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") q.set(k, String(v));
  return baFetch(`/pc/v6/jobs?${q.toString()}`);
}

export function jobDetails(refnr: string) {
  const enc = Buffer.from(refnr, "utf8").toString("base64");
  return baFetch(`/pc/v4/jobdetails/${encodeURIComponent(enc)}`);
}

export const politeDelay = () => sleep(350);
