"use client";

import React, { useEffect, useRef } from "react";
import { Archive, Plus, Search, X, Check } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import type { Task, TaskSummary, Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  columnTasks: (TaskSummary & Partial<Task>)[];
  pendingTasks: (TaskSummary & Partial<Task>)[];
  isArchive: boolean;
  taskRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  viewMode: "business" | "production";
  isRestricted: boolean;
  searchQuery: string;
  renderHighlighted: (text: string | undefined, q: string) => React.ReactNode;
  highlightTaskId: string | null;
  handleTaskClick: (task: Task, e: React.MouseEvent) => void;
  handleDragStart: (e: React.DragEvent, task: Task, sourceColumnId: string) => void;
  handleDragEnd: () => void;
  handleDragOverTask: (e: React.DragEvent, index: number, columnId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnterColumn: (columnId: string) => void;
  handleDragLeaveColumn: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, columnId: string, dropIndex?: number) => void;
  dragOverColumn: string | null;
  dropIndicatorIndex: number | null;
  addPickerOpenFor: string | null;
  setAddPickerOpenFor: React.Dispatch<React.SetStateAction<string | null>>;
  addPickerQuery: string;
  setAddPickerQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSelectAddTask: (taskId: string, columnId: string) => void;
  columns: Column[];
  tasks: Record<string, (TaskSummary & Partial<Task>)>;
  openPending: Record<string, boolean>;
  setOpenPending: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  animateAcceptPending: (taskId: string, columnId: string) => void;
  animateDeclinePending: (taskId: string, columnId: string) => void;
  handleRemoveTask: (taskId: string, columnId: string) => void;
  getTaskDisplayName: (task: TaskSummary) => string;
  acceptingPending: Record<string, boolean>;
  decliningPending: Record<string, boolean>;
}

export default function KanbanColumn({
  column,
  columnTasks,
  pendingTasks,
  isArchive,
  taskRefs,
  viewMode,
  isRestricted,
  searchQuery,
  renderHighlighted,
  highlightTaskId,
  handleTaskClick,
  handleDragStart,
  handleDragEnd,
  handleDragOverTask,
  handleDragOver,
  handleDragEnterColumn,
  handleDragLeaveColumn,
  handleDrop,
  dragOverColumn,
  dropIndicatorIndex,
  addPickerOpenFor,
  setAddPickerOpenFor,
  addPickerQuery,
  setAddPickerQuery,
  handleSelectAddTask,
  columns,
  tasks,
  openPending,
  setOpenPending,
  animateAcceptPending,
  animateDeclinePending,
  handleRemoveTask,
  getTaskDisplayName,
  acceptingPending,
  decliningPending,
}: KanbanColumnProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const bodyRef = useRef<HTMLDivElement>(null);
  const hideNames = viewMode === "production" || isRestricted;

  useEffect(() => {
    if (openPending[column.id]) {
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [openPending[column.id]]);
  return (
    <div
      data-col-id={column.id}
      onDragOver={handleDragOver}
      onDragEnter={() => handleDragEnterColumn(column.id)}
      onDragLeave={handleDragLeaveColumn}
      onDrop={(e) => handleDrop(e, column.id, dropIndicatorIndex ?? undefined)}
      className="relative flex-shrink-0 w-80 flex flex-col rounded-[2px] border border-gray-200 bg-white overflow-hidden min-h-0 shadow-sm"
    >
      {/* Column Header */}
        <div className="relative z-10 bg-white px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isArchive && <Archive className="w-4 h-4 text-gray-400" />}
          <h2 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
            {column.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pendingTasks.length > 0 && (
            <button
              onClick={() => setOpenPending((prev) => ({ ...prev, [column.id]: !prev[column.id] }))}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-[2px] border border-gray-200 bg-white text-gray-800 hover:bg-gray-100 transition"
              title="待接收"
            >
              <span aria-hidden className="h-2 w-2 rounded-full bg-slate-500" />
              <span>待接收</span>
              <span className="ml-0.5 inline-flex items-center justify-center rounded-[2px] border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] tabular-nums">
                {pendingTasks.length}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              setAddPickerQuery("");
              setAddPickerOpenFor((prev) => (prev === column.id ? null : column.id));
            }}
            className="p-1 hover:bg-gray-100 rounded-[2px]"
            aria-label="添加现有任务"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-[11px] font-medium text-gray-700 bg-white px-2 py-0.5 rounded-[2px] border border-gray-200">
            {columnTasks.length}
          </span>
        </div>
      </div>

      {/* Column body (vertical scroll) */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto p-3 pb-6 space-y-2 [scrollbar-gutter:stable] scroll-smooth overscroll-y-contain bg-gray-50"
      >
        <div className="pointer-events-none sticky top-0 z-0 -mt-3 h-3 bg-gradient-to-b from-gray-50 to-transparent" />
        {addPickerOpenFor === column.id && (
          <div className="mb-3 rounded-[2px] border border-gray-200 bg-white p-2 shadow-sm">
            <div className="flex items-center gap-2 px-1 pb-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                id={`addpicker-input-${column.id}`}
                type="text"
                value={addPickerQuery}
                onChange={(e) => setAddPickerQuery(e.target.value)}
                placeholder="添加现有任务到此列…"
                className="w-full bg-transparent focus:outline-none text-sm placeholder:text-gray-400"
                autoFocus
              />
              <button
                onClick={() => {
                  setAddPickerOpenFor(null);
                  setAddPickerQuery("");
                }}
                className="p-1 rounded-[2px] hover:bg-gray-100"
                aria-label="关闭"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-gray-100">
              {(() => {
                const q = addPickerQuery.trim().toLowerCase();
                const list = Object.values(tasks)
                  .filter((t) => t && (t as any).id)
                  // Hide tasks already present in this column to avoid no-op selections
                  .filter((t) => !column.taskIds.includes((t as any).id))
                  .filter((t) => {
                    if (q === "") return true;
                    const text = hideNames
                      ? `${t.ynmxId || ""}`.toLowerCase()
                      : `${t.customerName} ${t.representative} ${t.ynmxId || ""} ${t.notes || ""}`.toLowerCase();
                    return text.includes(q);
                  })
                  .slice(0, 50);
                if (list.length === 0) {
                  return <div className="px-3 py-6 text-center text-sm text-gray-500">没有匹配的任务</div>;
                }
                return list.map((t) => {
                  const col = columns.find((c) => c.id === t.columnId);
                  return (
                    <button
                      key={(t as any).id}
                      onClick={() => handleSelectAddTask((t as any).id, column.id)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-[2px] transition-colors"
                    >
                      <div className="min-w-0">
                        {hideNames ? (
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {(t as any).ynmxId || "—"}
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {(t as any).customerName}{" "}
                              <span className="text-gray-500">· {(t as any).representative}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {(t as any).ynmxId && <span className="truncate">{(t as any).ynmxId}</span>}
                              {col && (
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-100 border border-gray-200">{col.title}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {openPending[column.id] && pendingTasks.length > 0 && (
          <div className="mb-3 rounded-[2px] border border-gray-200 bg-white p-2 shadow-sm">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[11px] font-medium text-gray-700">待接收</div>
              <button
                className="text-[11px] px-2 py-0.5 rounded-[2px] border border-gray-200 bg-white hover:bg-gray-100"
                onClick={() => setOpenPending((prev) => ({ ...prev, [column.id]: !prev[column.id] }))}
              >
                收起
              </button>
            </div>
            <div className="space-y-1.5">
              {pendingTasks.map((task) => {
                const isDropHighlighted = highlightTaskId === task.id;
                const isAccepting = acceptingPending[task.id];
                const isDeclining = decliningPending[task.id];
                return (
                  <div
                    key={task.id}
                    ref={(node) => {
                      if (node) taskRefs.current.set(task.id, node);
                      else taskRefs.current.delete(task.id);
                    }}
                    className={[
                      "relative rounded-[2px] border border-yellow-200 bg-yellow-50 p-2.5 cursor-pointer transition-all duration-300",
                      isDropHighlighted ? "ring-2 ring-blue-500/40 drop-flash card-appear" : "",
                      isAccepting || isDeclining ? "transform scale-[0.98] opacity-80" : "",
                    ].join(" ")}
                    onClick={(e) => handleTaskClick(task as Task, e)}
                  >
                  {/* Left status strip for pending tasks as well */}
                  {(() => {
                    const dueToday = task.deliveryDate && task.deliveryDate === todayStr;
                    const overdue = task.deliveryDate && task.deliveryDate < todayStr;
                    const cls = overdue ? "bg-red-400" : dueToday ? "bg-amber-400" : "bg-gray-300";
                    return (
                      <div aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[2px] ${cls}`} />
                    );
                  })()}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {getTaskDisplayName(task)}
                      </h3>
              {!hideNames && (
                        <p className="text-xs text-gray-600">{task.representative}</p>
              )}
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button
                        className="p-1 rounded-[2px] bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          animateAcceptPending(task.id, column.id);
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded-[2px] bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          animateDeclinePending(task.id, column.id);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {columnTasks.length === 0 ? (
          <div className="py-8 flex items-center justify-center rounded-md">
            <div className="text-center">
              {isArchive ? (
                <>
                  <Archive className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">拖拽任务到此处归档</p>
                </>
              ) : (
                <p className="text-xs text-gray-400">暂无任务</p>
              )}
            </div>
          </div>
        ) : (
          columnTasks.map((task, index) => (
            <div key={task.id} className="relative group">
              <div
                ref={(node) => {
                  if (node) taskRefs.current.set(task.id, node);
                  else taskRefs.current.delete(task.id);
                }}
              >
                <TaskCard
                  task={task as any}
                  viewMode={viewMode}
                  isRestricted={isRestricted}
                  searchRender={(txt?: string) => renderHighlighted(txt, searchQuery)}
                  isHighlighted={highlightTaskId === task.id}
                  onClick={(e) => handleTaskClick(task as Task, e)}
                  draggableProps={{
                    draggable: true,
                    onDragStart: (e) => handleDragStart(e, task as any, column.id),
                    onDragEnd: handleDragEnd,
                    onDragOver: (e) => handleDragOverTask(e, index, column.id),
                  }}
                />
              </div>
              <button
                className="absolute top-1 right-1 hidden group-hover:inline-flex p-1 rounded-[2px] bg-white text-gray-400 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTask(task.id, column.id);
                }}
              >
                <X className="w-3 h-3" />
              </button>
              {dragOverColumn === column.id && dropIndicatorIndex === index + 1 && (
                <div className="h-0.5 bg-blue-500 mt-2 animate-pulse" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
