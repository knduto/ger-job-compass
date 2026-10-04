import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BatchRunnerPanel } from "@/components/BatchRunnerPanel";
import { getLanguageAnalysisStatus, processLanguageBatch } from "@/lib/reports.functions";
import { useBatchRunner } from "@/lib/use-batch-runner";

export function LanguageRunner({ onSettled }: { onSettled: () => Promise<unknown> | void }) {
  const analyseFn = useServerFn(processLanguageBatch);
  const statusFn = useServerFn(getLanguageAnalysisStatus);
  const status = useQuery({ queryKey: ["language-status"], queryFn: () => statusFn({ data: {} as any }), retry: 1 });
  const runner = useBatchRunner(
    () => analyseFn({ data: { limit: 10 } }),
    () => Promise.all([status.refetch(), onSettled()]),
  );
  return (
    <BatchRunnerPanel
      title="Massenanalyse der Sprachanforderungen"
      startLabel="Massenanalyse starten"
      runner={runner}
      base={status.data}
      baseError={status.error}
      testId="bulk-runner"
    />
  );
}
