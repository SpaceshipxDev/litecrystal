"use client";

import type React from "react";
import type { Task, TaskSummary } from "@/types";
import { CalendarDays, Hash, Clock } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

export default function TaskCard({
  task,
  viewMode,
  isRestricted,
  searchRender,
  isHighlighted,
  onClick,
  draggableProps,
}: {
  task: TaskSummary & Partial<Task>;
  viewMode: "business" | "production";
  isRestricted: boolean;
  searchRender: (text?: string) => React.ReactNode;
  isHighlighted: boolean;
  onClick: (e: React.MouseEvent) => void;
  draggableProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
  };
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = task.deliveryDate && task.deliveryDate < todayStr;

  const titleNode =
    viewMode === "business"
      ? searchRender(task.customerName) || "未命名客户"
      : isRestricted
      ? searchRender(task.ynmxId || "—")
      : searchRender(task.ynmxId || `${task.customerName || ""} - ${task.representative || ""}`);

  return (
    <div
      {...draggableProps}
      onClick={onClick}
      className={[
        "relative cursor-move rounded-[3px] border bg-white p-3 transition-shadow",
        "border-gray-200 hover:shadow-md shadow-sm",
        "",
        isHighlighted ? "ring-2 ring-blue-500/40" : "",
      ].join(" ")}
    >
      <h3 className="truncate text-[13px] leading-snug font-medium text-gray-900">{titleNode}</h3>

      <div className="mt-2 flex flex-wrap gap-1">
        {task.representative && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-medium">
            {searchRender(task.representative)}
          </span>
        )}
        <span
          className={[
            "px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1",
            overdue ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-gray-100 text-gray-700",
          ].join(" ")}
        >
          <CalendarDays className="w-3 h-3" />
          {task.deliveryDate ? (
            <span>{task.deliveryDate}</span>
          ) : (
            <span className="text-gray-500">无交期</span>
          )}
        </span>
      </div>

      {task.notes && (
        <p className="mt-2 truncate text-[12px] leading-snug text-gray-500">{searchRender(task.notes)}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-gray-500 flex-nowrap">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Hash className="w-3 h-3" />
          {task.ynmxId ?? "—"}
        </span>
        {task.updatedAt && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap max-w-[55%] overflow-hidden truncate">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.updatedBy ? `${task.updatedBy} · ` : ""}{formatTimeAgo(task.updatedAt)}</span>
          </span>
        )}
      </div>
    </div>
  );
}


