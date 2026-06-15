/**
 * Read-only AI tools for the recruiter copilot. Each wraps a data-layer read
 * and runs server-side inside the /api/chat route, so it inherits the logged-in
 * recruiter's Supabase session (RLS-scoped). Outputs are slimmed and exclude
 * contact PII (email/phone) — the model gets professional facts + names only.
 *
 * Tools:
 *   search_candidates        — free-text / stage / tag / flagged candidate search
 *   stalled_candidates       — candidates with no movement past the threshold
 *   list_jobs                — requisitions with applicant counts
 *   rank_candidates_for_job  — candidates ranked against a job by match score
 *   pipeline_summary         — whole-pipeline metric snapshot
 *   get_candidate            — full slim profile for one named candidate
 *   upcoming_interviews      — scheduled interviews (who/when/with)
 *   jobs_needing_attention   — open roles with thin interview-stage pipelines
 *   draft_outreach_email     — drafts (does NOT send) a short outreach email
 */

import { tool } from "ai";
import { z } from "zod";
import {
  getCandidates,
  getDashboardStats,
  getInterviews,
  getJobs,
  getStalledApplications,
  toScoreCandidate,
  toScoreJob,
  INTERVIEW_TYPE_LABELS,
  STAGE_LABELS,
  type CandidateSkill,
  type CandidateWithApplications,
  type JobWithStats,
} from "@/lib/data";
import { matchScore } from "@/lib/scoring";
import { formatFullDateTime } from "@/lib/format";

const STAGE_ENUM = z.enum([
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

const topSkills = (skills: CandidateSkill[], n = 5): string[] =>
  [...skills]
    .sort((a, b) => b.years - a.years)
    .slice(0, n)
    .map((s) => `${s.skill} (${s.years}y)`);

/**
 * Picks the closest candidate to a typed name from a `getCandidates({ q })`
 * result: prefers an exact (case-insensitive) full-name match, then a name
 * that starts with the query, then the first row the search already ranked.
 */
function bestNameMatch(
  rows: CandidateWithApplications[],
  name: string,
): CandidateWithApplications | undefined {
  const q = name.trim().toLowerCase();
  return (
    rows.find((c) => c.full_name.toLowerCase() === q) ??
    rows.find((c) => c.full_name.toLowerCase().startsWith(q)) ??
    rows[0]
  );
}

export const aiTools = {
  search_candidates: tool({
    description:
      "Search candidates by free text (skill, name, certification), pipeline stage, tag, or flagged status. Use for questions like 'who knows kiln operations with 10+ years' or 'flagged candidates in screening'.",
    inputSchema: z.object({
      query: z.string().optional().describe("Free text: skill, name, or certification"),
      stages: z.array(STAGE_ENUM).optional().describe("Limit to these pipeline stages"),
      tags: z.array(z.string()).optional(),
      flaggedOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(25).optional(),
    }),
    execute: async ({ query, stages, tags, flaggedOnly, limit = 10 }) => {
      const rows = await getCandidates({
        q: query,
        stages,
        tags,
        flagged_only: flaggedOnly,
      });
      return rows.slice(0, limit).map((c) => ({
        name: c.full_name,
        yearsExp: c.years_exp,
        flagged: c.flagged,
        location: c.location,
        topSkills: topSkills(c.skills),
        certifications: c.certifications,
        stages: [...new Set(c.applications.map((a) => a.stage))],
        roles: c.applications.map((a) => a.job.title),
      }));
    },
  }),

  stalled_candidates: tool({
    description:
      "List candidates with no pipeline movement, note, or email within the stalled threshold (excludes Hired/Rejected). Use for 'who is stalled / needs a nudge'.",
    inputSchema: z.object({}),
    execute: async () => {
      const rows = await getStalledApplications();
      return rows.map((a) => ({
        name: a.candidate.full_name,
        role: a.job.title,
        client: a.job.client_name,
        stage: a.stage,
        daysStalled: a.days_stalled,
      }));
    },
  }),

  list_jobs: tool({
    description:
      "List jobs/requisitions, optionally filtered by status. Returns client, location, visa requirement, and applicant counts.",
    inputSchema: z.object({
      status: z.enum(["open", "on_hold", "closed"]).optional(),
      limit: z.number().int().min(1).max(30).optional(),
    }),
    execute: async ({ status, limit = 20 }) => {
      const rows = await getJobs(status ? { status } : undefined);
      return rows.slice(0, limit).map((j) => ({
        id: j.id,
        title: j.title,
        client: j.client_name,
        location: j.location,
        visa: j.visa,
        status: j.status,
        applicants: j.applicant_count,
        minYears: j.min_years,
      }));
    },
  }),

  rank_candidates_for_job: tool({
    description:
      "Rank candidates against a specific job by match score (weighted skill overlap + experience + certifications, 0-100). Identify the job by title text or exact id.",
    inputSchema: z.object({
      job: z.string().describe("Job title (or part of it) or exact job id"),
      limit: z.number().int().min(1).max(15).optional(),
    }),
    execute: async ({ job, limit = 8 }) => {
      const jobs = await getJobs();
      const q = job.trim().toLowerCase();
      const target =
        jobs.find((j) => j.id === job) ??
        jobs.find((j) => j.title.toLowerCase().includes(q)) ??
        jobs.find((j) => `${j.title} ${j.client_name}`.toLowerCase().includes(q));
      if (!target) {
        return { error: `No job matched "${job}". Use list_jobs to see available roles.` };
      }
      const candidates = await getCandidates();
      const scoreJob = toScoreJob(target);
      const ranked = candidates
        .map((c) => ({ c, score: matchScore(toScoreCandidate(c), scoreJob).score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return {
        job: { title: target.title, client: target.client_name, visa: target.visa },
        candidates: ranked.map(({ c, score }) => ({
          name: c.full_name,
          score,
          yearsExp: c.years_exp,
          topSkills: topSkills(c.skills, 4),
        })),
      };
    },
  }),

  pipeline_summary: tool({
    description:
      "Snapshot of the whole pipeline: per-stage counts plus key metrics (active candidates, open jobs, stalled count, hires, avg time-to-hire).",
    inputSchema: z.object({}),
    execute: async () => {
      const s = await getDashboardStats();
      return {
        stageCounts: s.stage_counts,
        activeCandidates: s.active_candidates,
        flaggedCandidates: s.flagged_candidates,
        openJobs: s.open_jobs,
        openClients: s.open_clients,
        stalledCount: s.stalled_count,
        hiredTotal: s.hired_total,
        avgTimeToHireDays: s.avg_time_to_hire_days,
      };
    },
  }),

  get_candidate: tool({
    description:
      "Get one candidate's full professional profile by name: experience, location, source, summary, all skills, certifications, tags, and their job applications with stage and match score. Use when asked about a specific person, e.g. 'tell me about Maria Alvarez' or 'what's John's match for the kiln role'.",
    inputSchema: z.object({
      name: z.string().describe("Candidate name (full or partial)"),
    }),
    execute: async ({ name }) => {
      const rows = await getCandidates({ q: name });
      if (rows.length === 0) {
        return { error: `No candidate matched "${name}".` };
      }
      const c = bestNameMatch(rows, name);
      if (!c) {
        return { error: `No candidate matched "${name}".` };
      }
      const scoreCandidate = toScoreCandidate(c);
      return {
        matchedCount: rows.length,
        note:
          rows.length > 1
            ? `${rows.length} candidates matched "${name}"; showing the closest (${c.full_name}).`
            : undefined,
        name: c.full_name,
        yearsExp: c.years_exp,
        location: c.location,
        source: c.source,
        summary: c.summary,
        skills: [...c.skills]
          .sort((a, b) => b.years - a.years)
          .map((s) => ({ skill: s.skill, years: s.years })),
        certifications: c.certifications,
        tags: c.tags,
        applications: c.applications.map((a) => ({
          job: a.job.title,
          client: a.job.client_name,
          stage: STAGE_LABELS[a.stage],
          matchScore: matchScore(scoreCandidate, toScoreJob(a.job)).score,
        })),
      };
    },
  }),

  upcoming_interviews: tool({
    description:
      "List interviews that are scheduled (upcoming): candidate, role, interviewer, type, and date/time. Use for 'what interviews are coming up' or 'who is interviewing this week'.",
    inputSchema: z.object({}),
    execute: async () => {
      const rows = await getInterviews({ status: "scheduled" });
      return rows.map((iv) => ({
        candidate: iv.candidate.full_name,
        job: iv.job.title,
        client: iv.job.client_name,
        interviewer: iv.interviewer_name,
        type: INTERVIEW_TYPE_LABELS[iv.interview_type],
        when: `${formatFullDateTime(iv.starts_at)} (UTC)`,
      }));
    },
  }),

  jobs_needing_attention: tool({
    description:
      "Surface open jobs with thin pipelines: applicant count and how many applicants have reached interview or beyond (interview + offer + hired), so roles that need sourcing stand out. Returns roles sorted by fewest interview-stage applicants first.",
    inputSchema: z.object({}),
    execute: async () => {
      const jobs = await getJobs({ status: "open" });
      const advancedOf = (j: JobWithStats): number =>
        j.stage_counts.interview + j.stage_counts.offer + j.stage_counts.hired;
      return jobs
        .map((j) => ({
          title: j.title,
          client: j.client_name,
          location: j.location,
          visa: j.visa,
          applicants: j.applicant_count,
          reachedInterviewPlus: advancedOf(j),
          inInterview: j.stage_counts.interview,
        }))
        .sort(
          (a, b) =>
            a.reachedInterviewPlus - b.reachedInterviewPlus || a.applicants - b.applicants,
        );
    },
  }),

  draft_outreach_email: tool({
    description:
      "Draft (do NOT send) a short, professional outreach email body for a candidate, optionally tied to a specific job, for a given intent (screening, interview, offer, follow_up). References the candidate's top skills and the role. Returns plain text only for the recruiter to review and send.",
    inputSchema: z.object({
      candidateName: z.string().describe("Candidate name (full or partial)"),
      jobTitle: z.string().optional().describe("Job title (or part of it) to reference"),
      intent: z
        .enum(["screening", "interview", "offer", "follow_up"])
        .describe("Purpose of the outreach"),
    }),
    execute: async ({ candidateName, jobTitle, intent }) => {
      const rows = await getCandidates({ q: candidateName });
      const candidate = rows.length ? bestNameMatch(rows, candidateName) : undefined;
      if (!candidate) {
        return { error: `No candidate matched "${candidateName}".` };
      }

      let job: JobWithStats | undefined;
      if (jobTitle) {
        const q = jobTitle.trim().toLowerCase();
        const jobs = await getJobs();
        job =
          jobs.find((j) => j.title.toLowerCase().includes(q)) ??
          jobs.find((j) => `${j.title} ${j.client_name}`.toLowerCase().includes(q));
      }

      const firstName = candidate.full_name.split(/\s+/)[0] ?? candidate.full_name;
      const skills = topSkills(candidate.skills, 2);
      const skillPhrase = skills.length
        ? skills.map((s) => s.replace(/\s*\(\d+y\)$/, "")).join(" and ")
        : "your background";
      const rolePhrase = job
        ? `the ${job.title} role with ${job.client_name}`
        : "an opportunity I'm working on";

      const intro = `Hi ${firstName},`;
      const openings: Record<typeof intent, string> = {
        screening: `Your experience with ${skillPhrase} caught my eye, and I'd love to set up a short screening call about ${rolePhrase}.`,
        interview: `We'd like to move forward and arrange an interview for ${rolePhrase}. Your strength in ${skillPhrase} is a strong fit for what the team needs.`,
        offer: `Great news — we'd like to extend an offer for ${rolePhrase}. Your background in ${skillPhrase} stood out throughout the process.`,
        follow_up: `I wanted to follow up regarding ${rolePhrase}. Given your experience with ${skillPhrase}, I'm keen to keep things moving.`,
      };
      const closings: Record<typeof intent, string> = {
        screening: "Would you have 15 minutes this week to connect?",
        interview: "Could you share a few times that work for you?",
        offer: "I'd be glad to walk you through the details whenever you're ready.",
        follow_up: "Let me know if you have any questions — happy to help.",
      };

      const body = [
        intro,
        "",
        openings[intent],
        "",
        closings[intent],
        "",
        "Best regards,",
        "Jenny M.",
        "JeniMcRich Recruitment",
      ].join("\n");

      return {
        candidate: candidate.full_name,
        job: job ? { title: job.title, client: job.client_name } : null,
        intent,
        body,
      };
    },
  }),
};
