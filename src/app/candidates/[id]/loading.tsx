import { Skeleton, SkeletonCard } from "@/components/ui";

export default function CandidateDetailLoading() {
  return (
    <div className="space-y-4 p-6">
      {/* Header card */}
      <div
        aria-hidden="true"
        className="rounded-card border border-slate-200 bg-surface p-5 shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div aria-hidden="true" className="flex gap-5 border-b border-slate-200 pb-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-3.5 w-16" />
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonCard header={false} lines={7} />
        <div className="space-y-5">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}
