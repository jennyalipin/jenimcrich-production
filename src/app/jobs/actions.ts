"use server";

/**
 * Server actions for the Jobs area. All inputs are validated with zod —
 * never trust the client payload. Error messages are written for the
 * non-technical agency owner.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DataLayerError, VISA_TYPES, getClients, getJob } from "@/lib/data";
import {
  addLocalJobNote,
  createLocalJob,
  getLocalJob,
} from "./_lib/job-store";

/* ------------------------------------------------------------------ */
/* Shared result shapes (serializable)                                  */
/* ------------------------------------------------------------------ */

export interface JobActionFailure {
  ok: false;
  /** Form-level, human-readable error. */
  formError?: string;
  /** First message per offending field, keyed by field name. */
  fieldErrors?: Record<string, string>;
}

export type CreateJobResult = { ok: true; jobId: string } | JobActionFailure;
export type AddJobNoteResult = { ok: true } | JobActionFailure;

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Create job                                                           */
/* ------------------------------------------------------------------ */

const skillSchema = z.object({
  skill: z.string().trim().min(1, "Skill name is required").max(60, "Keep skill names short"),
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    message: "Weight must be 1, 2 or 3",
  }),
});

const createJobSchema = z.object({
  title: z.string().trim().min(2, "Give the listing a title").max(120, "Title is too long"),
  client_name: z
    .string()
    .trim()
    .min(2, "Which client is this role for?")
    .max(120, "Client name is too long"),
  location: z.string().trim().max(120, "Location is too long").default(""),
  salary_range: z.string().trim().max(120, "Salary range is too long").default(""),
  min_years: z.coerce
    .number({ message: "Minimum years must be a number" })
    .int("Use whole years")
    .min(0, "Years can't be negative")
    .max(40, "That's more than a career — check the years")
    .default(0),
  status: z.enum(["open", "on_hold"], { message: "Pick a status" }).default("open"),
  visa: z.enum(VISA_TYPES, { message: "Pick a work-authorization option" }).default("UNSPECIFIED"),
  visa_notes: z.string().trim().max(200, "Visa notes are too long").default(""),
  skills: z
    .array(skillSchema)
    .min(1, "Add at least one weighted skill — scoring needs it")
    .max(12, "Keep it to the 12 most important skills"),
  requirements: z.string().trim().max(4000, "Requirements are too long").default(""),
  description: z.string().trim().max(2000, "Description is too long").default(""),
  jd_text: z.string().max(20000, "The JD text is too long").default(""),
});

export async function createJobAction(payload: unknown): Promise<CreateJobResult> {
  const parsed = createJobSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data = parsed.data;

  // De-duplicate skills case-insensitively, keeping the first occurrence.
  const seen = new Set<string>();
  const skills = data.skills.filter((s) => {
    const key = s.skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const requirements = data.requirements
    .split("\n")
    .map((line) => line.replace(/^[-•*▪◦]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);

  try {
    // Reuse a known client when the name matches; otherwise file it as a new
    // (local) client so the listing still renders everywhere.
    const clients = await getClients();
    const match = clients.find(
      (c) => c.name.trim().toLowerCase() === data.client_name.toLowerCase(),
    );

    const job = await createLocalJob({
      title: data.title,
      client_id: match?.id ?? `local-cl-${Date.now().toString(36)}`,
      client_name: match?.name ?? data.client_name,
      location: data.location,
      salary_range: data.salary_range,
      min_years: data.min_years,
      status: data.status,
      visa: data.visa,
      visa_notes: data.visa_notes.length > 0 ? data.visa_notes : null,
      skills,
      requirements,
      description: data.description,
      jd_text: data.jd_text.trim(),
    });

    revalidatePath("/jobs");
    return { ok: true, jobId: job.id };
  } catch (error) {
    return {
      ok: false,
      formError:
        error instanceof DataLayerError
          ? error.message
          : "Something went wrong while creating the listing. Please try again.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Add hiring-manager note                                              */
/* ------------------------------------------------------------------ */

const addJobNoteSchema = z.object({
  job_id: z.string().trim().min(1, "Missing job reference"),
  body: z
    .string()
    .trim()
    .min(3, "Write the note first — e.g. “HM now prefers kiln experience”.")
    .max(2000, "Keep notes under 2,000 characters"),
});

export async function addJobNoteAction(payload: unknown): Promise<AddJobNoteResult> {
  const parsed = addJobNoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { job_id, body } = parsed.data;

  try {
    const job = (await getJob(job_id)) ?? (await getLocalJob(job_id));
    if (!job) {
      return {
        ok: false,
        formError: "That job could not be found. It may have been removed.",
      };
    }
    // Demo identity — swaps to the signed-in profile with Supabase auth.
    await addLocalJobNote(job.id, body, "Jenny M.");
    revalidatePath(`/jobs/${job.id}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      formError:
        error instanceof DataLayerError
          ? error.message
          : "Something went wrong while saving the note. Please try again.",
    };
  }
}
