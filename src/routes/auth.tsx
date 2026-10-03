import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { setRememberMe } from "@/lib/session-policy";
import { requestLoginCode, verifyLoginCode } from "@/lib/mfa.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden — Smart-DE-Reise" },
      { name: "description", content: "Melde dich bei Smart-DE-Reise an, deinem privaten IT-Jobsuche-Cockpit für Deutschland." },
      { property: "og:title", content: "Anmelden — Smart-DE-Reise" },
      { property: "og:description", content: "Privates IT-Jobsuche-Cockpit für die Chancenkarte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const sendCode = useServerFn(requestLoginCode);
  const checkCode = useServerFn(verifyLoginCode);

  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resendAt, setResendAt] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (step === "code") otpRef.current?.focus();
  }, [step]);

  const remaining = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((expiresAt - now) / 1000));
  }, [expiresAt, now]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await sendCode({ data: { email, password } });
      setExpiresAt(new Date(res.expiresAt).getTime());
      setResendAt(Date.now() + 60_000);
      setCode("");
      setStep("code");
    } catch (err) {
      setError((err as Error).message || "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const res = await sendCode({ data: { email, password } });
      setExpiresAt(new Date(res.expiresAt).getTime());
      setResendAt(Date.now() + 60_000);
      setCode("");
    } catch (err) {
      setError((err as Error).message || "Der Code konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value: string) {
    setBusy(true);
    setError(null);
    try {
      const { tokenHash } = await checkCode({ data: { email, code: value } });
      const { error: otpError } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
      if (otpError) throw otpError;
      setRememberMe(remember);
      navigate({ to: "/" });
    } catch (err) {
      setCode("");
      setError((err as Error).message || "Der Code konnte nicht geprüft werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Brand />
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">
            Daten statt Bauchgefühl.<br />
            <span className="text-sidebar-primary">Finde Job und Stadt.</span>
          </p>
          <p className="mt-4 max-w-md text-sm opacity-70">Live-Stellen der Bundesagentur für Arbeit, täglich gesammelt, nach IT-Berufsfeldern gefiltert.</p>
        </div>
        <div className="flex h-1.5 w-32 overflow-hidden rounded-full">
          <span className="flex-1 bg-foreground" /><span className="flex-1 bg-destructive" /><span className="flex-1 bg-accent" />
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        {step === "credentials" ? (
          <form onSubmit={submitCredentials} className="w-full max-w-sm space-y-5">
            <div className="lg:hidden"><Brand dark /></div>
            <div>
              <h1 className="text-2xl font-semibold">Anmelden</h1>
              <p className="mt-1 text-sm text-muted-foreground">Privater Zugang. Nach dem Passwort folgt ein Bestätigungscode per E-Mail.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Passwort</Label>
              <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="remember" className="flex items-center gap-2 text-sm">
                <input id="remember" type="checkbox" className="h-4 w-4 accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Angemeldet bleiben
              </label>
              <p className="text-xs text-muted-foreground">
                {remember ? "Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest." : "Du wirst nach 12 Stunden Inaktivität automatisch abgemeldet."}
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : "Weiter"}</Button>
          </form>
        ) : (
          <div className="w-full max-w-sm space-y-5">
            <div className="lg:hidden"><Brand dark /></div>
            <div>
              <h1 className="text-2xl font-semibold">Bestätigungscode</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Wir haben einen 6-stelligen Code an <span className="font-medium text-foreground">{maskEmail(email)}</span> gesendet.
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="otp">Code</Label>
              <InputOTP
                id="otp"
                ref={otpRef}
                maxLength={6}
                value={code}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={busy}
                onChange={(value) => {
                  const digits = value.replace(/\D/g, "").slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6) void submitCode(digits);
                }}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 rounded-md border text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">
                {remaining > 0 ? `Gültig noch ${countdown} Minuten.` : "Der Code ist abgelaufen. Bitte fordere einen neuen an."}
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => void submitCode(code)}>
              {busy ? "…" : "Anmelden"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-muted-foreground underline" onClick={() => { setStep("credentials"); setError(null); setCode(""); }}>
                Zurück
              </button>
              <button
                type="button"
                className="text-muted-foreground underline disabled:no-underline disabled:opacity-50"
                disabled={busy || resendIn > 0}
                onClick={() => void resend()}
              >
                {resendIn > 0 ? `Code erneut senden (${resendIn}s)` : "Code erneut senden"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Brand({ dark }: { dark?: boolean }) {
  return (
    <div>
      <div className={`font-display text-xl font-bold ${dark ? "text-foreground" : ""}`}>Smart-DE-Reise</div>
      <div className="text-xs uppercase tracking-widest opacity-60">Mein Weg bei der Jobsuche</div>
    </div>
  );
}
