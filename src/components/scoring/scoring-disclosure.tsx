import { Icon, cn } from "@/components/ui";

/**
 * Plain-language transparency notice for the automated match score. Shown
 * wherever scores drive a decision (Matchmaker, candidate detail) so it is
 * clear the score is an assistive aid — measuring concrete, job-related
 * inputs — and that a recruiter makes every final call, with the reasoning
 * always available. Aligns with EEOC "job-related" framing and the disclosure
 * / human-in-the-loop expectations of AI-hiring rules (NYC LL144, Colorado,
 * Illinois). Static, server-renderable.
 */
export function ScoringDisclosure({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-control border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600",
        className,
      )}
    >
      <Icon name="info" size={15} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
      <p>
        <span className="font-semibold text-slate-700">How the match score works.</span>{" "}
        It is an assistive ranking aid that weighs job-related inputs only — required
        skills and their weight, years of experience and certifications. It does not
        decide anything: a recruiter reviews every candidate and makes the final call.
        Open <span className="font-medium text-slate-700">Explain this score</span> on any
        result to see the point-by-point breakdown.
      </p>
    </div>
  );
}
