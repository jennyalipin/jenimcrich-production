import {
  getApplicationsByStage,
  getJobs,
  getSettings,
  isRestrictiveVisa,
  toScoreCandidate,
  toScoreJob,
} from "@/lib/data";
import { STAGES } from "@/lib/data/types";
import { matchScore } from "@/lib/scoring";
import { PipelineBoard, type BoardCard, type JobOption } from "./pipeline-board";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pipeline — JeniMcRich Recruitment" };

/** Demo data mutates in-memory via server actions — never serve a stale board. */
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [byStage, jobs, settings] = await Promise.all([
    getApplicationsByStage(),
    getJobs(),
    getSettings(),
  ]);

  // Flatten to plain serializable cards; score each candidate against the
  // job on their own application (domain rule 2) on the server so the
  // client board stays a thin interaction layer.
  const cards: BoardCard[] = STAGES.flatMap((stage) =>
    byStage[stage].map((app) => ({
      applicationId: app.id,
      candidateId: app.candidate_id,
      jobId: app.job_id,
      candidateName: app.candidate.full_name,
      flagged: app.candidate.flagged,
      jobTitle: app.job.title,
      restrictiveVisa: isRestrictiveVisa(app.job.visa),
      score: matchScore(toScoreCandidate(app.candidate), toScoreJob(app.job)).score,
      stage,
      daysInStage: app.days_in_stage,
      isStalled: app.is_stalled,
    })),
  );

  // Only offer jobs that actually have cards on the board.
  const jobIdsOnBoard = new Set(cards.map((c) => c.jobId));
  const jobOptions: JobOption[] = jobs
    .filter((job) => jobIdsOnBoard.has(job.id))
    .map((job) => ({ id: job.id, label: `${job.title} — ${job.client_name}` }));

  return (
    <div className="flex h-full flex-col p-6">
      <PipelineBoard
        cards={cards}
        jobs={jobOptions}
        stalledDays={settings.stalled_days}
        stalledEnabled={settings.stalled_enabled}
      />
    </div>
  );
}
