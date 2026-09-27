import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, fmtDate } from "@/components/AppShell";
import { STAGES } from "@/lib/it-fields";
import { fetchMyApplications } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Bewerbungs-Pipeline — Smart-DE-Reise" },
      { name: "description", content: "Bewerbungen von gespeichert bis Angebot verfolgen, mit Notizen, Lebenslauf-Version und Wiedervorlage." },
      { property: "og:title", content: "Bewerbungs-Pipeline — Smart-DE-Reise" },
      { property: "og:description", content: "Bewerbungsstatus und Konversionsraten im Blick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pipeline,
});

type App = Awaited<ReturnType<typeof fetchMyApplications>>[number];

function Pipeline() {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["applications"], queryFn: fetchMyApplications });
  const [view, setView] = useState<"board" | "table">("board");
  const [edit, setEdit] = useState<App | null>(null);
  const list = apps.data ?? [];
  const count = (s: string) => list.filter((a) => a.stage === s).length;
  const reachedApplied = list.filter((a) => ["applied", "interview", "offer", "rejected"].includes(a.stage)).length;
  const reachedInterview = list.filter((a) => ["interview", "offer"].includes(a.stage)).length;

  async function move(a: App, stage: string) {
    const patch: any = { stage };
    if (stage === "applied" && !a.applied_at) patch.applied_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("applications").update(patch).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["applications"] });
  }

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Deine Bewerbungen – nur für dich sichtbar."
        actions={<div className="flex gap-2"><Button variant={view === "board" ? "default" : "outline"} size="sm" onClick={() => setView("board")}>Board</Button><Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>Tabelle</Button></div>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gesamt" value={list.length} />
        <Stat label="Beworben (inkl. weiter)" value={reachedApplied} />
        <Stat label="Interview-Quote" value={reachedApplied ? `${Math.round((100 * reachedInterview) / reachedApplied)} %` : "–"} hint="Interview+Angebot / Beworben" />
        <Stat label="Angebote" value={count("offer")} />
      </div>
      {list.length === 0 && !apps.isLoading && (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Noch leer. Speichere Stellen über <Link to="/explore" className="underline">Jobs erkunden</Link>.</p>
      )}
      {view === "board" ? (
        <div className="grid gap-4 overflow-x-auto lg:grid-cols-5">
          {STAGES.map((s) => (
            <div key={s.id} className="min-w-56 rounded-lg bg-muted p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("id"); const a = list.find((x) => x.id === id); if (a && a.stage !== s.id) move(a, s.id); }}>
              <div className="mb-3 flex justify-between text-sm font-semibold"><span>{s.label}</span><span className="font-mono">{count(s.id)}</span></div>
              <div className="space-y-2">
                {list.filter((a) => a.stage === s.id).map((a) => (
                  <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", a.id)} onClick={() => setEdit(a)}
                    className="cursor-pointer rounded-md border bg-card p-3 text-sm shadow-sm hover:border-accent">
                    <div className="font-medium leading-snug">{a.job?.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{a.job?.employer} · {a.job?.city}</div>
                    {a.follow_up && <div className="mt-1 text-xs text-destructive">Wiedervorlage {fmtDate(a.follow_up)}</div>}
                    {a.job?.expired && <div className="mt-1 text-xs text-destructive">Anzeige abgelaufen</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>{["Stelle", "Arbeitgeber", "Stadt", "Status", "Beworben", "Lebenslauf", "Wiedervorlage"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setEdit(a)}>
                  <td className="px-3 py-2">{a.job?.title}</td><td className="px-3 py-2">{a.job?.employer}</td><td className="px-3 py-2">{a.job?.city}</td>
                  <td className="px-3 py-2">{STAGES.find((s) => s.id === a.stage)?.label}</td><td className="px-3 py-2">{fmtDate(a.applied_at)}</td>
                  <td className="px-3 py-2">{a.resume_version ?? "–"}</td><td className="px-3 py-2">{fmtDate(a.follow_up)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <EditDialog app={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EditDialog({ app, onClose }: { app: App; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    stage: app.stage, applied_at: app.applied_at ?? "", resume_version: app.resume_version ?? "",
    contact: app.contact ?? "", notes: app.notes ?? "", follow_up: app.follow_up ?? "",
  });
  async function save() {
    const { error } = await supabase.from("applications").update({
      stage: f.stage, applied_at: f.applied_at || null, resume_version: f.resume_version.trim() || null,
      contact: f.contact.trim() || null, notes: f.notes.trim() || null, follow_up: f.follow_up || null,
    }).eq("id", app.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gespeichert"); qc.invalidateQueries({ queryKey: ["applications"] }); onClose();
  }
  async function remove() {
    const { error } = await supabase.from("applications").delete().eq("id", app.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["applications"] }); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{app.job?.title}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{app.job?.employer} · <Link to="/jobs/$refnr" params={{ refnr: app.refnr }} className="underline">Stelle öffnen</Link></p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1"><Label>Status</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></div>
          <div className="space-y-1"><Label>Beworben am</Label><Input type="date" value={f.applied_at} onChange={(e) => setF({ ...f, applied_at: e.target.value })} /></div>
          <div className="space-y-1"><Label>Lebenslauf-Version</Label><Input maxLength={100} value={f.resume_version} onChange={(e) => setF({ ...f, resume_version: e.target.value })} placeholder="z.B. CV_DE_v3" /></div>
          <div className="space-y-1"><Label>Wiedervorlage</Label><Input type="date" value={f.follow_up} onChange={(e) => setF({ ...f, follow_up: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>Kontaktperson</Label><Input maxLength={200} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>Notizen</Label><Textarea maxLength={5000} rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-between"><Button variant="ghost" className="text-destructive" onClick={remove}>Entfernen</Button><Button onClick={save}>Speichern</Button></div>
      </DialogContent>
    </Dialog>
  );
}
