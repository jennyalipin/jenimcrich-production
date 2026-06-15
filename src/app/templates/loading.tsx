import { Skeleton, SkeletonCard } from "@/components/ui";

export default function TemplatesLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} header={false} lines={2} />
          ))}
        </div>
        <SkeletonCard lines={9} />
      </div>
    </div>
  );
}
