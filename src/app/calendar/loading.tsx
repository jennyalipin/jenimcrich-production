import { Skeleton } from "@/components/ui";

export default function CalendarLoading() {
  return (
    <div className="p-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-9 w-44" />
      </div>
      {/* Type legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-24 rounded-full" />
        ))}
      </div>
      {/* Month grid */}
      <div
        aria-hidden="true"
        className="mt-3 overflow-hidden rounded-card border border-slate-200 bg-surface shadow-card"
      >
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="border-r border-slate-200 px-2 py-2.5 last:border-r-0">
              <Skeleton className="h-2.5 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }, (_, i) => (
            <div
              key={i}
              className="min-h-24 border-b border-r border-slate-100 p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0"
            >
              <Skeleton className="h-2.5 w-4" />
              {i % 4 === 0 ? <Skeleton className="mt-2 h-4 w-full rounded" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
