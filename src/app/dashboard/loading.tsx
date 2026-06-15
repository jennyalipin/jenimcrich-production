import { SkeletonCard, SkeletonHeader, SkeletonStatCards } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonHeader />
      <SkeletonStatCards count={5} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
