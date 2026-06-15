import { SkeletonCard, SkeletonHeader, SkeletonStatCards } from "@/components/ui";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonHeader />
      <SkeletonStatCards count={4} className="xl:grid-cols-4" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
