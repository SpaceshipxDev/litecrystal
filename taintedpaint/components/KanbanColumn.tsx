"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import { Archive, Plus, Search, X, MoveRight, Play } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import type { Task, TaskSummary, Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  columnTasks: (TaskSummary & Partial<Task>)[];
  isArchive: boolean;
  taskRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  viewMode: "business" | "production";
  isRestricted: boolean;
  searchQuery: string;
  renderHighlighted: (text: string | undefined, q: string) => React.ReactNode;
  highlightTaskId: string | null;
  handleTaskClick: (task: Task, columnId: string, e: React.MouseEvent) => void;
  handleDragStart: (e: React.DragEvent, task: Task, sourceColumnId: string) => void;
  handleDragEnd: () => void;
  handleDragOverTask: (e: React.DragEvent, index: number, columnId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnterColumn: (columnId: string) => void;
  handleDragLeaveColumn: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, columnId: string, dropIndex?: number) => void;
  dragOverColumn: string | null;
  dropIndicatorIndex: number | null;
  handleQuickHandoff: (taskId: string, sourceColumnId: string, targetColumnId: string) => void;
  addPickerOpenFor: string | null;
  setAddPickerOpenFor: React.Dispatch<React.SetStateAction<string | null>>;
  addPickerQuery: string;
  setAddPickerQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSelectAddTask: (taskId: string, columnId: string) => void;
  columns: Column[];
  tasks: Record<string, (TaskSummary & Partial<Task>)>;
  getTaskDisplayName: (task: TaskSummary) => string;
  handleConfirmWork: (taskId: string, columnId: string) => void;
}

export default function KanbanColumn({
  column,
  columnTasks,
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
  handleQuickHandoff,
  addPickerOpenFor,
  setAddPickerOpenFor,
  addPickerQuery,
  setAddPickerQuery,
  handleSelectAddTask,
  columns,
  tasks,
  getTaskDisplayName,
  handleConfirmWork,
}: KanbanColumnProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const bodyRef = useRef<HTMLDivElement>(null);
  const hideNames = viewMode === "production" || isRestricted;
  const [handoffOpenFor, setHandoffOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (!handoffOpenFor) return;
    const close = () => setHandoffOpenFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [handoffOpenFor]);

  const archiveGroups = useMemo(() => {
    if (!isArchive) return [];
    const sorted = [...columnTasks].sort((a, b) => {
      // Ensure in-progress tasks are listed before others
      const aProgress = !!a.inProgress;
      const bProgress = !!b.inProgress;
      if (aProgress && !bProgress) return -1;
      if (!aProgress && bProgress) return 1;
      const da = a.updatedAt || a.createdAt || "";
      const db = b.updatedAt || b.createdAt || "";
      return db.localeCompare(da);
    });
    const groups: Record<string, (TaskSummary & Partial<Task>)[]> = {};
    for (const t of sorted) {
      const day = (t.updatedAt || t.createdAt || "").slice(0, 10) || "无日期";
      (groups[day] = groups[day] || []).push(t);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [isArchive, columnTasks]);

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
        ) : isArchive ? (
          (() => {
            let idx = 0;
            return archiveGroups.map(([day, tasks]) => (
              <div key={day} className="mb-2">
                <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50">{day}</div>
                {tasks.map((task) => {
                  const currentIndex = idx++;
                  return (
                    <div
                      key={task.id}
                      className="relative group"
                    >
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
                          isArchive
                          onClick={(e) => handleTaskClick(task as Task, column.id, e)}
                          draggableProps={{
                            draggable: true,
                            onDragStart: (e) => handleDragStart(e, task as any, column.id),
                            onDragEnd: handleDragEnd,
                            onDragOver: (e) => handleDragOverTask(e, currentIndex, column.id),
                          }}
                        />
                      </div>
                      {dragOverColumn === column.id && dropIndicatorIndex === currentIndex + 1 && (
                        <div className="h-0.5 bg-blue-500 mt-2 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()
        ) : (
          columnTasks.map((task, index) => {
            return (
              <div
                key={task.id}
                className="relative group"
              >
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
                    isArchive={false}
                    onClick={(e) => handleTaskClick(task as Task, column.id, e)}
                    draggableProps={{
                      draggable: true,
                      onDragStart: (e) => handleDragStart(e, task as any, column.id),
                      onDragEnd: handleDragEnd,
                      onDragOver: (e) => handleDragOverTask(e, index, column.id),
                    }}
                  />
                </div>
                <button
                  className="absolute top-1 right-7 z-10 hidden group-hover:inline-flex p-1.5 rounded-[2px] bg-white text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-transform duration-150 hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHandoffOpenFor(task.id);
                  }}
                >
                  <MoveRight className="w-4 h-4" />
                </button>
                {handoffOpenFor === task.id && (
                  <div className="absolute top-6 right-1 z-20 flex flex-col rounded-[2px] border border-gray-200 bg-white shadow-lg">
                    {columns
                      .filter((c) => c.id !== column.id)
                      .map((c) => (
                        <button
                          key={c.id}
                          className="px-2 py-1 text-left text-[11px] text-gray-700 hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickHandoff(task.id, column.id, c.id);
                            setHandoffOpenFor(null);
                          }}
                        >
                          {c.title}
                        </button>
                      ))}
                  </div>
                )}
                {!task.inProgress ? (
                  <button
                    className="absolute top-1 right-1 p-1.5 rounded-[2px] bg-white text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-transform duration-150"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmWork(task.id, column.id);
                    }}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="absolute top-1 right-1 z-0 px-1.5 py-0.5 rounded-[2px] bg-blue-50 text-blue-600 text-[10px] pointer-events-none">
                    进行中
                  </div>
                )}
                {dragOverColumn === column.id && dropIndicatorIndex === index + 1 && (
                  <div className="h-0.5 bg-blue-500 mt-2 animate-pulse" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
