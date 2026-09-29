import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Two-step login: step 1 verifies the password on the server and e-mails a
 * 6-digit code, step 2 verifies the code and hands back a one-time token hash
 * the browser exchanges for a session. Both functions are unauthenticated by
 * design (the caller has no session yet) and therefore hardened:
 * generic errors, rate limits, hashed codes, attempt counting.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const GENERIC_LOGIN_ERROR = "E-Mail-Adresse oder Passwort ist nicht korrekt.";
const GENERIC_CODE_ERROR = "Der Code ist ungültig oder abgelaufen.";

function hashCode(code: string, userId: string): string {
  return createHash("sha256").update(`${code}:${userId}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

type UntypedClient = { from: (t: string) => any };
function untypedTable(client: unknown): UntypedClient {
  return client as UntypedClient;
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Publishable-key client used only to check the password; never persists a session. */
async function makePasswordChecker() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function codeEmail(code: string) {
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f5f5f4;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <div style="font-size:18px;font-weight:700">Smart-DE-Reise</div>
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#78716c;margin-top:4px">Mein Weg bei der Jobsuche</div>
    <p style="margin:28px 0 8px;font-size:15px">Dein Bestätigungscode für die Anmeldung:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:.32em;padding:18px 0;text-align:center;background:#f5f5f4;border-radius:12px">${code}</div>
    <p style="margin:20px 0 0;font-size:13px;color:#57534e">Der Code ist 10 Minuten gültig und kann nur einmal verwendet werden.</p>
    <p style="margin:12px 0 0;font-size:13px;color:#57534e">Wenn du diese Anmeldung nicht ausgelöst hast, ignoriere diese E-Mail und ändere dein Passwort.</p>
  </div></body></html>`;
  const text = `Smart-DE-Reise — Bestätigungscode für die Anmeldung\n\n${code}\n\nDer Code ist 10 Minuten gültig und kann nur einmal verwendet werden.\nWenn du diese Anmeldung nicht ausgelöst hast, ignoriere diese E-Mail.`;
  return { html, text };
}

async function sendCodeEmail(to: string, code: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const from = process.env["EMAIL_FROM"];
  if (!apiKey || !from) {
    throw new Error("Der E-Mail-Versand ist noch nicht eingerichtet. Bitte Absenderdomain hinterlegen.");
  }
  const { sendLovableEmail } = await import("@lovable.dev/email-js");
  const { html, text } = codeEmail(code);
  const res = await sendLovableEmail(
    {
      to,
      from,
      sender_domain: "notify.johnnduto.app",
      subject: "Dein Anmeldecode für Smart-DE-Reise",
      html,
      text,
      purpose: "transactional",
      label: "login-code",
      idempotency_key: `login-code-${createHash("sha256").update(`${to}:${code}`).digest("hex").slice(0, 32)}`,
    } as Parameters<typeof sendLovableEmail>[0],
    { apiKey },
  );
  if (res && (res as { sent?: boolean }).sent === false) {
    throw new Error("Diese E-Mail-Adresse ist für den Versand gesperrt (z. B. nach Abmeldung oder Zustellfehler).");
  }
}

export const requestLoginCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const started = Date.now();
    const settle = async () => {
      const elapsed = Date.now() - started;
      if (elapsed < 600) await pause(600 - elapsed);
    };

    const checker = await makePasswordChecker();
    const { data: signIn, error } = await checker.auth.signInWithPassword({ email, password: data.password });
    const userId = signIn?.user?.id;
    // Drop the throwaway session immediately — it must never become a login.
    await checker.auth.signOut().catch(() => undefined);
    if (error || !userId) {
      await settle();
      throw new Error(GENERIC_LOGIN_ERROR);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // login_codes is service-role-only and not part of the generated types.
    const codes = untypedTable(supabaseAdmin);

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await codes
      .from("login_codes")
      .select("id, created_at")
      .eq("user_id", userId)
      .gte("created_at", hourAgo)
      .order("created_at", { ascending: false });

    const list = recent ?? [];
    if (list.length >= MAX_CODES_PER_HOUR) {
      await settle();
      throw new Error("Zu viele Anmeldeversuche. Bitte versuche es in einer Stunde erneut.");
    }
    const newest = list[0]?.created_at ? new Date(list[0].created_at as string).getTime() : 0;
    if (newest && Date.now() - newest < RESEND_COOLDOWN_MS) {
      await settle();
      throw new Error("Es wurde gerade ein Code gesendet. Bitte warte einen Moment.");
    }

    const now = new Date().toISOString();
    await codes
      .from("login_codes")
      .update({ consumed_at: now })
      .eq("user_id", userId)
      .is("consumed_at", null);

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    const { error: insertError } = await codes.from("login_codes").insert({
      user_id: userId,
      code_hash: hashCode(code, userId),
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) {
      await settle();
      throw new Error("Der Code konnte nicht erstellt werden. Bitte versuche es erneut.");
    }

    await sendCodeEmail(email, code);
    await settle();
    return { expiresAt: expiresAt.toISOString() };
  });

export const verifyLoginCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(200),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codes = untypedTable(supabaseAdmin);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = users?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) throw new Error(GENERIC_CODE_ERROR);

    const { data: rows } = await codes
      .from("login_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("user_id", user.id)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) throw new Error(GENERIC_CODE_ERROR);
    if ((row.attempts as number) >= MAX_ATTEMPTS) {
      await codes.from("login_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      throw new Error("Zu viele Fehlversuche. Bitte fordere einen neuen Code an.");
    }

    if (!sameHash(row.code_hash as string, hashCode(data.code, user.id))) {
      const attempts = (row.attempts as number) + 1;
      await codes
        .from("login_codes")
        .update(attempts >= MAX_ATTEMPTS ? { attempts, consumed_at: new Date().toISOString() } : { attempts })
        .eq("id", row.id);
      throw new Error(
        attempts >= MAX_ATTEMPTS
          ? "Zu viele Fehlversuche. Bitte fordere einen neuen Code an."
          : `${GENERIC_CODE_ERROR} ${MAX_ATTEMPTS - attempts} Versuch(e) übrig.`,
      );
    }

    await codes.from("login_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) throw new Error("Die Anmeldung konnte nicht abgeschlossen werden.");
    return { tokenHash };
  });
