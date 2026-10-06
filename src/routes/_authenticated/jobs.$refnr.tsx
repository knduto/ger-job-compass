import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadJobDetail } from "@/lib/sync.functions";
import { must, saveToPipeline } from "@/lib/queries";
import { PageHeader, Stat, fmtDate, fmtDateTime } from "@/components/AppShell";
import { salaryText } from "@/components/JobRow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_LABELS } from "@/lib/it-fields";
import { REMOTE_LABELS, SENIORITY_LABELS, parseEvidence } from "@/lib/tech-stack";
import { VISA_BADGE_CLASS, VISA_FLAG_LABELS, VISA_STATUS_LABELS } from "@/lib/visa-labels";

export const Route = createFileRoute("/_authenticated/jobs/$refnr")({
  head: () => ({
    meta: [
      { title: "Stellendetails — Smart-DE-Reise" },
      { name: "description", content: "Vollständige Stellenbeschreibung, Arbeitgeber und Quelle einer IT-Stelle." },
      { property: "og:title", content: "Stellendetails — Smart-DE-Reise" },
      { property: "og:description", content: "Details einer IT-Stelle aus der Bundesagentur für Arbeit." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { refnr } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(loadJobDetail);
  const job = useQuery({
    queryKey: ["job", refnr],
    queryFn: async () => (await must(supabase.from("jobs").select("*").eq("refnr", refnr).maybeSingle())).data,
  });
  const detail = useQuery({ queryKey: ["job-detail", refnr], queryFn: () => detailFn({ data: { refnr } }), enabled: !!job.data });
  const visa = useQuery({
    queryKey: ["job-visa", refnr],
    queryFn: async () => {
      const r = await (supabase as any).from("job_visa_feasibility").select("status,flags,evidence,analysed_at").eq("refnr", refnr).maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return r.data as { status: string; flags: string[]; evidence: string[]; analysed_at: string } | null;
    },
  });
  const tech = useQuery({
    queryKey: ["job-tech", refnr],
    queryFn: async () => {
      const r = await (supabase as any).from("job_tech_stack").select("core_skills,bonus_skills,seniority,remote_mode,flags,evidence,analysed_at").eq("refnr", refnr).maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return r.data as { core_skills: string[]; bonus_skills: string[]; seniority: string; remote_mode: string; flags: string[]; evidence: string[]; analysed_at: string } | null;
    },
  });
  const j = job.data;
  if (job.isLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (!j) return <p>Stelle nicht gefunden. <Link to="/explore" className="underline">Zurück</Link></p>;
  const baUrl = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(j.refnr)}`;
  const raw: any = detail.data?.raw;
  return (
    <>
      <PageHeader
        title={j.title}
        subtitle={`${j.employer ?? "Arbeitgeber unbekannt"} · ${j.city ?? "–"}${j.plz ? ` (${j.plz})` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button onClick={async () => { try { await saveToPipeline(j.refnr); toast.success("In Pipeline gespeichert"); qc.invalidateQueries({ queryKey: ["applications"] }); } catch (e) { toast.error((e as Error).message); } }}>+ Pipeline</Button>
            <Button variant="outline" asChild><a href={j.external_url ?? baUrl} target="_blank" rel="noreferrer">Original-Anzeige</a></Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap gap-1">
        {j.expired && <Badge variant="destructive">Abgelaufen</Badge>}
        {j.berufsfelder.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
        {j.homeoffice && <Badge className="bg-success text-success-foreground">Homeoffice</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Vertrag" value={<span className="text-base">{CONTRACT_LABELS[j.contract ?? ""] ?? j.contract ?? "–"}</span>} />
        <Stat label="Gehalt" value={<span className="text-base">{salaryText(j) ?? "Keine Angabe"}</span>} />
        <Stat label="Veröffentlicht" value={<span className="text-base">{fmtDate(j.published_from)}</span>} hint={`Eintritt ab ${fmtDate(j.entry_from)}`} />
        <Stat label="Referenznummer" value={<span className="break-all text-sm">{j.refnr}</span>} hint={`erstmals gesehen ${fmtDate(j.first_seen)} · zuletzt ${fmtDate(j.last_seen)}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 font-semibold">Stellenbeschreibung</h2>
          {detail.isLoading && <p className="text-sm text-muted-foreground">Lade Beschreibung von der Arbeitsagentur…</p>}
          {detail.data?.error && <p className="mb-2 text-sm text-destructive">{detail.data.error}</p>}
          {detail.data?.description ? (
            <div className="prose prose-sm max-w-none space-y-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold"><ReactMarkdown>{detail.data.description}</ReactMarkdown></div>
          ) : !detail.isLoading && <p className="text-sm text-muted-foreground">Keine Beschreibung verfügbar – bitte Original-Anzeige öffnen.</p>}
          {detail.data?.fetched_at && <p className="mt-4 text-xs text-muted-foreground">Abgerufen: {fmtDateTime(detail.data.fetched_at)}</p>}
        </article>
        <aside className="space-y-4 text-sm">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold">Chancenkarte & Arbeitserlaubnis</h3>
            {visa.isLoading ? <p className="text-muted-foreground">Lade…</p> : visa.error ? <p className="text-destructive">{(visa.error as Error).message}</p> : !visa.data ? <p className="text-muted-foreground">Noch nicht analysiert.</p> : (
              <div className="space-y-2">
                <Badge className={VISA_BADGE_CLASS[visa.data.status]}>{VISA_STATUS_LABELS[visa.data.status] ?? visa.data.status}</Badge>
                {visa.data.flags.length > 0 && <div className="flex flex-wrap gap-1">{visa.data.flags.map((f: string) => <Badge key={f} variant="outline">{VISA_FLAG_LABELS[f] ?? f}</Badge>)}</div>}
                {visa.data.evidence.map((e: string, i: number) => <blockquote key={i} className="border-l-2 border-border pl-2 text-xs italic text-muted-foreground">„{e}“</blockquote>)}
                <p className="text-xs text-muted-foreground">Abgeleitet ausschließlich aus der gespeicherten Stellenbeschreibung ({fmtDate(visa.data.analysed_at)}). Keine Rechtsberatung.</p>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold">Tech-Stack & Anforderungen</h3>
            {tech.isLoading ? <p className="text-muted-foreground">Lade…</p> : tech.error ? <p className="text-destructive">{(tech.error as Error).message}</p> : !tech.data ? <p className="text-muted-foreground">Noch nicht analysiert.</p> : tech.data.flags.includes("unavailable") ? <p className="text-muted-foreground">Anzeige bei der Arbeitsagentur nicht mehr verfügbar.</p> : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">Seniorität: {SENIORITY_LABELS[tech.data.seniority] ?? tech.data.seniority}</Badge>
                  <Badge variant="secondary">Arbeitsmodell: {REMOTE_LABELS[tech.data.remote_mode] ?? tech.data.remote_mode}</Badge>
                </div>
                <div><p className="text-xs font-medium">Kern</p><div className="flex flex-wrap gap-1" translate="no">{tech.data.core_skills.length ? tech.data.core_skills.map((k) => <Badge key={k}>{k}</Badge>) : <span className="text-xs text-muted-foreground">Keine erkannt</span>}</div></div>
                <div><p className="text-xs font-medium">Bonus</p><div className="flex flex-wrap gap-1" translate="no">{tech.data.bonus_skills.length ? tech.data.bonus_skills.map((k) => <Badge key={k} variant="outline">{k}</Badge>) : <span className="text-xs text-muted-foreground">Keine erkannt</span>}</div></div>
                <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Belegstellen ({tech.data.evidence.length})</summary>
                  <div className="mt-1 space-y-1">{tech.data.evidence.map((e, i) => { const p = parseEvidence(e); return <blockquote key={i} className="border-l-2 border-border pl-2 italic text-muted-foreground"><span className="not-italic font-medium text-foreground" translate="no">{p.value}</span> („{p.kind === "core" ? "Kern" : p.kind === "bonus" ? "Bonus" : p.kind === "seniority" ? "Seniorität" : "Arbeitsmodell"}“): „{p.excerpt}“</blockquote>; })}</div>
                </details>
                <p className="text-xs text-muted-foreground">Abgeleitet ausschließlich aus Titel und gespeicherter Beschreibung ({fmtDate(tech.data.analysed_at)}).</p>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold">Arbeitgeber</h3>
            <p>{j.employer ?? "–"}</p>
            {j.employer && <Link to="/employers/$name" params={{ name: j.employer }} className="mt-2 inline-block underline">Alle Stellen dieses Arbeitgebers</Link>}
          </div>
          {raw?.arbeitgeberAdresse && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 font-semibold">Adresse</h3>
              <p>{[raw.arbeitgeberAdresse.strasse, raw.arbeitgeberAdresse.plz, raw.arbeitgeberAdresse.ort].filter(Boolean).join(", ")}</p>
            </div>
          )}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold">Berufe</h3>
            <p>{j.alle_berufe.join(", ") || j.beruf || "–"}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 font-semibold">Gefunden über</h3>
            <p>{j.keywords.join(", ")}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
