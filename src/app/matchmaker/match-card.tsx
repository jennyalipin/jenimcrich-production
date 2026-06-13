"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge, Card, CardBody, ScorePill, cn } from "@/components/ui";
import { scoreBand } from "@/lib/scoring";
import type { MatchResult, ScoreBand, ScoreCandidateInput, ScoreJobInput } from "@/lib/types";
import { explainScore, round1 } from "./explain";

/* Prototype .match-card: 4px left border colored by score band. */
const bandBorder: Record<ScoreBand, string> = {
  high: "border-l-primary",
  mid: "border-l-warning",
  low: "border-l-danger",
};

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
  const band = scoreBand(match.score);

  const pros = match.pros.slice(0, LIST_LIMIT);
  const cons = match.cons.slice(0, LIST_LIMIT);
  const moreCount = Math.max(match.pros.length - LIST_LIMIT, 0);

  return (
    <Card className={cn("border-l-4", bandBorder[band])}>
      <CardBody className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink">
              {flagged ? <span aria-label="Flagged candidate">⭐ </span> : null}
              {title}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>
            {chips ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{chips}</div> : null}
          </div>
          <ScorePill score={match.score} className="shrink-0 px-2.5 py-1 text-base" />
        </div>

        {match.edge ? (
          <div className="mt-3 rounded-control border border-primary-soft bg-gradient-to-r from-primary-faint to-white px-3 py-2 text-[13px] text-slate-700">
            ⚡ <span className="font-semibold">The Edge:</span> {match.edge}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <div>
            <p className="micro-label text-slate-500">Pros</p>
            <ul className="mt-1 space-y-1 text-[13px] text-slate-700">
              {pros.length > 0 ? (
                pros.map((pro) => (
                  <li key={pro} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-primary">
                      ✓
                    </span>
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
            <p className="micro-label text-slate-500">Cons / Gaps</p>
            <ul className="mt-1 space-y-1 text-[13px] text-slate-700">
              {cons.length > 0 ? (
                cons.map((con) => (
                  <li key={con} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-danger">
                      ✕
                    </span>
                    <span>{con}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">None identified</li>
              )}
            </ul>
          </div>
        </div>

        {match.gaps.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-slate-600">Skill gaps:</span>
            {match.gaps.map((gap) => (
              <Badge key={gap} variant="danger">
                {gap}
              </Badge>
            ))}
          </div>
        ) : null}

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

        {expanded ? <ScoreBreakdown id={panelId} candidate={candidate} job={job} /> : null}
      </CardBody>
    </Card>
  );
}

/** Point-by-point table mirroring lib/scoring's math (domain rule 2). */
function ScoreBreakdown({
  id,
  candidate,
  job,
}: {
  id: string;
  candidate: ScoreCandidateInput;
  job: ScoreJobInput;
}) {
  const explanation = explainScore(candidate, job);

  return (
    <div id={id} className="mt-2.5 overflow-hidden rounded-[10px] border border-slate-200">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-slate-50">
            <th scope="col" className="micro-label px-3 py-2 text-slate-500">
              Component
            </th>
            <th scope="col" className="micro-label px-3 py-2 text-slate-500">
              How it scored
            </th>
            <th scope="col" className="micro-label px-3 py-2 text-right text-slate-500">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {explanation.rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-semibold whitespace-nowrap text-slate-700">
                {row.label}
              </td>
              <td className="px-3 py-1.5 text-slate-500">{row.detail}</td>
              <td
                className={cn(
                  "px-3 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap",
                  row.earned === 0 ? "text-danger-strong" : "text-slate-700",
                )}
              >
                {round1(row.earned)} / {row.possible}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-3 py-2 font-bold text-ink">Total</td>
            <td className="px-3 py-2 text-slate-500">
              round({round1(explanation.earned)} ÷ {explanation.possible} × 100)
            </td>
            <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">
              {explanation.score} / 100
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
