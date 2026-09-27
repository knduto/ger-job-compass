import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/" });
        else toast.success("Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Wenn ein Konto existiert, wurde ein Link zum Zurücksetzen an deine E-Mail gesendet.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
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
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden"><Brand dark /></div>
          <h1 className="text-2xl font-semibold">{mode === "in" ? "Anmelden" : mode === "up" ? "Konto erstellen" : "Passwort zurücksetzen"}</h1>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label htmlFor="pw">Passwort</Label>
              <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Anmelden" : mode === "up" ? "Registrieren" : "Link zum Zurücksetzen senden"}</Button>
          <div className="flex flex-col gap-2">
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Noch kein Konto? Registrieren" : "Schon registriert? Anmelden"}
            </button>
            {mode === "in" && (
              <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setMode("reset")}>
                Passwort vergessen?
              </button>
            )}
          </div>
        </form>
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
