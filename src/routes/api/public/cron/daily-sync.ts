import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/daily-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { startRun, syncKeyword, recordKeyword, finishRun } = await import("@/lib/sync.server");
        const run = await startRun(supabaseAdmin, "daily");
        const { data: kws } = await supabaseAdmin.from("search_keywords").select("term").eq("active", true).order("term");
        for (const k of kws ?? []) {
          try {
            const c = await syncKeyword(supabaseAdmin, k.term, run.started_at);
            await recordKeyword(supabaseAdmin, run.id, c);
          } catch (e) {
            await recordKeyword(supabaseAdmin, run.id, { requests: 0, fetched: 0, skipped: 0, new: 0, updated: 0, errors: [`${k.term}: ${(e as Error).message}`] });
          }
        }
        const result = await finishRun(supabaseAdmin, run.id);
        return Response.json({ runId: run.id, ...result });
      },
    },
  },
});
