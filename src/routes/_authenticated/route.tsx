import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { enforceInactivity } from "@/lib/session-policy";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Read the local session only; never validate with getUser() here, because
    // a transient failure there removes the session and logs out every tab.
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) throw redirect({ to: "/auth" });
    if (await enforceInactivity()) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
