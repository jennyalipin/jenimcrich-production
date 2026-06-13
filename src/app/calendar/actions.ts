"use server";

/**
 * Server actions for the Interview Calendar. Inputs are zod-validated; the
 * data layer's double-booking guard (DataLayerError "SLOT_TAKEN") is passed
 * through as a human-readable form error for inline display.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DataLayerError,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  scheduleInterview,
} from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export interface ScheduleFailure {
  ok: false;
  /** Form-level, human-readable error (e.g. the SLOT_TAKEN message). */
  formError?: string;
  fieldErrors?: Record<string, string>;
}

export type ScheduleInterviewResult =
  | { ok: true; confirmation: string }
  | ScheduleFailure;

const scheduleSchema = z.object({
  application_id: z.string().trim().min(1, "Pick the candidate + role to interview"),
  interviewer_id: z.string().trim().min(1, "Pick an interviewer"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time slot"),
  interview_type: z.enum(INTERVIEW_TYPES, { message: "Pick an interview type" }),
  duration_minutes: z.union(
    [z.literal(30), z.literal(45), z.literal(60), z.literal(90)],
    { message: "Pick a duration" },
  ),
});

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export async function scheduleInterviewAction(
  payload: unknown,
): Promise<ScheduleInterviewResult> {
  const parsed = scheduleSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { application_id, interviewer_id, date, time, interview_type, duration_minutes } =
    parsed.data;

  // Demo convention: slots are stored and rendered in UTC.
  const startsAt = `${date}T${time}:00.000Z`;
  const ms = Date.parse(startsAt);
  if (Number.isNaN(ms) || startsAt.slice(0, 10) !== new Date(ms).toISOString().slice(0, 10)) {
    return { ok: false, fieldErrors: { date: "That date doesn't exist — double-check it." } };
  }

  try {
    const interview = await scheduleInterview({
      application_id,
      interviewer_id,
      starts_at: startsAt,
      interview_type,
      duration_minutes,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath(`/candidates/${interview.candidate_id}`);

    return {
      ok: true,
      confirmation: `${interview.candidate.full_name} — ${INTERVIEW_TYPE_LABELS[interview.interview_type]}, ${formatDateTime(interview.starts_at)} with ${interview.interviewer_name}`,
    };
  } catch (error) {
    if (error instanceof DataLayerError) {
      // "SLOT_TAKEN" (double-booking) and friends arrive with a message
      // that is safe to show the user verbatim.
      return { ok: false, formError: error.message };
    }
    return {
      ok: false,
      formError: "Something went wrong while booking the interview. Please try again.",
    };
  }
}
