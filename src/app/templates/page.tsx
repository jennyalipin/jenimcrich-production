import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui";
import {
  REFERENCE_NOW_ISO,
  STAGE_LABELS,
  getCandidates,
  getEmailLog,
  getInterviews,
  getTemplates,
} from "@/lib/data";
import { DEMO_USER } from "@/lib/demo-auth";
import { formatDateTime } from "@/lib/format";
import type { MergeValues } from "@/lib/merge";
import {
  TemplatesView,
  type EmailLogRow,
  type RecipientOption,
  type TemplateRecord,
} from "./templates-view";

export const metadata: Metadata = {
  title: "Email Templates — Jenny Mcrich Recruitment",
};

/**
 * Email template library + merge-field editor + bulk composer (rule 6:
 * always per-recipient preview; sending stays disabled until Resend is
 * connected). Server component: loads demo data, hands plain props to the
 * client view.
 */
export default async function TemplatesPage() {
  const [templates, candidates, emailLog, upcomingInterviews] = await Promise.all([
    getTemplates(),
    getCandidates(),
    getEmailLog(),
    getInterviews({ from: REFERENCE_NOW_ISO, status: "scheduled" }),
  ]);

  // Earliest upcoming scheduled interview per candidate (list is sorted asc).
  const nextInterviewByCandidate = new Map<string, string>();
  for (const interview of upcomingInterviews) {
    if (!nextInterviewByCandidate.has(interview.candidate_id)) {
      nextInterviewByCandidate.set(interview.candidate_id, interview.starts_at);
    }
  }

  const templateRecords: TemplateRecord[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    subject: t.subject,
    body: t.body,
  }));

  const recipients: RecipientOption[] = candidates
    .map((candidate) => {
      const primary = candidate.applications[0] ?? null;
      const nextInterview = nextInterviewByCandidate.get(candidate.id) ?? null;
      const values: MergeValues = {
        candidate_name: candidate.full_name,
        stage: primary ? STAGE_LABELS[primary.stage] : "Applied",
        job_title: primary?.job.title ?? null,
        client: primary?.job.client_name ?? null,
        recruiter_name: DEMO_USER.name,
        interview_date: nextInterview ? formatDateTime(nextInterview) : null,
      };
      return {
        id: candidate.id,
        name: candidate.full_name,
        email: candidate.email,
        stage: primary?.stage ?? null,
        values,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const emailLogRows: EmailLogRow[] = [...emailLog]
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    .map((entry) => ({
      id: entry.id,
      when: formatDateTime(entry.sent_at),
      to: entry.to_email,
      subject: entry.subject,
      status: entry.status,
    }));

  return (
    <ToastProvider>
      <TemplatesView
        templates={templateRecords}
        recipients={recipients}
        emailLog={emailLogRows}
      />
    </ToastProvider>
  );
}
