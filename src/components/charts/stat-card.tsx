import type { ReactNode } from "react";
import { Card, cn } from "@/components/ui";

export type StatCardTone = "default" | "success" | "warning" | "danger";

const toneClass: Record<StatCardTone, string> = {
  default: "text-ink",
  success: "text-primary",
  warning: "text-warning",
  danger: "text-danger-strong",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Quiet context line under the number ("3 flagged priority"). */
  sub?: ReactNode;
  /** Colors the headline number; use "warning" for stalled counts. */
  tone?: StatCardTone;
  className?: string;
}

/** Dense KPI tile: micro label, big number, quiet context line. Server-safe. */
export function StatCard({ label, value, sub, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("px-5 py-4", className)}>
      <div className="micro-label text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums",
          toneClass[tone],
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-slate-500">{sub}</div> : null}
    </Card>
  );
}
