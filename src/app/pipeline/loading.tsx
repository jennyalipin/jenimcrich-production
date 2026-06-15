import { Skeleton, SkeletonKanban } from "@/components/ui";

export default function PipelineLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-40" />
      </div>
      <SkeletonKanban />
    </div>
  );
}
