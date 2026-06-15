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

/** Page header placeholder: optional eyebrow, a focal title, and a subtitle. */
export function SkeletonHeader({
  eyebrow = true,
  className,
}: {
  eyebrow?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5 pb-1", className)}>
      {eyebrow ? <Skeleton className="h-2.5 w-28" /> : null}
      <Skeleton className="h-6 w-72 max-w-full" />
      <Skeleton className="h-3 w-96 max-w-full" />
    </div>
  );
}

/** A Card-shaped block — hairline border, optional header bar, body text lines. */
export function SkeletonCard({
  header = true,
  lines = 4,
  className,
  bodyClassName,
}: {
  header?: boolean;
  lines?: number;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "self-start overflow-hidden rounded-card border border-slate-200 bg-surface shadow-card",
        className,
      )}
    >
      {header ? (
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

/** Row of KPI stat-card tiles. Override the grid via className. */
export function SkeletonStatCards({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-card border border-slate-200 bg-surface p-4 shadow-card"
        >
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-14" />
          <Skeleton className="mt-2.5 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Kanban columns with a few card placeholders — for the pipeline board. */
export function SkeletonKanban({
  columns = 6,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-1 gap-3 overflow-hidden", className)}>
      {Array.from({ length: columns }, (_, i) => (
        <div
          key={i}
          className="flex w-64 shrink-0 flex-col gap-2.5 rounded-card border border-slate-200 bg-slate-50/70 p-2.5"
        >
          <div className="flex items-center justify-between px-1 py-0.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-5" />
          </div>
          {Array.from({ length: 3 - (i % 2) }, (_, r) => (
            <div
              key={r}
              className="space-y-2.5 rounded-card border border-slate-200 bg-surface p-3 shadow-card"
            >
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
              <div className="flex gap-2 pt-0.5">
                <Skeleton className="h-4 w-10 rounded-full" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
