import { cn } from "./cn";

export interface SkeletonProps {
  className?: string;
}

/** Size it with width/height utilities, e.g. <Skeleton className="h-4 w-40" />. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-slate-200/80", className)} />;
}

export interface SkeletonTextProps {
  /** Number of lines; the last line is shortened. Defaults to 3. */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-3 animate-pulse rounded bg-slate-200/80",
            i === lines - 1 && lines > 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

export interface SkeletonTableProps {
  /** Defaults to 5 rows x 4 columns. */
  rows?: number;
  cols?: number;
  className?: string;
}

/** Placeholder shaped like a DataTable inside a Card. */
export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-card border border-slate-200 bg-surface shadow-card", className)}
    >
      <div className="flex gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="h-2.5 flex-1 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={cn("h-3 flex-1 animate-pulse rounded bg-slate-200/80", c === 0 && "max-w-40")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
