import { Skeleton, SkeletonTable } from "@/components/ui";

export default function CandidatesLoading() {
  return (
    <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start">
      {/* Filter rail */}
      <div
        aria-hidden="true"
        className="w-full shrink-0 space-y-3 rounded-card border border-slate-200 bg-surface p-4 shadow-card lg:w-60"
      >
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-2.5 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-9 w-32" />
        </div>
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}
