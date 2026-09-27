import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "./auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Passwort zurücksetzen — Smart-DE-Reise" },
      { name: "description", content: "Neues Passwort für Smart-DE-Reise setzen." },
      { property: "og:title", content: "Passwort zurücksetzen — Smart-DE-Reise" },
      { property: "og:description", content: "Neues Passwort setzen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash; the client picks it up
    // and fires PASSWORD_RECOVERY once the session is established.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    if (window.location.hash.includes("type=recovery")) setReady(true);
    else {
      const t = setTimeout(() => setInvalid((v) => v || !window.location.hash.includes("type=recovery")), 3000);
      return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Passwort aktualisiert. Du bist jetzt angemeldet.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <Brand dark />
        <h1 className="text-2xl font-semibold">Neues Passwort setzen</h1>
        {invalid && !ready ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.</p>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>Zur Anmeldung</Button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">Link wird geprüft…</p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pw1">Neues Passwort</Label>
              <Input id="pw1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Passwort wiederholen</Label>
              <Input id="pw2" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : "Passwort speichern"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
