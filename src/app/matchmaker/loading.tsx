import { Skeleton, SkeletonHeader, SkeletonTable } from "@/components/ui";

export default function MatchmakerLoading() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonHeader />
      {/* Upload dropzone */}
      <div
        aria-hidden="true"
        className="grid place-items-center gap-3 rounded-card border border-dashed border-slate-300 bg-surface px-6 py-12 shadow-card"
      >
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-3.5 w-56" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      {/* Ranked results */}
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
