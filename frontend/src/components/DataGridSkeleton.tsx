import { memo } from "react";
import { Shimmer } from "@/components/ui/shimmer";

type DataGridSkeletonProps = {
  /** Number of shimmer table rows */
  rows?: number;
  /** Number of shimmer columns in header */
  columns?: number;
};

function DataGridSkeletonInner({
  rows = 8,
  columns = 7,
}: DataGridSkeletonProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-busy
      aria-label="Loading data table"
    >
      {/* Toolbar */}
      <div className="space-y-4 border-b border-slate-100 bg-slate-50/80 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-3 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Shimmer className="h-9 w-72" />
            <Shimmer className="h-9 w-24" />
            <Shimmer className="h-9 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Shimmer className="h-2.5 w-16" />
              <Shimmer className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Shimmer key={i} className="h-3 w-full max-w-[88px]" />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-slate-100 px-4">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="py-3">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((_, colIdx) => (
                <Shimmer
                  key={colIdx}
                  className="h-3.5 w-full"
                  style={{ maxWidth: colIdx === 0 ? "120px" : "72px" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
        <Shimmer className="h-3 w-40" />
        <div className="flex gap-2">
          <Shimmer className="h-8 w-20" />
          <Shimmer className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}

const DataGridSkeleton = memo(DataGridSkeletonInner);
export default DataGridSkeleton;

export function ExecutiveKpiCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className={`grid grid-cols-1 gap-3 sm:grid-cols-${count > 3 ? 4 : 3}`}
      style={{
        gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ExecutiveFiltersSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Shimmer className="mb-2 h-4 w-28" />
      <Shimmer className="mb-4 h-3 w-64" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
