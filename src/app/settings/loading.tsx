import { SkeletonCard } from "@/components/ui";

export default function SettingsLoading() {
  return (
    <div className="p-6">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <div className="grid gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}
