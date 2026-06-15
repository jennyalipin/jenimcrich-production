import { cn } from "./cn";

export type ScoreBand = "high" | "mid" | "low";

/** Domain rule: green >= 80, amber 60-79, red < 60. */
export function scoreBand(score: number): ScoreBand {
  return score >= 80 ? "high" : score >= 60 ? "mid" : "low";
}

// Tinted fill + ink text + a same-hue hairline ring (inset) so the signature
// chip reads as a deliberate, slightly-raised object rather than a flat fill.
const bandClass: Record<ScoreBand, string> = {
  high: "bg-primary-soft text-primary-ink shadow-[inset_0_0_0_1px_rgb(5_150_105/0.22)]",
  mid: "bg-warning-soft text-warning-ink shadow-[inset_0_0_0_1px_rgb(217_119_6/0.22)]",
  low: "bg-danger-soft text-danger-ink shadow-[inset_0_0_0_1px_rgb(220_38_38/0.2)]",
};

export interface ScorePillProps {
  /** 0-100; values outside the range are clamped, fractions rounded. */
  score: number;
  /** Screen-reader context. Defaults to "Match score". */
  label?: string;
  className?: string;
}

/**
 * The match-score chip — the system's signature element. Weight-800 tabular
 * digits in a tinted chip, min-width 44px so columns of scores align.
 */
export function ScorePill({ score, label = "Match score", className }: ScorePillProps) {
  const value = Math.round(Math.min(100, Math.max(0, score)));
  const band = scoreBand(value);
  return (
    <span
      title={`${label}: ${value}/100`}
      className={cn(
        "inline-flex min-w-11 items-center justify-center rounded-control px-2 py-0.5 text-[13px] font-extrabold tabular-nums",
        bandClass[band],
        className,
      )}
    >
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">{`${label} ${value} out of 100`}</span>
    </span>
  );
}
