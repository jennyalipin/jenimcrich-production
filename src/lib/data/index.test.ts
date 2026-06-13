import { beforeEach, describe, expect, it } from "vitest";
import {
  DataLayerError,
  REFERENCE_NOW,
  STAGES,
  addNote,
  getActivityFeed,
  getApplicationsByStage,
  getCandidate,
  getDashboardStats,
  getInterviews,
  getJobs,
  getStalledApplications,
  getTemplates,
  isSlotTaken,
  moveApplicationStage,
  resetDemoData,
  scheduleInterview,
  updateSettings,
} from "./index";

beforeEach(async () => {
  await resetDemoData();
});

describe("seed integrity", () => {
  it("has jobs covering every visa enum value and all six stages populated", async () => {
    const jobs = await getJobs();
    const visas = new Set(jobs.map((j) => j.visa));
    for (const v of [
      "TN_CANADIAN_ONLY",
      "TN_CANADIAN_OR_MEXICAN",
      "US_CITIZEN_GC_ONLY",
      "H1B_TRANSFER",
      "SPONSORSHIP_AVAILABLE",
      "LOCAL",
      "UNSPECIFIED",
    ] as const) {
      expect(visas, `visa ${v} missing from seed`).toContain(v);
    }

    const byStage = await getApplicationsByStage();
    for (const stage of STAGES) {
      expect(byStage[stage].length, `stage ${stage} is empty`).toBeGreaterThan(0);
    }
  });

  it("uses clearly fake candidate PII", async () => {
    const profile = await getCandidate("c1");
    expect(profile?.email).toMatch(/@example\.com$/);
    expect(profile?.phone).toContain("555 01");
  });
});

describe("moveApplicationStage (domain rule 1)", () => {
  it("updates stage_entered_at and appends to the activity log", async () => {
    const before = await getActivityFeed(1000);
    const moved = await moveApplicationStage("a5", "screening");
    expect(moved.stage).toBe("screening");
    expect(Date.parse(moved.stage_entered_at)).toBeGreaterThanOrEqual(REFERENCE_NOW.getTime());

    const after = await getActivityFeed(1000);
    expect(after.length).toBe(before.length + 1);
    expect(after[0]?.type).toBe("stage");
    expect(after[0]?.body).toContain("Moved to Screening");
  });

  it("is a no-op when the stage is unchanged", async () => {
    const before = await getActivityFeed(1000);
    const app = await moveApplicationStage("a1", "interview");
    expect(app.stage).toBe("interview");
    expect((await getActivityFeed(1000)).length).toBe(before.length);
  });
});

describe("double-booking guard (domain rule 5)", () => {
  it("seeds two interviewers at the same instant without conflict, but blocks re-booking either", async () => {
    const slot = new Date(REFERENCE_NOW);
    slot.setUTCDate(slot.getUTCDate() + 1);
    slot.setUTCHours(14, 0, 0, 0);
    const iso = slot.toISOString();

    await expect(isSlotTaken("u1", iso)).resolves.toBe(true); // iv7
    await expect(isSlotTaken("u3", iso)).resolves.toBe(true); // iv5
    await expect(isSlotTaken("u2", iso)).resolves.toBe(false);

    await expect(
      scheduleInterview({ application_id: "a3", interviewer_id: "u1", starts_at: iso, interview_type: "technical" }),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    const booked = await scheduleInterview({
      application_id: "a3",
      interviewer_id: "u2",
      starts_at: iso,
      interview_type: "technical",
    });
    expect(booked.interviewer_name).toBe("R. Santos");
    await expect(isSlotTaken("u2", iso)).resolves.toBe(true);

    // Booking logged a confirmation email to email_log AND activity (rule 6).
    const profile = await getCandidate(booked.candidate_id);
    expect(profile?.emails.some((e) => e.subject.startsWith("Interview Confirmation"))).toBe(true);
    expect(profile?.activity.some((a) => a.type === "interview" && a.body.includes("Interview booked"))).toBe(true);
  });

  it("cancelled interviews do not block the slot", async () => {
    const cancelled = (await getInterviews({ status: "cancelled" }))[0];
    expect(cancelled).toBeDefined();
    if (!cancelled) return;
    await expect(isSlotTaken(cancelled.interviewer_id, cancelled.starts_at)).resolves.toBe(false);
  });
});

describe("stalled applications (domain rule 3)", () => {
  it("flags ≥5d inactivity, excludes hired/rejected, and notes reset the clock", async () => {
    const stalled = await getStalledApplications();
    const ids = stalled.map((s) => s.id);
    expect(ids).toContain("a17"); // 13d in screening
    expect(ids).not.toContain("a12"); // hired
    expect(ids).not.toContain("a11"); // rejected
    expect(ids).not.toContain("a23"); // note 4d ago resets the clock (stage 8d)
    expect(stalled[0]?.days_stalled).toBeGreaterThanOrEqual(stalled.at(-1)?.days_stalled ?? 0);

    const target = stalled.find((s) => s.id === "a3");
    expect(target).toBeDefined();
    await addNote({ candidate_id: "c3", category: "general", body: "Called — still interested." });
    const refreshed = await getStalledApplications();
    expect(refreshed.map((s) => s.id)).not.toContain("a3");
  });

  it("respects the configurable threshold and the enable toggle", async () => {
    const at5 = (await getStalledApplications()).length;
    await updateSettings({ stalled_days: 10 });
    const at10 = (await getStalledApplications()).length;
    expect(at10).toBeLessThan(at5);
    await updateSettings({ stalled_enabled: false });
    expect(await getStalledApplications()).toHaveLength(0);
    await expect(updateSettings({ stalled_days: 4 as never })).rejects.toBeInstanceOf(DataLayerError);
  });
});

describe("dashboard & templates", () => {
  it("computes consistent dashboard stats against REFERENCE_NOW", async () => {
    const stats = await getDashboardStats();
    expect(stats.open_jobs).toBeGreaterThan(0);
    expect(stats.todays_interviews.length).toBeGreaterThan(0); // iv2 today 15:00 UTC
    expect(stats.upcoming_interviews.length).toBeLessThanOrEqual(5);
    expect(stats.stalled_count).toBe(stats.stalled.length);
    const total = STAGES.reduce((sum, st) => sum + stats.stage_counts[st], 0);
    expect(total).toBe(26);
  });

  it("exposes raw templates with merge fields untouched", async () => {
    const templates = await getTemplates();
    expect(templates).toHaveLength(5);
    expect(templates[0]?.subject).toContain("{{job_title}}");
  });
});
