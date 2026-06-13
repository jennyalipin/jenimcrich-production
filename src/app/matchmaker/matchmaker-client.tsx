"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  FieldError,
  Icon,
  Label,
  Select,
  Spinner,
  StageBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  cn,
} from "@/components/ui";
import {
  VISA_LABELS,
  isRestrictiveVisa,
  type CandidateSkill,
  type JobSkill,
  type Source,
  type Stage,
  type VisaType,
} from "@/lib/data/types";
import { matchScore, rankJobs } from "@/lib/scoring";
import type { ScoreCandidateInput } from "@/lib/types";
import { MatchCard } from "./match-card";
import { parseResumeText, type ParsedResume } from "./resume-parser";

/* ------------------------------------------------------------------ */
/* Props (plain, serializable — built by the Server Component page)    */
/* ------------------------------------------------------------------ */

export interface MatchJob {
  id: string;
  title: string;
  client_name: string;
  location: string;
  salary_range: string;
  min_years: number;
  visa: VisaType;
  visa_notes: string | null;
  skills: JobSkill[];
  applicant_count: number;
}

export interface MatchCandidate {
  id: string;
  full_name: string;
  years_exp: number;
  location: string;
  source: Source;
  summary: string;
  flagged: boolean;
  skills: CandidateSkill[];
  certifications: string[];
  applications: Array<{ job_id: string; stage: Stage }>;
}

export interface MatchmakerClientProps {
  /** Open jobs only — matches the prototype ("active JDs"). */
  jobs: MatchJob[];
  candidates: MatchCandidate[];
  /** Skill dictionary (prototype defaults + live job/candidate skills). */
  skillDictionary: string[];
}

function toScoreInput(c: MatchCandidate): ScoreCandidateInput {
  return {
    name: c.full_name,
    yearsExp: c.years_exp,
    skills: c.skills,
    certifications: c.certifications,
  };
}

function parsedToScoreInput(p: ParsedResume): ScoreCandidateInput {
  return {
    name: p.name,
    yearsExp: p.yearsExp,
    skills: p.skills,
    certifications: p.certifications,
  };
}

/* ------------------------------------------------------------------ */
/* Root: two directions of matching                                    */
/* ------------------------------------------------------------------ */

export function MatchmakerClient({ jobs, candidates, skillDictionary }: MatchmakerClientProps) {
  return (
    <Tabs defaultValue="candidate">
      <TabList aria-label="Matchmaker modes" className="mb-4">
        <Tab value="candidate">Match a candidate</Tab>
        <Tab value="job" count={jobs.length}>
          Fill a job
        </Tab>
      </TabList>
      <TabPanel value="candidate" keepMounted>
        <CandidateToJobs jobs={jobs} candidates={candidates} skillDictionary={skillDictionary} />
      </TabPanel>
      <TabPanel value="job" keepMounted>
        <JobToCandidates jobs={jobs} candidates={candidates} />
      </TabPanel>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 1 — candidate (existing or pasted resume) vs open jobs         */
/* ------------------------------------------------------------------ */

type Subject =
  | { kind: "existing"; candidate: MatchCandidate }
  | { kind: "parsed"; parsed: ParsedResume };

const AUTO_RANK = "";

function CandidateToJobs({ jobs, candidates, skillDictionary }: MatchmakerClientProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState(AUTO_RANK);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const pendingParse = useRef<ParsedResume | null>(null);

  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [candidates],
  );

  function handleSelectCandidate(id: string) {
    setSelectedCandidateId(id);
    setParseError(null);
    setAnalyzing(false);
    pendingParse.current = null;
    const candidate = candidates.find((c) => c.id === id);
    setSubject(candidate ? { kind: "existing", candidate } : null);
  }

  function handleAnalyze() {
    const text = resumeText.trim();
    if (text.length < 40) {
      setParseError("Paste at least a few lines of resume text so there is something to analyze.");
      return;
    }
    const parsed = parseResumeText(text, skillDictionary);
    if (parsed.skills.length === 0 && parsed.yearsExp === 0) {
      setParseError(
        "No recognizable skills or experience found in that text. Paste the resume body — skills, years of experience and certifications.",
      );
      return;
    }
    setParseError(null);
    setSelectedCandidateId("");
    setSubject(null);
    pendingParse.current = parsed;
    setAnalyzing(true);
  }

  function handleAnalysisDone() {
    setAnalyzing(false);
    if (pendingParse.current) {
      setSubject({ kind: "parsed", parsed: pendingParse.current });
      pendingParse.current = null;
    }
  }

  function handleClear() {
    setSelectedCandidateId("");
    setResumeText("");
    setParseError(null);
    setSubject(null);
    setAnalyzing(false);
    pendingParse.current = null;
  }

  const scoreInput: ScoreCandidateInput | null =
    subject === null
      ? null
      : subject.kind === "existing"
        ? toScoreInput(subject.candidate)
        : parsedToScoreInput(subject.parsed);

  const targetJobs = targetJobId === AUTO_RANK ? jobs : jobs.filter((j) => j.id === targetJobId);

  // Cheap (≤ a dozen jobs × small skill lists) — no memo needed.
  const ranked = scoreInput
    ? rankJobs(
        scoreInput,
        targetJobs.map((job) => ({ minYears: job.min_years, skills: job.skills, ref: job })),
      )
    : [];

  const analysisSteps = useMemo(
    () => [
      "Extracting text from pasted resume…",
      "Parsing skills & certifications…",
      `Cross-referencing ${jobs.length} active JD${jobs.length === 1 ? "" : "s"}…`,
      "Analyzing skill gaps…",
      "Ranking matches…",
    ],
    [jobs.length],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      {/* ----- left rail: inputs ----- */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Candidate</CardTitle>
            {subject || resumeText || selectedCandidateId ? (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="mm-candidate">Existing candidate</Label>
              <Select
                id="mm-candidate"
                value={selectedCandidateId}
                onChange={(e) => handleSelectCandidate(e.target.value)}
                className="mt-1"
              >
                <option value="">— Select a candidate —</option>
                {sortedCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} · {c.years_exp} yrs
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="micro-label text-slate-400">or paste a resume</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <Label htmlFor="mm-resume">Resume text</Label>
              <Textarea
                id="mm-resume"
                rows={9}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                invalid={parseError !== null}
                aria-describedby="mm-resume-error"
                placeholder={
                  "Paste the resume body — name, summary, skills with years, certifications…"
                }
                className="mt-1"
              />
              <FieldError id="mm-resume-error">{parseError}</FieldError>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button onClick={handleAnalyze} loading={analyzing} size="sm">
                  Analyze resume
                </Button>
                <p className="text-[11.5px] text-slate-400">
                  Heuristic extraction — PDF parsing arrives with Supabase.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target role</CardTitle>
          </CardHeader>
          <CardBody>
            <Label htmlFor="mm-target">Rank against</Label>
            <Select
              id="mm-target"
              value={targetJobId}
              onChange={(e) => setTargetJobId(e.target.value)}
              className="mt-1"
              disabled={jobs.length === 0}
            >
              <option value={AUTO_RANK}>
                Auto-rank all open jobs ({jobs.length})
              </option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.client_name}
                </option>
              ))}
            </Select>
            <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
              Cross-references against <b>{jobs.length} active JD{jobs.length === 1 ? "" : "s"}</b>{" "}
              with weighted skill scoring (
              <Icon name="star" size={11} fill aria-hidden className="text-warning" /> skills count
              3×).
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ----- right rail: results ----- */}
      <div className="flex min-w-0 flex-col gap-4">
        {analyzing ? (
          <AnalysisProgress steps={analysisSteps} onDone={handleAnalysisDone} />
        ) : subject && scoreInput ? (
          <>
            <SubjectSummary subject={subject} />
            {jobs.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Icon name="jobs" size={20} className="text-slate-400" />}
                  title="No open jobs to rank against"
                  hint="Open a job listing first, then come back to rank this candidate."
                  action={
                    <Link
                      href="/jobs"
                      className="inline-flex items-center rounded-control bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong"
                    >
                      Go to jobs
                    </Link>
                  }
                />
              </Card>
            ) : (
              <>
                <p className="text-[12px] text-slate-500">
                  {ranked.length === 1
                    ? "Match against the selected role"
                    : `Ranked matches across ${ranked.length} open roles — best first`}
                </p>
                {ranked.map(({ job, match }) => (
                  <MatchCard
                    key={job.ref.id}
                    title={job.ref.title}
                    subtitle={`${job.ref.client_name} · ${job.ref.location} · ${job.ref.salary_range}`}
                    chips={
                      isRestrictiveVisa(job.ref.visa) ? (
                        <Badge variant="visa" title={job.ref.visa_notes ?? undefined}>
                          {VISA_LABELS[job.ref.visa]}
                        </Badge>
                      ) : undefined
                    }
                    match={match}
                    candidate={scoreInput}
                    job={{ minYears: job.ref.min_years, skills: job.ref.skills }}
                    href={`/jobs/${job.ref.id}`}
                    hrefLabel="Job details →"
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<Icon name="target" size={20} className="text-slate-400" />}
              title="Pick a candidate or paste a resume"
              hint="You'll get ranked matches against every open role — with pros, gaps and “the edge”."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

/** Header card describing who is being matched. */
function SubjectSummary({ subject }: { subject: Subject }) {
  const isExisting = subject.kind === "existing";
  const name = isExisting ? subject.candidate.full_name : subject.parsed.name;
  const years = isExisting ? subject.candidate.years_exp : subject.parsed.yearsExp;
  const certs = isExisting ? subject.candidate.certifications : subject.parsed.certifications;
  const summary = isExisting ? subject.candidate.summary : subject.parsed.summary;
  const skills = isExisting ? subject.candidate.skills : subject.parsed.skills;

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="flex items-center gap-1 truncate">
                {isExisting && subject.candidate.flagged ? (
                  <Icon name="star" size={15} fill aria-label="Flagged candidate" className="shrink-0 text-warning" />
                ) : null}
                {name}
              </span>
              {!isExisting ? <Badge variant="info">Parsed from pasted text</Badge> : null}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {years} yrs experience · {certs.length > 0 ? certs.join(", ") : "no certifications"}
            </p>
          </div>
          {isExisting ? (
            <Link
              href={`/candidates/${subject.candidate.id}`}
              className="shrink-0 text-[12.5px] font-semibold text-primary hover:text-primary-strong hover:underline"
            >
              Open profile →
            </Link>
          ) : null}
        </div>
        {summary ? <p className="mt-2 text-[13px] text-slate-600">{summary}</p> : null}
        {skills.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <Badge key={skill.skill} variant="info">
                {skill.skill} · {skill.years}y
              </Badge>
            ))}
          </div>
        ) : null}
        {!isExisting ? (
          <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-400">
            Demo parsing — review extracted skills before relying on the ranking. Saving parsed
            resumes as candidates arrives with the Supabase backend.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Mode 2 — pick a job, rank every candidate against it                */
/* ------------------------------------------------------------------ */

const TOP_N = 8;

function JobToCandidates({ jobs, candidates }: Pick<MatchmakerClientProps, "jobs" | "candidates">) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [showAll, setShowAll] = useState(false);

  function handleSelectJob(id: string) {
    setSelectedJobId(id);
    setShowAll(false); // reset pagination when switching jobs
  }

  const job = jobs.find((j) => j.id === selectedJobId) ?? null;

  const ranked = useMemo(() => {
    if (!job) return [];
    const scoreJob = { minYears: job.min_years, skills: job.skills };
    return candidates
      .map((candidate) => ({ candidate, match: matchScore(toScoreInput(candidate), scoreJob) }))
      .sort(
        (a, b) =>
          b.match.score - a.match.score ||
          a.candidate.full_name.localeCompare(b.candidate.full_name),
      );
  }, [job, candidates]);

  const visible = showAll ? ranked : ranked.slice(0, TOP_N);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      {/* ----- left rail: job picker + JD summary ----- */}
      <Card>
        <CardHeader>
          <CardTitle>Job to fill</CardTitle>
        </CardHeader>
        <CardBody>
          <Label htmlFor="mm-job">Open job</Label>
          <Select
            id="mm-job"
            value={selectedJobId}
            onChange={(e) => handleSelectJob(e.target.value)}
            className="mt-1"
            disabled={jobs.length === 0}
          >
            <option value="">— Select a job —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.client_name}
              </option>
            ))}
          </Select>

          {jobs.length === 0 ? (
            <EmptyState
              icon={<Icon name="jobs" size={20} className="text-slate-400" />}
              title="No open jobs"
              hint="Open a job listing first — only open roles can be matched."
              action={
                <Link
                  href="/jobs"
                  className="inline-flex items-center rounded-control bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong"
                >
                  Go to jobs
                </Link>
              }
            />
          ) : null}

          {job ? (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-[14px] font-bold text-ink">{job.title}</p>
                <p className="text-[12px] text-slate-500">
                  {job.client_name} · {job.location} · {job.salary_range}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{job.min_years}+ yrs required</Badge>
                <Badge variant="info">
                  {job.applicant_count} applicant{job.applicant_count === 1 ? "" : "s"}
                </Badge>
                {job.visa !== "UNSPECIFIED" ? (
                  <Badge
                    variant={isRestrictiveVisa(job.visa) ? "visa" : "default"}
                    title={job.visa_notes ?? undefined}
                  >
                    {VISA_LABELS[job.visa]}
                  </Badge>
                ) : null}
              </div>
              {job.visa_notes ? (
                <p className="text-[11.5px] text-slate-500">{job.visa_notes}</p>
              ) : null}
              <div>
                <p className="micro-label text-slate-500">Weighted skills</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {job.skills.map((skill) => (
                    <Badge key={skill.skill} variant="info" title={`Weight ${skill.weight}`}>
                      <span className="inline-flex items-center gap-1">
                        {skill.skill}
                        {skill.weight >= 3 ? (
                          <Icon name="star" size={11} fill aria-label="Must-have skill" className="text-warning" />
                        ) : null}
                      </span>
                    </Badge>
                  ))}
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-slate-400">
                  <Icon name="star" size={11} fill aria-hidden className="text-warning" /> = must-have
                  (weight 3)
                </p>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ----- right rail: ranked candidates ----- */}
      <div className="flex min-w-0 flex-col gap-4">
        {!job ? (
          <Card>
            <EmptyState
              icon={<Icon name="matchmaker" size={20} className="text-slate-400" />}
              title="Pick a job to rank candidates"
              hint="Every active candidate is scored against the JD's weighted skills, experience bar and certifications."
            />
          </Card>
        ) : ranked.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="candidates" size={20} className="text-slate-400" />}
              title="No candidates to rank"
              hint="Add candidates first, then come back to find the best fits."
              action={
                <Link
                  href="/candidates"
                  className="inline-flex items-center rounded-control bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong"
                >
                  Go to candidates
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <p className="text-[12px] text-slate-500">
              {ranked.length} candidate{ranked.length === 1 ? "" : "s"} ranked against{" "}
              <b>{job.title}</b> — best first
            </p>
            {visible.map(({ candidate, match }) => {
              const existingApp = candidate.applications.find((a) => a.job_id === job.id);
              return (
                <MatchCard
                  key={candidate.id}
                  title={candidate.full_name}
                  flagged={candidate.flagged}
                  subtitle={`${candidate.years_exp} yrs · ${candidate.location} · via ${candidate.source}`}
                  chips={
                    existingApp ? (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                        Already in pipeline: <StageBadge stage={existingApp.stage} />
                      </span>
                    ) : undefined
                  }
                  match={match}
                  candidate={toScoreInput(candidate)}
                  job={{ minYears: job.min_years, skills: job.skills }}
                  href={`/candidates/${candidate.id}`}
                />
              );
            })}
            {!showAll && ranked.length > TOP_N ? (
              <Button variant="secondary" onClick={() => setShowAll(true)} block>
                Show all {ranked.length} candidates
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staged "analysis" theatre — prototype's resume-processing animation */
/* ------------------------------------------------------------------ */

function AnalysisProgress({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  // Keep the latest callback without restarting the step timer when the
  // parent re-renders (refs may only be written outside render).
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (step >= steps.length) {
      const timer = window.setTimeout(() => onDoneRef.current(), 360);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setStep((s) => s + 1), 460);
    return () => window.clearTimeout(timer);
  }, [step, steps.length]);

  const pct = (Math.min(step + 1, steps.length) / steps.length) * 100;

  return (
    <Card>
      <CardBody>
        <h2 className="text-[15px] font-semibold text-ink">Analyzing resume…</h2>
        <ul className="mt-3.5 space-y-2" aria-live="polite">
          {steps.map((label, index) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 text-[13px] font-medium",
                index < step
                  ? "text-primary-ink"
                  : index === step
                    ? "text-ink"
                    : "text-slate-400",
              )}
            >
              {index < step ? (
                <span aria-hidden="true" className="font-bold text-primary">
                  ✓
                </span>
              ) : index === step ? (
                <Spinner className="size-3.5 text-primary" label="In progress" />
              ) : (
                <span aria-hidden="true">○</span>
              )}
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-4 h-2 overflow-hidden rounded-md bg-slate-200">
          <div
            className="h-full bg-primary transition-[width] duration-400 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardBody>
    </Card>
  );
}
