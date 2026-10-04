// Client for the Bundesagentur für Arbeit Jobsuche API (verified endpoints).
// Search: pc/v6/jobs  |  Details: pc/v4/jobdetails/{base64(refnr)}
const BASE = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const HEADERS = { "X-API-KEY": "jobboerse-jobsuche", Accept: "application/json" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The posting no longer exists at the agency (taken down / closed). Not a failure. */
export class BaNotFoundError extends Error {
  readonly notFound = true;
  constructor(message: string) {
    super(message);
    this.name = "BaNotFoundError";
  }
}

export type BaFetchOptions = { timeoutMs?: number; retries?: number };

export async function baFetch(path: string, attempt = 0, opts: BaFetchOptions = {}): Promise<any> {
  const retries = opts.retries ?? 3;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: HEADERS, ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}) });
  } catch (error) {
    if ((error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError") {
      throw new Error(`Arbeitsagentur antwortet nicht (Zeitlimit ${Math.round((opts.timeoutMs ?? 0) / 1000)} s)`);
    }
    throw error;
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt < retries) {
      await sleep(1000 * 2 ** attempt);
      return baFetch(path, attempt + 1, opts);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404 || body.includes("STELLENANGEBOT_NICHT_GEFUNDEN")) {
      throw new BaNotFoundError(`Arbeitsagentur 404: Stellenangebot nicht gefunden`);
    }
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

export function jobDetails(refnr: string, opts: BaFetchOptions = {}) {
  const enc = Buffer.from(refnr, "utf8").toString("base64");
  return baFetch(`/pc/v4/jobdetails/${encodeURIComponent(enc)}`, 0, opts);
}

export const politeDelay = () => sleep(350);
