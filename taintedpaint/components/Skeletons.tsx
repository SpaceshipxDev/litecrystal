"use client";

export function TaskSkeleton() {
  return (
    <div className="rounded-[3px] border border-gray-200 bg-white p-3 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}

export function ColumnSkeleton({ title }: { title: string }) {
  return (
    <div className="flex-shrink-0 w-80 flex flex-col rounded-md border border-gray-200 bg-gray-50">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-gray-50 z-20">
        <h2 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
        <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">…</span>
        <div className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-3 bg-gradient-to-b from-gray-50 to-transparent" />
      </div>
      <div className="p-3 space-y-2">
        <TaskSkeleton />
        <TaskSkeleton />
        <TaskSkeleton />
      </div>
    </div>
  );
}


