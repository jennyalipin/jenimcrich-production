"use client";

import { useId, useState } from "react";
import { cn } from "@/components/ui";
import { explainScore, round1 } from "@/lib/scoring-explain";
import type { ScoreCandidateInput, ScoreJobInput } from "@/lib/types";

/**
 * Point-by-point table mirroring lib/scoring's math (domain rule 2): every
 * row reconciles to the headline number, so a recruiter (or a candidate, or
 * an auditor) can see exactly why a score is what it is. Pure render over the
 * pure `explainScore()` — no I/O.
 */
export function ScoreExplanationTable({
  candidate,
  job,
  id,
}: {
  candidate: ScoreCandidateInput;
  job: ScoreJobInput;
  id?: string;
}) {
  const explanation = explainScore(candidate, job);

  return (
    <div id={id} className="overflow-hidden rounded-[10px] border border-slate-200">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-slate-50">
            <th scope="col" className="micro-label px-3 py-2 font-bold text-slate-600">
              Component
            </th>
            <th scope="col" className="micro-label px-3 py-2 font-bold text-slate-600">
              How it scored
            </th>
            <th scope="col" className="micro-label px-3 py-2 text-right font-bold text-slate-600">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {explanation.rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100 even:bg-slate-50">
              <td className="px-3 py-2 font-semibold whitespace-nowrap text-slate-700">
                {row.label}
              </td>
              <td className="px-3 py-2 text-slate-500">{row.detail}</td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap",
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

/**
 * Self-contained "Explain this score" disclosure: a toggle button plus the
 * point-by-point breakdown. Drop it in anywhere a score is shown and the
 * scoring inputs are on hand (matchmaker, candidate detail) so the reasoning
 * is always one click away.
 */
export function ExplainScore({
  candidate,
  job,
  className,
}: {
  candidate: ScoreCandidateInput;
  job: ScoreJobInput;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className={className}>
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
      {expanded ? (
        <div className="mt-2.5">
          <ScoreExplanationTable id={panelId} candidate={candidate} job={job} />
        </div>
      ) : null}
    </div>
  );
}
