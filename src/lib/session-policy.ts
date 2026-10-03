import { supabase } from "@/integrations/supabase/client";

// "Angemeldet bleiben" policy. Unticked => sign out locally after 12h of inactivity.
const FLAG = "sdr-session-only";
const LAST = "sdr-last-activity";
export const INACTIVITY_MS = 12 * 60 * 60 * 1000;

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.removeItem(FLAG);
    localStorage.removeItem(LAST);
  } else {
    localStorage.setItem(FLAG, "1");
    localStorage.setItem(LAST, String(Date.now()));
  }
}

export function isSessionOnly() {
  return typeof window !== "undefined" && localStorage.getItem(FLAG) === "1";
}

export function isInactiveExpired(now = Date.now()) {
  if (!isSessionOnly()) return false;
  const last = Number(localStorage.getItem(LAST) ?? 0);
  return !last || now - last > INACTIVITY_MS;
}

export async function enforceInactivity() {
  if (!isInactiveExpired()) return false;
  localStorage.removeItem(LAST);
  await supabase.auth.signOut({ scope: "local" });
  return true;
}

/** Tracks activity (throttled) and checks expiry every minute. Returns cleanup. */
export function startActivityTracking() {
  let lastWrite = 0;
  const touch = () => {
    if (!isSessionOnly()) return;
    const now = Date.now();
    if (now - lastWrite < 30_000) return;
    lastWrite = now;
    localStorage.setItem(LAST, String(now));
  };
  const events = ["click", "keydown", "pointerdown", "visibilitychange"] as const;
  void enforceInactivity().then((out) => { if (!out) touch(); });
  events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
  const timer = window.setInterval(() => void enforceInactivity(), 60_000);
  return () => {
    events.forEach((e) => window.removeEventListener(e, touch));
    window.clearInterval(timer);
  };
}
