import { getJobs, getPipelineBoard, getSettings } from "@/lib/data";
import { PipelineBoard, type JobOption } from "./pipeline-board";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pipeline — Jenny Mcrich Recruitment" };

/** Demo data mutates in-memory via server actions — never serve a stale board. */
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  // The board is capped per stage (cached scores) so it never loads or
  // re-scores every application; `counts` carries the true per-stage totals.
  const [board, jobs, settings] = await Promise.all([
    getPipelineBoard(),
    getJobs(),
    getSettings(),
  ]);

  // Only offer jobs that actually have cards on the board.
  const jobIdsOnBoard = new Set(board.cards.map((c) => c.jobId));
  const jobOptions: JobOption[] = jobs
    .filter((job) => jobIdsOnBoard.has(job.id))
    .map((job) => ({ id: job.id, label: `${job.title} — ${job.client_name}` }));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
      <PipelineBoard
        cards={board.cards}
        counts={board.counts}
        jobs={jobOptions}
        stalledDays={settings.stalled_days}
        stalledEnabled={settings.stalled_enabled}
      />
    </div>
  );
}
