import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  ScorePill,
  StageBadge,
  cn,
  type BadgeVariant,
} from "@/components/ui";
import {
  DOCUMENT_CATEGORY_LABELS,
  INTERVIEW_TYPE_LABELS,
  NOTE_CATEGORY_LABELS,
  RECOMMENDATION_LABELS,
  SCORECARD_COMPETENCIES,
  VISA_LABELS,
  getCandidate,
  getInterviewers,
  getInterviews,
  getJobs,
  isRestrictiveVisa,
  toScoreCandidate,
  toScoreJob,
  type CandidateProfile,
  type Recommendation,
  type Scorecard,
} from "@/lib/data";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "@/lib/format";
import { matchScore, rankJobs } from "@/lib/scoring";
import type { MatchResult, ScoreCandidateInput, ScoreJobInput } from "@/lib/types";
import { ExplainScore } from "@/components/scoring/score-explanation";
import { ScoringDisclosure } from "@/components/scoring/scoring-disclosure";
import { ActivityTimeline } from "../_components/activity-timeline";
import { CandidateHeader } from "../_components/candidate-header";
import { CandidateTabs, TabJumpButton } from "../_components/candidate-tabs";
import { DocumentsPanel } from "../_components/documents-panel";
import { NotesPanel } from "../_components/notes-panel";
import { ScorecardForm } from "../_components/scorecard-form";
import { SchedulePanel } from "../_components/schedule-panel";
import type { CandidateHeaderData } from "../_lib/view-types";

// The demo store mutates between requests — always render fresh.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getCandidate(id);
  return {
    title: profile
      ? `${profile.full_name} — Candidates — Jenny Mcrich Recruitment`
      : "Candidate not found — Jenny Mcrich Recruitment",
  };
}

/* ------------------------------------------------------------------ */
/* Scorecard math (prototype's weighted average)                       */
/* ------------------------------------------------------------------ */

function weightedAverage(cards: ReadonlyArray<Pick<Scorecard, "ratings">>): string | null {
  let totalWeight = 0;
  let totalScore = 0;
  for (const card of cards) {
    for (const cat of SCORECARD_COMPETENCIES) {
      const rating = card.ratings[cat.key];
      if (typeof rating === "number" && rating > 0) {
        totalScore += rating * cat.weight;
        totalWeight += cat.weight;
      }
    }
  }
  return totalWeight > 0 ? (totalScore / totalWeight).toFixed(1) : null;
}

const REC_VARIANT: Record<Recommendation, BadgeVariant> = {
  strong_hire: "success",
  hire: "success",
  consider: "warning",
  no_hire: "danger",
};

/* ------------------------------------------------------------------ */
/* Server-rendered fragments                                           */
/* ------------------------------------------------------------------ */

function Stars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, value));
  return (
    <span aria-label={`${filled} of 5`} className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={14}
          fill={n <= filled}
          className={n <= filled ? "text-amber-400" : "text-slate-200"}
        />
      ))}
    </span>
  );
}

function MatchCard({
  jobTitle,
  match,
  candidate,
  job,
}: {
  jobTitle: string;
  match: MatchResult;
  candidate: ScoreCandidateInput;
  job: ScoreJobInput;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">Match vs {jobTitle}</h3>
          <ScorePill score={match.score} />
        </div>
        {match.edge ? (
          <p className="mt-2 flex items-center gap-1.5 rounded-control bg-slate-50 px-3 py-1.5 text-[12.5px] font-medium text-slate-600">
            <Icon name="bolt" size={14} className="shrink-0 text-primary" />
            {match.edge}
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="micro-label mb-1 text-slate-500">Pros</p>
            <ul className="space-y-1 text-[12.5px] text-slate-600">
              {match.pros.length > 0 ? (
                match.pros.map((pro) => (
                  <li key={pro} className="flex gap-1.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-primary" />
                    {pro}
                  </li>
                ))
              ) : (
                <li className="text-slate-500">None identified</li>
              )}
            </ul>
          </div>
          <div>
            <p className="micro-label mb-1 text-slate-500">Gaps</p>
            <ul className="space-y-1 text-[12.5px] text-slate-600">
              {match.cons.length > 0 ? (
                match.cons.map((con) => (
                  <li key={con} className="flex gap-1.5">
                    <Icon name="close" size={14} className="mt-0.5 shrink-0 text-danger-strong" />
                    {con}
                  </li>
                ))
              ) : (
                <li className="text-slate-500">None identified</li>
              )}
            </ul>
          </div>
        </div>
        <ExplainScore candidate={candidate} job={job} className="mt-3 border-t border-slate-100 pt-2.5" />
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function CandidateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [profile, openJobs, interviewers, scheduledInterviews] = await Promise.all([
    getCandidate(id),
    getJobs({ status: "open" }),
    getInterviewers(),
    getInterviews({ status: "scheduled" }),
  ]);
  if (!profile) notFound();

  const scoreInput = toScoreCandidate(profile);
  const appMatches = profile.applications.map((app) => ({
    app,
    match: matchScore(scoreInput, toScoreJob(app.job)),
  }));
  const primary = appMatches[0] ?? null;
  const interviewAvg = weightedAverage(profile.scorecards);

  const openRoleMatches = rankJobs(
    scoreInput,
    openJobs.map((job) => ({ ...toScoreJob(job), id: job.id, title: job.title, client: job.client_name })),
  );

  const headerData: CandidateHeaderData = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    source: profile.source,
    yearsExp: profile.years_exp,
    flagged: profile.flagged,
    archived: profile.archived_at !== null,
    tags: profile.tags,
    expectedSalary: profile.expected_salary,
    noticePeriod: profile.notice_period,
    interviewAvg,
    primary: primary
      ? {
          applicationId: primary.app.id,
          jobTitle: primary.app.job.title,
          clientName: primary.app.job.client_name,
          stage: primary.app.stage,
          daysInStage: primary.app.days_in_stage,
          isStalled: primary.app.is_stalled,
          score: primary.match.score,
          restrictiveVisa: isRestrictiveVisa(primary.app.job.visa),
          visaLabel: isRestrictiveVisa(primary.app.job.visa) ? VISA_LABELS[primary.app.job.visa] : null,
        }
      : null,
    extraApplications: Math.max(0, profile.applications.length - 1),
  };

  const applicationOptions = profile.applications.map((app) => ({
    id: app.id,
    label: `${app.job.title} — ${app.job.client_name}`,
  }));
  const interviewerOptions = interviewers.map((person) => ({ id: person.id, name: person.name }));
  const scheduledCount = profile.interviews.filter((iv) => iv.status === "scheduled").length;

  return (
    <div className="space-y-4 p-6">
      <CandidateHeader data={headerData} />

      <CandidateTabs
        counts={{
          notes: profile.notes.length,
          scorecards: profile.scorecards.length,
          documents: profile.documents.length,
          schedule: scheduledCount,
        }}
        overview={<OverviewTab profile={profile} primary={primary} openRoleMatches={openRoleMatches} appMatches={appMatches} />}
        notes={
          <NotesPanel
            candidateId={profile.id}
            notes={profile.notes.map((note) => ({
              id: note.id,
              category: note.category,
              categoryLabel: NOTE_CATEGORY_LABELS[note.category],
              author: note.author_name,
              body: note.body,
              when: formatDateTime(note.created_at),
            }))}
          />
        }
        scorecards={
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <ScorecardsList scorecards={profile.scorecards} interviewAvg={interviewAvg} />
            <ScorecardForm applications={applicationOptions} interviewers={interviewerOptions} />
          </div>
        }
        documents={
          <DocumentsPanel
            candidateId={profile.id}
            documents={profile.documents.map((doc) => ({
              id: doc.id,
              fileName: doc.file_name,
              category: doc.category,
              categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category],
              uploadedBy: doc.uploaded_by,
              when: formatDate(doc.created_at),
            }))}
          />
        }
        schedule={
          <SchedulePanel
            applications={applicationOptions}
            interviewers={interviewerOptions}
            interviews={profile.interviews.map((iv) => ({
              id: iv.id,
              typeLabel: INTERVIEW_TYPE_LABELS[iv.interview_type],
              when: `${formatDayLabel(iv.starts_at)} · ${formatTime(iv.starts_at)} UTC`,
              interviewer: iv.interviewer_name,
              status: iv.status,
              durationMinutes: iv.duration_minutes,
            }))}
            bookedSlots={scheduledInterviews.map((iv) => ({
              interviewerId: iv.interviewer_id,
              startsAtMs: Date.parse(iv.starts_at),
            }))}
          />
        }
        activity={
          <ActivityTimeline
            entries={profile.activity.map((entry) => ({
              id: entry.id,
              type: entry.type,
              body: entry.body,
              actor: entry.actor_name,
              when: formatDateTime(entry.created_at),
            }))}
          />
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview tab (server-rendered)                                      */
/* ------------------------------------------------------------------ */

function OverviewTab({
  profile,
  primary,
  appMatches,
  openRoleMatches,
}: {
  profile: CandidateProfile;
  primary: { app: CandidateProfile["applications"][number]; match: MatchResult } | null;
  appMatches: Array<{ app: CandidateProfile["applications"][number]; match: MatchResult }>;
  openRoleMatches: Array<{ job: { id: string; title: string; client: string }; match: MatchResult }>;
}) {
  const scoreInput = toScoreCandidate(profile);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="self-start lg:sticky lg:top-6">
        <CardBody className="space-y-5">
          <section>
            <h3 className="micro-label mb-1.5 text-slate-500">Profile summary</h3>
            <p className="text-[13px] leading-relaxed text-slate-600">
              {profile.summary || "No summary on file yet."}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 sm:grid-cols-3">
            <div>
              <p className="micro-label text-slate-500">Expected salary</p>
              <p className="text-[13px] font-semibold text-slate-800">{profile.expected_salary || "—"}</p>
            </div>
            <div>
              <p className="micro-label text-slate-500">Notice period</p>
              <p className="text-[13px] font-semibold text-slate-800">{profile.notice_period || "—"}</p>
            </div>
            <div>
              <p className="micro-label text-slate-500">Experience</p>
              <p className="text-[13px] font-semibold text-slate-800">{profile.years_exp} years</p>
            </div>
            <div>
              <p className="micro-label text-slate-500">Location</p>
              <p className="text-[13px] font-semibold text-slate-800">{profile.location || "—"}</p>
            </div>
            <div>
              <p className="micro-label text-slate-500">Source</p>
              <p className="text-[13px] font-semibold text-slate-800">{profile.source}</p>
            </div>
          </section>

          <section>
            <h3 className="micro-label mb-1.5 text-slate-500">Skills</h3>
            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <Badge key={skill.skill} variant="info">
                    {skill.skill} · {skill.years}y
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-slate-500">No skills recorded</p>
            )}
          </section>

          <section>
            <h3 className="micro-label mb-1.5 text-slate-500">Certifications</h3>
            {profile.certifications.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.certifications.map((cert) => (
                  <Badge key={cert} variant="success">
                    {cert}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-slate-500">None on file</p>
            )}
          </section>

          <section>
            <h3 className="micro-label mb-1.5 text-slate-500">Resume (parsed text)</h3>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-control border border-slate-200 bg-slate-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-600 scrollbar-slim">
              {profile.resume_text || "No resume text extracted yet."}
            </div>
          </section>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <ScoringDisclosure />
        {primary ? (
          <MatchCard
            jobTitle={primary.app.job.title}
            match={primary.match}
            candidate={scoreInput}
            job={toScoreJob(primary.app.job)}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <span className="flex gap-2">
              <TabJumpButton tab="schedule">
                <Icon name="interview" size={14} className="text-slate-500" /> Schedule interview
              </TabJumpButton>
              <TabJumpButton tab="notes">
                <Icon name="note" size={14} className="text-slate-500" /> Add note
              </TabJumpButton>
            </span>
          </CardHeader>
          <CardBody>
            {appMatches.length === 0 ? (
              <EmptyState
                icon={<Icon name="scorecard" size={20} />}
                title="No applications yet"
                hint="Match this candidate to an open role from the list below."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {appMatches.map(({ app, match }) => (
                  <li key={app.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">
                          {app.job.title}{" "}
                          {isRestrictiveVisa(app.job.visa) ? (
                            <Badge variant="visa" title={VISA_LABELS[app.job.visa]}>
                              {VISA_LABELS[app.job.visa]}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-[12px] text-slate-500">{app.job.client_name}</p>
                      </div>
                      <span className="flex items-center gap-2">
                        <ScorePill score={match.score} />
                        <StageBadge stage={app.stage} />
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[12px] tabular-nums",
                            app.is_stalled ? "font-bold text-warning-ink" : "text-slate-500",
                          )}
                        >
                          {app.days_in_stage}d
                          {app.is_stalled ? (
                            <Icon name="stalled" size={13} label="Stalled" className="text-warning-ink" />
                          ) : null}
                        </span>
                      </span>
                    </div>
                    <ExplainScore candidate={scoreInput} job={toScoreJob(app.job)} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Match against all open roles</CardTitle>
          </CardHeader>
          <CardBody>
            {openRoleMatches.length === 0 ? (
              <p className="text-[13px] text-slate-500">No open roles right now.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto scrollbar-slim">
                {openRoleMatches.map(({ job, match }) => (
                  <li key={job.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 pr-1">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-slate-700">{job.title}</span>
                      <span className="block text-[11.5px] text-slate-500">{job.client}</span>
                    </span>
                    <ScorePill score={match.score} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scorecards tab list (server-rendered)                               */
/* ------------------------------------------------------------------ */

function ScorecardsList({
  scorecards,
  interviewAvg,
}: {
  scorecards: Scorecard[];
  interviewAvg: string | null;
}) {
  if (scorecards.length === 0) {
    return (
      <Card className="self-start">
        <CardBody>
          <EmptyState
            icon={<Icon name="scorecard" size={20} />}
            title="No scorecards submitted yet"
            hint="Submit the first interview scorecard with the form on the right."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {interviewAvg !== null ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-slate-200 bg-surface px-5 py-3 shadow-card">
          <p className="text-[13px] text-slate-500">
            Weighted interview average across {scorecards.length} scorecard
            {scorecards.length === 1 ? "" : "s"}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-[15px] font-extrabold tabular-nums text-primary-ink">
            {interviewAvg}
            <Icon name="star" size={14} fill className="text-primary-ink" />
          </span>
        </div>
      ) : null}

      {scorecards.map((card) => {
        const avg = weightedAverage([card]);
        return (
          <Card key={card.id}>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold text-slate-800">{card.interviewer_name}</p>
                <p className="text-[12px] text-slate-500">{formatDate(card.created_at)}</p>
              </div>
              <div className="mt-3 space-y-1">
                {SCORECARD_COMPETENCIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1 last:border-b-0"
                  >
                    <span className="text-[12.5px] text-slate-600">
                      {cat.key} <span className="text-[11px] text-slate-500">(w{cat.weight})</span>
                    </span>
                    <Stars value={card.ratings[cat.key] ?? 0} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Badge variant={REC_VARIANT[card.recommendation]}>
                  {RECOMMENDATION_LABELS[card.recommendation]}
                </Badge>
                {avg !== null ? (
                  <p className="text-[13px] font-bold text-slate-800">Weighted avg: {avg}</p>
                ) : null}
              </div>
              {card.summary ? (
                <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-500">
                  {card.summary}
                </p>
              ) : null}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
