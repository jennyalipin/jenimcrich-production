import { Skeleton, SkeletonCard, SkeletonStatCards } from "@/components/ui";

export default function JobDetailLoading() {
  return (
    <div className="space-y-4 p-6">
      {/* Header card */}
      <div
        aria-hidden="true"
        className="rounded-card border border-slate-200 bg-surface p-5 shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-72 max-w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <SkeletonStatCards count={4} className="xl:grid-cols-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
