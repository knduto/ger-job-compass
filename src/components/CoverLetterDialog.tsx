import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { must, saveToPipeline } from "@/lib/queries";
import { buildCoverLetter, type CoverLetterMode, type CoverLetterProfile } from "@/lib/cover-letter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEY = "smart-de-reise:cover-letter-profile";
const EMPTY: CoverLetterProfile = { name: "", contactLine: "", availability: "ab sofort", roleFocus: "", salary: "", contactPerson: "", germanLevel: "", skills: "" };

export function CoverLetterDialog({ refnr, open, onClose }: { refnr: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [profile, setProfile] = useState<CoverLetterProfile>(EMPTY);
  const [mode, setMode] = useState<CoverLetterMode>("de");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setProfile({ ...EMPTY, ...JSON.parse(s) }); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ } }, [profile]);

  const data = useQuery({
    queryKey: ["cover-letter-data", refnr],
    enabled: open,
    queryFn: async () => {
      const job = (await must(supabase.from("jobs").select("title,employer,city,refnr").eq("refnr", refnr).maybeSingle())).data;
      const t = await (supabase as any).from("job_tech_stack").select("core_skills,bonus_skills,flags").eq("refnr", refnr).maybeSingle();
      const l = await supabase.from("job_language_analysis").select("classification,cefr_level").eq("refnr", refnr).maybeSingle();
      if (t.error) throw new Error(t.error.message);
      if (l.error) throw new Error(l.error.message);
      const tech = t.data && !(t.data.flags ?? []).includes("unavailable") ? t.data : null;
      return { job, tech, language: l.data };
    },
  });

  const generated = useMemo(() => {
    if (!data.data?.job) return "";
    return buildCoverLetter({ mode, job: data.data.job, tech: data.data.tech, language: data.data.language, profile });
  }, [data.data, mode, profile]);
  useEffect(() => { if (!dirty) setText(generated); }, [generated, dirty]);

  const set = (k: keyof CoverLetterProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, [k]: e.target.value });

  async function copy() { await navigator.clipboard.writeText(text); toast.success("In Zwischenablage kopiert"); }
  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const emp = (data.data?.job?.employer ?? "Arbeitgeber").replace(/[^\wäöüÄÖÜß-]+/g, "_");
    a.href = URL.createObjectURL(blob); a.download = `Anschreiben_${emp}_${refnr}.txt`; a.click();
    URL.revokeObjectURL(a.href);
  }
  async function saveNotes() {
    try {
      await saveToPipeline(refnr);
      const cur = await supabase.from("applications").select("id,notes").eq("refnr", refnr).maybeSingle();
      if (cur.error || !cur.data) throw new Error(cur.error?.message ?? "Bewerbung nicht gefunden");
      const stamp = new Date().toLocaleDateString("de-DE");
      const notes = [cur.data.notes, `--- Anschreiben (${stamp}) ---\n${text}`].filter(Boolean).join("\n\n");
      const { error } = await supabase.from("applications").update({ notes }).eq("id", cur.data.id);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["applications"] });
      toast.success("In Pipeline-Notizen gespeichert");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Anschreiben</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">Vorlage aus gespeicherten Anzeigedaten und deinen Angaben – keine KI-Texte. Fehlende Daten werden weggelassen.</p>
        {data.error && <p className="text-sm text-destructive">{(data.error as Error).message}</p>}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "de" ? "default" : "outline"} onClick={() => { setMode("de"); setDirty(false); }}>Klassisch Deutsch</Button>
              <Button size="sm" variant={mode === "en" ? "default" : "outline"} onClick={() => { setMode("en"); setDirty(false); }}>International English</Button>
            </div>
            {([["name", "Name"], ["contactLine", "Kontaktzeile (E-Mail, Telefon)"], ["availability", "Verfügbarkeit (ab sofort oder JJJJ-MM-TT)"], ["roleFocus", "Fachlicher Schwerpunkt"], ["salary", "Gehaltsvorstellung (€ brutto/Jahr, optional)"], ["contactPerson", "Ansprechpartner (optional)"], ["germanLevel", "Eigenes Deutschniveau (z. B. B1)"], ["skills", "Eigene Skills (kommagetrennt)"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input value={profile[k]} maxLength={300} onChange={(e) => { set(k)(e); setDirty(false); }} /></div>
            ))}
            <div className="rounded-md border bg-muted p-3 text-xs">
              <p className="mb-1 font-semibold">Lebenslauf-Tipps</p>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                <li>Statuszeile: „Aufenthaltstitel: Chancenkarte (§ 20a AufenthG)“</li>
                <li>Umgekehrt chronologisch, Daten als MM/JJJJ</li>
                <li>Tech-Stack je Position statt einer Skill-Wolke</li>
                <li>Sprachen mit GER-Selbsteinschätzung (A1–C2)</li>
              </ul>
            </div>
          </div>
          <div className="space-y-2">
            <Textarea rows={24} className="font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} />
            {dirty && <button className="text-xs underline text-muted-foreground" onClick={() => setDirty(false)}>Manuelle Änderungen verwerfen</button>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} disabled={!text}>Kopieren</Button>
              <Button size="sm" variant="outline" onClick={download} disabled={!text}>.txt herunterladen</Button>
              <Button size="sm" variant="outline" onClick={saveNotes} disabled={!text}>In Pipeline-Notizen speichern</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
