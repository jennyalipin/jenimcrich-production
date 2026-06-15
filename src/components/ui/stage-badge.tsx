import { badgeBaseClass } from "./badge";
import { cn } from "./cn";

export const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Accepts display casing ("Interview") or DB enum casing ("interview"). */
export type StageInput = PipelineStage | Lowercase<PipelineStage>;

/* Hues ramp with pipeline heat: slate -> blue -> cyan -> amber -> emerald;
   red is the exit. Matches the prototype's STAGE_BADGE map. */
const stageClass: Record<PipelineStage, string> = {
  Applied: "bg-slate-200 text-slate-700 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]",
  Screening: "bg-info-soft text-info-ink shadow-[inset_0_0_0_1px_rgb(2_132_199/0.2)]",
  Interview: "bg-interview-soft text-interview-ink shadow-[inset_0_0_0_1px_rgb(8_145_178/0.22)]",
  Offer: "bg-warning-soft text-warning-ink shadow-[inset_0_0_0_1px_rgb(217_119_6/0.2)]",
  Hired: "bg-primary-soft text-primary-ink shadow-[inset_0_0_0_1px_rgb(5_150_105/0.2)]",
  Rejected: "bg-danger-soft text-danger-ink shadow-[inset_0_0_0_1px_rgb(220_38_38/0.18)]",
};

function normalizeStage(stage: StageInput): PipelineStage {
  return (stage.charAt(0).toUpperCase() +
    stage.slice(1).toLowerCase()) as PipelineStage;
}

export interface StageBadgeProps {
  stage: StageInput;
  className?: string;
}

/** Pipeline-stage chip with the fixed per-stage hue. */
export function StageBadge({ stage, className }: StageBadgeProps) {
  const normalized = normalizeStage(stage);
  const tone = stageClass[normalized] ?? stageClass.Applied;
  return <span className={cn(badgeBaseClass, tone, className)}>{normalized}</span>;
}
