"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DataLayerError, moveApplicationStage } from "@/lib/data";
import { STAGES, type Stage } from "@/lib/data/types";

/**
 * Server action for the kanban board: move an application to a new stage.
 *
 * Domain rule 1 is enforced by the data layer — `moveApplicationStage`
 * updates `stage_entered_at` and appends to the activity log. The action
 * only validates input (zod) and translates failures into human-readable
 * messages the board can show in a toast (the owner is non-technical).
 */

const moveStageSchema = z.object({
  applicationId: z.string().min(1),
  stage: z.enum(STAGES),
});

export interface MoveStageSuccess {
  ok: true;
  applicationId: string;
  stage: Stage;
  daysInStage: number;
  isStalled: boolean;
  candidateName: string;
}

export interface MoveStageFailure {
  ok: false;
  error: string;
}

export type MoveStageResult = MoveStageSuccess | MoveStageFailure;

export async function moveStageAction(input: {
  applicationId: string;
  stage: Stage;
}): Promise<MoveStageResult> {
  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "That stage move looks invalid. Please refresh the board and try again.",
    };
  }

  try {
    const updated = await moveApplicationStage(parsed.data.applicationId, parsed.data.stage);

    // Stage moves ripple into every view that reads the pipeline.
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    revalidatePath(`/candidates/${updated.candidate_id}`);
    revalidatePath(`/jobs/${updated.job_id}`);
    revalidatePath("/analytics");

    return {
      ok: true,
      applicationId: updated.id,
      stage: updated.stage,
      daysInStage: updated.days_in_stage,
      isStalled: updated.is_stalled,
      candidateName: updated.candidate.full_name,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DataLayerError
          ? error.message
          : "Could not move the candidate. Please try again.",
    };
  }
}
