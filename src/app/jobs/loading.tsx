import { Skeleton, SkeletonTable } from "@/components/ui";

export default function JobsLoading() {
  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-9 w-28" />
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
