import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Search, KanbanSquare, Building2, MapPin, Activity, RefreshCw, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Übersicht", icon: LayoutDashboard },
  { to: "/explore", label: "Jobs erkunden", icon: Search },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/employers", label: "Arbeitgeber", icon: Building2 },
  { to: "/reports", label: "Städte-Reports", icon: MapPin },
  { to: "/data-health", label: "Datenqualität", icon: Activity },
  { to: "/sync", label: "Live-Abruf", icon: RefreshCw },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-8 px-2">
          <div className="font-display text-lg font-bold">Smart-DE-Reise</div>
          <div className="text-[10px] uppercase tracking-widest opacity-60">Mein Weg bei der Jobsuche</div>
          <div className="mt-3 flex h-1 w-16 overflow-hidden rounded-full">
            <span className="flex-1 bg-foreground" /><span className="flex-1 bg-destructive" /><span className="flex-1 bg-accent" />
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-80 transition hover:bg-sidebar-accent hover:opacity-100"
              activeProps={{ className: "bg-sidebar-accent !opacity-100 text-sidebar-primary" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut({ scope: "local" }); navigate({ to: "/auth", replace: true }); }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-70 hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Abmelden
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto border-b bg-sidebar p-2 text-sidebar-foreground md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} className="whitespace-nowrap rounded px-3 py-1.5 text-xs" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const fmt = (n: number | null | undefined) => (n == null ? "–" : new Intl.NumberFormat("de-DE").format(n));
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("de-DE") : "–");
export const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("de-DE") : "–");
