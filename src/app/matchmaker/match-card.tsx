"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge, Card, CardBody, Icon, ScorePill, cn } from "@/components/ui";
import type { MatchResult, ScoreCandidateInput, ScoreJobInput } from "@/lib/types";
import { ScoreExplanationTable } from "@/components/scoring/score-explanation";

const LIST_LIMIT = 4;

export interface MatchCardProps {
  /** Card headline — a job title or a candidate name. */
  title: string;
  subtitle: string;
  flagged?: boolean;
  /** Extra chips under the subtitle (visa badge, stage badge…). */
  chips?: ReactNode;
  /** Optional "open" link (candidate profile / job details). */
  href?: string;
  hrefLabel?: string;
  match: MatchResult;
  /** Inputs the score was computed from — powers "Explain this score". */
  candidate: ScoreCandidateInput;
  job: ScoreJobInput;
}

/**
 * One ranked match result: score pill, "The Edge" line, pros vs cons/gaps,
 * skill-gap chips and an expandable point-by-point score explanation
 * (mirrors the prototype's match card).
 */
export function MatchCard({
  title,
  subtitle,
  flagged = false,
  chips,
  href,
  hrefLabel = "Open profile →",
  match,
  candidate,
  job,
}: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const pros = match.pros.slice(0, LIST_LIMIT);
  const cons = match.cons.slice(0, LIST_LIMIT);
  const moreCount = Math.max(match.pros.length - LIST_LIMIT, 0);

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[14px] font-bold text-ink">
              {flagged ? (
                <Icon name="star" size={14} fill aria-label="Flagged candidate" className="shrink-0 text-warning" />
              ) : null}
              {title}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>
            {chips ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{chips}</div> : null}
          </div>
          <ScorePill score={match.score} className="shrink-0 px-2.5 py-1 text-base" />
        </div>

        {match.edge ? (
          <div className="mt-3 flex items-start gap-1.5 rounded-control border border-primary-soft bg-gradient-to-r from-primary-faint to-white px-3 py-2 text-[13px] text-slate-700">
            <Icon name="bolt" size={15} className="mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="font-semibold">The Edge:</span> {match.edge}
            </span>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <div>
            <p className="micro-label text-slate-500">Pros</p>
            <ul className="mt-1 space-y-1 text-[13px] text-slate-700">
              {pros.length > 0 ? (
                pros.map((pro) => (
                  <li key={pro} className="flex gap-2">
                    <Icon name="check" size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                    <span>{pro}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">None identified</li>
              )}
              {moreCount > 0 ? <li className="text-slate-400">+{moreCount} more</li> : null}
            </ul>
          </div>
          <div>
            <p className="micro-label text-slate-500">Gaps</p>
            <ul className="mt-1 space-y-1 text-[13px] text-slate-700">
              {cons.length > 0 ? (
                cons.map((con) => (
                  <li key={con} className="flex gap-2">
                    <Icon name="close" size={14} aria-hidden className="mt-0.5 shrink-0 text-danger" />
                    <span>{con}</span>
                  </li>
                ))
              ) : null}
              {match.gaps.length > 0 ? (
                <li className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-slate-400">Missing skills:</span>
                  {match.gaps.map((gap) => (
                    <Badge key={gap} variant="danger">
                      {gap}
                    </Badge>
                  ))}
                </li>
              ) : null}
              {cons.length === 0 && match.gaps.length === 0 ? (
                <li className="text-slate-400">None identified</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-control text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-strong"
          >
            <span
              aria-hidden="true"
              className={cn("text-[10px] transition-transform", expanded && "rotate-90")}
            >
              ▶
            </span>
            Explain this score
          </button>
          {href ? (
            <Link
              href={href}
              className="text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-ink hover:underline"
            >
              {hrefLabel}
            </Link>
          ) : null}
        </div>

        {expanded ? (
          <div className="mt-2.5">
            <ScoreExplanationTable id={panelId} candidate={candidate} job={job} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
