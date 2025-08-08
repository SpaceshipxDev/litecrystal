"use client";

import type React from "react";
import type { Task, TaskSummary, Column, BoardData, BoardSummaryData } from "@/types";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CreateJobForm from "@/components/CreateJobForm";
import { Archive, Check, Plus, Search, X } from "lucide-react";
import { baseColumns, START_COLUMN_ID, ARCHIVE_COLUMN_ID } from "@/lib/baseColumns";
import TaskModal from "@/components/TaskModal";
import TaskCard from "@/components/TaskCard";
import { ColumnSkeleton } from "@/components/Skeletons";

/* ──────────────────────────────────────────────────────────────────────────────
   MiniMapNav — Jira-style bottom-right navigator (ALWAYS visible)
   - Shows a tiny "map" of columns and a draggable viewport pill.
   - Fixed in the bottom-right, so you never scroll to reach it.
   - Click the track to jump; drag pill to scroll; wheel to nudge; arrows to page.
   - Uses real DOM measurements from the board scroller via containerRef.
   ─────────────────────────────────────────────────────────────────────────── */
function MiniMapNav({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  // Board metrics (what's visible vs total)
  const [metrics, setMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });

  // Actual column segments (so the mini-map mirrors your board precisely)
  const [segments, setSegments] = useState<Array<{ id: string; left: number; width: number }>>([]);

  // Drag state for the viewport pill
  const draggingRef = useRef<{ startX: number; startLeft: number } | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;

    const cols = Array.from(el.querySelectorAll<HTMLElement>("[data-col-id]"));
    const segs = cols.map((node) => ({
      id: node.getAttribute("data-col-id") || "",
      left: node.offsetLeft,
      width: node.offsetWidth,
    }));

    setMetrics({ scrollLeft, scrollWidth, clientWidth });
    setSegments(segs);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      setMetrics((m) => ({
        ...m,
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    const mo = new MutationObserver(() => queueMicrotask(measure));
    mo.observe(el, { childList: true, subtree: true });

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, containerRef]);

  // Geometry for the mini-map
  const PADDING = 8;
  const MAP_W = 280;
  const MAP_H = 40;
  const trackW = MAP_W - PADDING * 2;

  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  const maxScroll = Math.max(1, scrollWidth - clientWidth);
  const viewportRatio = Math.max(0, Math.min(1, clientWidth / Math.max(1, scrollWidth)));
  const handleW = Math.max(24, Math.round(trackW * viewportRatio));
  const progress = Math.max(0, Math.min(1, scrollLeft / maxScroll));
  const handleX = Math.round(progress * (trackW - handleW));
  const hasOverflow = scrollWidth > clientWidth + 2;

  const trackXToScrollLeft = (x: number) => {
    const clamped = Math.max(0, Math.min(trackW - handleW, x));
    const p = clamped / Math.max(1, trackW - handleW);
    return Math.round(p * maxScroll);
  };

  const onMouseDownHandle = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = { startX: e.clientX, startLeft: handleX };
    const onMove = (me: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = me.clientX - draggingRef.current.startX;
      const nextTrackX = draggingRef.current.startLeft + delta;
      const el = containerRef.current;
      if (el) el.scrollTo({ left: trackXToScrollLeft(nextTrackX), behavior: "auto" });
    };
    const onUp = () => {
      draggingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - bounds.left - PADDING - handleW / 2;
    const el = containerRef.current;
    if (el) el.scrollTo({ left: trackXToScrollLeft(x), behavior: "smooth" });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    el.scrollBy({ left: delta, behavior: "auto" });
  };

  const page = (dir: -1 | 1) => {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.max(160, clientWidth - 80);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 select-none"
      onWheel={onWheel}
      aria-hidden={false}
    >
      <div
        className={`rounded-2xl border shadow-sm backdrop-blur ${
          hasOverflow ? "bg-white/90 border-gray-200" : "bg-white/70 border-gray-200/60"
        }`}
        title={hasOverflow ? "" : "没有更多内容可滚动"}
      >
        <div className="flex items-center gap-2 px-2 py-2">
          {/* Left page button */}
          <button
            onClick={() => page(-1)}
            className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
            disabled={!hasOverflow}
            aria-label="Scroll left"
          >
            ‹
          </button>

          {/* Track */}
          <div className="relative h-8" style={{ width: MAP_W }} onMouseDown={onTrackClick}>
            {/* Track background */}
            <div className="absolute inset-0 px-2">
              <div className="h-full w-full rounded-lg border border-gray-200 bg-gray-100" />
            </div>

            {/* Column segments */}
            <div className="absolute inset-0" style={{ padding: PADDING }}>
              <div className="relative h-full w-full">
                {segments.map((seg) => {
                  const x = (seg.left / Math.max(1, scrollWidth)) * trackW;
                  const w = Math.max(2, (seg.width / Math.max(1, scrollWidth)) * trackW - 2);
                  return (
                    <div
                      key={seg.id}
                      className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm bg-gray-300/70"
                      style={{ left: x, width: w }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Viewport pill */}
            <div className="absolute inset-0" style={{ padding: PADDING }}>
              <div
                role="slider"
                aria-label="Board viewport"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-md border bg-white shadow-sm ${
                  hasOverflow
                    ? "border-blue-300 cursor-grab active:cursor-grabbing"
                    : "border-gray-300 cursor-not-allowed"
                }`}
                style={{ left: handleX, width: handleW }}
                onMouseDown={hasOverflow ? onMouseDownHandle : undefined}
              />
            </div>
          </div>

          {/* Right page button */}
          <button
            onClick={() => page(1)}
            className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
            disabled={!hasOverflow}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   MAIN BOARD — single vertical scroller + horizontal columns
   - pb-16 keeps content from hiding behind the fixed mini-map (subtle safety).
   - 'board-scroll' holds the horizontal scrollable area we map in MiniMapNav.
   ─────────────────────────────────────────────────────────────────────────── */
export default function KanbanBoard() {
  const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const department = storedUser ? JSON.parse(storedUser).department : "";
  const viewMode: "business" | "production" = ["商务", "检验"].includes(department)
    ? "business"
    : "production";
  const isRestricted = storedUser ? !!JSON.parse(storedUser).restricted : false;

  const [tasks, setTasks] = useState<Record<string, (TaskSummary & Partial<Task>)>>({});
  const [columns, setColumns] = useState<Column[]>(baseColumns);
  const [draggedTask, setDraggedTask] = useState<(TaskSummary & Partial<Task>) | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openPending, setOpenPending] = useState<Record<string, boolean>>({});
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [addPickerOpenFor, setAddPickerOpenFor] = useState<string | null>(null);
  const [addPickerQuery, setAddPickerQuery] = useState("");
  const [acceptingPending, setAcceptingPending] = useState<Record<string, boolean>>({});
  const [decliningPending, setDecliningPending] = useState<Record<string, boolean>>({});
  const [handoffToast, setHandoffToast] = useState<{ message: string } | null>(null);
  const [handoffToastVisible, setHandoffToastVisible] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);

  const taskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null); // horizontal scroller (the "board")
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);
  const pendingBoardRef = useRef<BoardData | null>(null);

  // Search match helper (simple .includes across a few fields)
  const doesTaskMatchQuery = useCallback((task: TaskSummary & Partial<Task>, q: string) => {
    const query = q.trim().toLowerCase();
    if (query === "") return true;
    const haystack = `${task.customerName || ""} ${task.representative || ""} ${task.ynmxId || ""} ${task.notes || ""}`.toLowerCase();
    return haystack.includes(query);
  }, []);

  // Highlight matched text spans with <mark> (cheap visual)
  const renderHighlighted = useCallback((text: string | undefined, q: string) => {
    const value = text || "";
    const query = q.trim();
    if (!query) return value;
    const lower = value.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: Array<string> = [];
    let start = 0;
    let idx = lower.indexOf(lowerQuery);
    if (idx === -1) return value;
    while (idx !== -1) {
      parts.push(value.slice(start, idx));
      parts.push(value.slice(idx, idx + query.length));
      start = idx + query.length;
      idx = lower.indexOf(lowerQuery, start);
    }
    parts.push(value.slice(start));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === lowerQuery ? (
            <mark key={i} className="bg-yellow-200/60 rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }, []);

  // Add an existing task to a column (quick copy)
  const handleAddExistingTask = async (taskId: string, columnId: string) => {
    const original = tasks[taskId];
    if (!original) return;
    const newId = `${taskId}-${Date.now()}`;
    const time = new Date().toISOString();
    const newTask: TaskSummary & Partial<Task> = {
      ...original,
      id: newId,
      columnId,
      awaitingAcceptance: false,
      previousColumnId: undefined,
      updatedAt: time,
      updatedBy: userName,
      history: [
        ...(original.history || []),
        { user: userName, timestamp: time, description: `复制到${columns.find((c) => c.id === columnId)?.title || ""}` },
      ],
    };
    const nextTasks = { ...tasks, [newId]: newTask };
    let nextColumns = columns.map((col) =>
      col.id === columnId ? { ...col, taskIds: [newId, ...col.taskIds] } : col
    );
    nextColumns = sortColumnsData(nextColumns, nextTasks);
    setTasks(nextTasks);
    setColumns(nextColumns);
    await saveBoard({ tasks: nextTasks, columns: nextColumns });
  };

  // Toggle "Add existing task" picker
  const toggleAddPicker = (columnId: string) => {
    setAddPickerQuery("");
    setAddPickerOpenFor((prev) => (prev === columnId ? null : columnId));
  };
  const handleSelectAddTask = async (taskId: string, columnId: string) => {
    await handleAddExistingTask(taskId, columnId);
    setAddPickerOpenFor(null);
    setAddPickerQuery("");
  };

  // Keyboard shortcuts + cross-component events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("board-search") as HTMLInputElement | null;
        input?.focus();
      }
    };
    const onSearch = (e: Event) => {
      const ce = e as unknown as CustomEvent<string>;
      setSearchQuery(ce.detail ?? "");
    };
    const onRefresh = async () => {
      await handleRefresh();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("board:search" as any, onSearch as any);
    window.addEventListener("board:refresh" as any, onRefresh as any);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("board:search" as any, onSearch as any);
      window.removeEventListener("board:refresh" as any, onRefresh as any);
    };
  }, []);

  // When we want to spotlight a task, auto-scroll horizontally to reveal it
  useEffect(() => {
    if (!highlightTaskId) return;
    const node = taskRefs.current.get(highlightTaskId);
    const container = scrollContainerRef.current;
    if (node && container) {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const scrollPadding = 100;
      if (nodeRect.left < containerRect.left || nodeRect.right > containerRect.right) {
        const targetScrollLeft = (node as any).offsetLeft - scrollPadding;
        container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      }
      setTimeout(() => {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [highlightTaskId]);

  // Display name differs by viewMode
  const getTaskDisplayName = (task: TaskSummary) => {
    if (viewMode === "production") {
      return task.ynmxId || `${task.customerName} - ${task.representative}`;
    }
    return `${task.customerName} - ${task.representative}`;
  };

  // Sort helpers (date-forward)
  const sortTaskIds = useCallback((ids: string[], taskMap: Record<string, TaskSummary>) => {
    return [...ids].sort((a, b) => {
      const ta = taskMap[a];
      const tb = taskMap[b];
      const hasDa = ta?.deliveryDate;
      const hasDb = tb?.deliveryDate;
      if (hasDa && !hasDb) return -1;
      if (!hasDa && hasDb) return 1;
      if (hasDa && hasDb) {
        return (ta.deliveryDate || "").localeCompare(tb.deliveryDate || "");
      }
      return (ta?.inquiryDate || "").localeCompare(tb?.inquiryDate || "");
    });
  }, []);

  const sortColumnsData = useCallback(
    (cols: Column[], taskMap: Record<string, TaskSummary>) => {
      return cols.map((c) => ({
        ...c,
        taskIds: sortTaskIds(c.taskIds, taskMap),
        pendingTaskIds: sortTaskIds(c.pendingTaskIds, taskMap),
      }));
    },
    [sortTaskIds]
  );

  // Merge saved columns with base skeleton (guards against missing ids)
  const mergeWithSkeleton = (saved: Column[]): Column[] => {
    const savedColumnsMap = new Map(saved.map((c) => [c.id, c]));
    return baseColumns.map((baseCol) => {
      const savedCol = savedColumnsMap.get(baseCol.id);
      return {
        ...baseCol,
        ...savedCol,
        taskIds: savedCol?.taskIds || [],
        pendingTaskIds: savedCol?.pendingTaskIds || [],
      };
    });
  };

  // Persist board (coalesces rapid updates)
  const saveBoard = async (nextBoard: BoardData) => {
    pendingBoardRef.current = nextBoard;
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      while (pendingBoardRef.current) {
        const board = pendingBoardRef.current;
        pendingBoardRef.current = null;
        await fetch("/api/jobs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(board),
        });
      }
      await fetchBoardFull(true);
    } catch (err) {
      console.error("保存看板失败", err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Light fetch (summary)
  const fetchBoardSummary = useCallback(async (force = false) => {
    if (isSavingRef.current && !force) return;
    try {
      const res = await fetch("/api/jobs?summary=1");
      if (res.ok) {
        const data: BoardSummaryData = await res.json();
        const tasksData = data.tasks || {};
        let merged = mergeWithSkeleton(data.columns || []);
        const colIds = new Set(merged.map((c) => c.id));
        const startCol = merged.find((c) => c.id === START_COLUMN_ID) || merged[0];
        for (const [id, t] of Object.entries(tasksData)) {
          if (!colIds.has(t.columnId)) {
            t.columnId = START_COLUMN_ID;
            if (!startCol.taskIds.includes(id)) startCol.taskIds.push(id);
          }
        }
        setTasks(tasksData);
        merged = sortColumnsData(merged, tasksData);
        setColumns(merged);
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置");
      setTasks({});
      setColumns(baseColumns);
    }
  }, []);

  // Full fetch (tasks + columns)
  const fetchBoardFull = useCallback(async (force = false) => {
    if (isSavingRef.current && !force) return;
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data: BoardData = await res.json();
        const tasksData = data.tasks || {};
        let merged = mergeWithSkeleton(data.columns || []);
        const colIds = new Set(merged.map((c) => c.id));
        const startCol = merged.find((c) => c.id === START_COLUMN_ID) || merged[0];
        for (const [id, t] of Object.entries(tasksData)) {
          if (!colIds.has(t.columnId)) {
            t.columnId = START_COLUMN_ID;
            if (!startCol.taskIds.includes(id)) startCol.taskIds.push(id);
          }
        }
        setTasks(tasksData);
        merged = sortColumnsData(merged, tasksData);
        setColumns(merged);
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置");
      setTasks({});
      setColumns(baseColumns);
    }
  }, []);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      window.dispatchEvent(new CustomEvent("board:refreshing", { detail: true }));
    } catch {}
    await Promise.all([fetchBoardSummary(true).then(() => fetchBoardFull(true)), new Promise((r) => setTimeout(r, 500))]);
    setIsRefreshing(false);
    try {
      window.dispatchEvent(new CustomEvent("board:refreshing", { detail: false }));
    } catch {}
  };

  // Initial data load + polling
  useEffect(() => {
    fetchBoardSummary();
    fetchBoardFull();
    const interval = setInterval(fetchBoardFull, 10000);
    return () => clearInterval(interval);
  }, [fetchBoardSummary, fetchBoardFull]);

  // Read user for attribution
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUserName(u.name || "");
      } catch {}
    }
  }, []);

  // When an individual task is saved, keep UI in sync
  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    const withTime = {
      ...updatedTask,
      updatedAt: updatedTask.updatedAt || new Date().toISOString(),
    };
    setTasks((prev) => {
      const next = { ...prev, [withTime.id]: withTime };
      setColumns((c) => sortColumnsData(c, next));
      return next;
    });
    setSelectedTask(withTime);
  }, []);

  // Deleting a task (from modal)
  const handleTaskDeleted = useCallback(
    async (taskId: string) => {
      setTasks((prev) => {
        const t = { ...prev };
        delete t[taskId];
        setColumns((c) =>
          sortColumnsData(
            c.map((col) => ({
              ...col,
              taskIds: col.taskIds.filter((id) => id !== taskId),
              pendingTaskIds: col.pendingTaskIds.filter((id) => id !== taskId),
            })),
            t
          )
        );
        return t;
      });
      setSelectedTask(null);
      setIsModalOpen(false);
      await fetchBoardFull();
    },
    [fetchBoardFull]
  );

  // Drag + Drop: start
  const handleDragStart = (e: React.DragEvent, task: TaskSummary) => {
    setDraggedTask(task);
    setHighlightTaskId(task.id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const dragImage = e.currentTarget as HTMLElement;
      const clone = dragImage.cloneNode(true) as HTMLElement;
      clone.style.opacity = "0.5";
      clone.style.position = "absolute";
      clone.style.top = "-1000px";
      document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 0, 0);
      setTimeout(() => document.body.removeChild(clone), 0);
    }
  };

  // Drag + Drop: end
  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
    setDropIndicatorIndex(null);
  };

  // Allow drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  };

  // Drag over a given task index
  const handleDragOverTask = (e: React.DragEvent, index: number, columnId: string) => {
    e.preventDefault();
    if (!draggedTask) return;
    const taskElement = e.currentTarget as HTMLElement;
    const rect = taskElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    setDropIndicatorIndex(y < height / 2 ? index : index + 1);
    setDragOverColumn(columnId);
  };

  // Enter column
  const handleDragEnterColumn = (columnId: string) => {
    if (draggedTask) setDragOverColumn(columnId);
  };

  // Leave column
  const handleDragLeaveColumn = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropIndicatorIndex(null);
    }
  };

  // Drop logic (reorder + move + archive)
  const handleDrop = async (e: React.DragEvent, targetColumnId: string, dropIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTask || !columns.some((c) => c.id === targetColumnId)) {
      setDragOverColumn(null);
      setDropIndicatorIndex(null);
      return;
    }
    const sourceColumnId = draggedTask.columnId;
    const isArchive = targetColumnId === ARCHIVE_COLUMN_ID || targetColumnId === "archive2";

    if (sourceColumnId === targetColumnId) {
      if (dropIndex === undefined) {
        setDragOverColumn(null);
        setDropIndicatorIndex(null);
        return;
      }
      const col = columns.find((c) => c.id === sourceColumnId)!;
      const newTaskIds = [...col.taskIds];
      const fromIndex = newTaskIds.indexOf(draggedTask.id);
      if (fromIndex !== -1) newTaskIds.splice(fromIndex, 1);
      newTaskIds.splice(dropIndex, 0, draggedTask.id);
      const nextColumns = sortColumnsData(
        columns.map((c) => (c.id === sourceColumnId ? { ...c, taskIds: newTaskIds } : c)),
        tasks as any
      );
      setColumns(nextColumns);
      setDragOverColumn(null);
      setDropIndicatorIndex(null);
      await saveBoard({ tasks: tasks as any, columns: nextColumns });
      return;
    }

    const existingTask = tasks[draggedTask.id] as Task;
    const moveTime = new Date().toISOString();
    let updatedTask: Task = {
      ...existingTask,
      ...draggedTask,
      columnId: targetColumnId,
      previousColumnId: sourceColumnId,
      deliveryNoteGenerated: draggedTask.deliveryNoteGenerated,
      awaitingAcceptance: !isArchive,
      updatedAt: moveTime,
      updatedBy: userName,
      history: [
        ...(existingTask?.history || []),
        { user: userName, timestamp: moveTime, description: `移动到${columns.find((c) => c.id === targetColumnId)?.title || ""}` },
      ],
    };
    if (targetColumnId === "ship") {
      try {
        const res = await fetch(`/api/jobs/${draggedTask.id}/delivery-note`, { method: "POST" });
        if (res.ok) updatedTask.deliveryNoteGenerated = true;
      } catch (err) {
        console.error("生成出货单失败", err);
      }
    }

    const nextTasks = { ...tasks };
    if (isArchive) {
      delete nextTasks[draggedTask.id];
    } else {
      nextTasks[draggedTask.id] = updatedTask;
    }

    let nextColumns = columns.map((col) => {
      if (col.id === sourceColumnId) {
        return { ...col, taskIds: col.taskIds.filter((id) => id !== draggedTask.id) };
      }
      if (col.id === targetColumnId) {
        if (isArchive) return col;
        return { ...col, pendingTaskIds: [draggedTask.id, ...col.pendingTaskIds] };
      }
      return col;
    });

    nextColumns = sortColumnsData(nextColumns, nextTasks as any);
    setTasks(nextTasks);
    setColumns(nextColumns);
    setHighlightTaskId(isArchive ? null : draggedTask.id);
    if (isArchive) taskRefs.current.delete(draggedTask.id);
    setDragOverColumn(null);
    setDropIndicatorIndex(null);

    if (!isArchive) {
      const colTitle = columns.find((c) => c.id === targetColumnId)?.title || "";
      setHandoffToast({ message: `已移交到「${colTitle}」，由该环节负责人处理` });
      setHandoffToastVisible(true);
      setOpenPending((prev) => ({ ...prev, [targetColumnId]: true }));
      setTimeout(() => setOpenPending((prev) => ({ ...prev, [targetColumnId]: false })), 1600);
      setTimeout(() => setHandoffToastVisible(false), 2200);
      setTimeout(() => setHandoffToast(null), 2600);
    }
    await saveBoard({ tasks: nextTasks as any, columns: nextColumns });
  };

  // Toggle "pending" drawer
  const togglePending = (columnId: string) => {
    setOpenPending((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  // Accept task from pending area
  const handleAcceptTask = async (taskId: string, columnId: string) => {
    const task = tasks[taskId];
    if (!task) return;
    const time = new Date().toISOString();
    const nextTasks = {
      ...tasks,
      [taskId]: {
        ...task,
        awaitingAcceptance: false,
        previousColumnId: undefined,
        updatedAt: time,
        updatedBy: userName,
        history: [
          ...(task.history || []),
          { user: userName, timestamp: time, description: `确认进入${columns.find((c) => c.id === columnId)?.title || ""}` },
        ],
      },
    };
    let nextColumns = columns.map((col) => {
      if (col.id === columnId) {
        return {
          ...col,
          pendingTaskIds: col.pendingTaskIds.filter((id) => id !== taskId),
          taskIds: [taskId, ...col.taskIds],
        };
      }
      return col;
    });
    nextColumns = sortColumnsData(nextColumns, nextTasks as any);
    setTasks(nextTasks);
    setColumns(nextColumns);
    await saveBoard({ tasks: nextTasks as any, columns: nextColumns });
  };

  // Decline task from pending area
  const handleDeclineTask = async (taskId: string, _columnId: string) => {
    if (!tasks[taskId]) return;
    const nextTasks = { ...tasks };
    delete nextTasks[taskId];
    let nextColumns = columns.map((col) => ({
      ...col,
      taskIds: col.taskIds.filter((id) => id !== taskId),
      pendingTaskIds: col.pendingTaskIds.filter((id) => id !== taskId),
    }));
    nextColumns = sortColumnsData(nextColumns, nextTasks as any);
    setTasks(nextTasks);
    setColumns(nextColumns);
    await saveBoard({ tasks: nextTasks as any, columns: nextColumns });
  };

  // Tiny animations for accept/decline click
  const animateAcceptPending = async (taskId: string, columnId: string) => {
    setAcceptingPending((prev) => ({ ...prev, [taskId]: true }));
    setTimeout(async () => {
      await handleAcceptTask(taskId, columnId);
      setAcceptingPending((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 160);
  };

  const animateDeclinePending = async (taskId: string, columnId: string) => {
    setDecliningPending((prev) => ({ ...prev, [taskId]: true }));
    setTimeout(async () => {
      await handleDeclineTask(taskId, columnId);
      setDecliningPending((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 160);
  };

  // New job created from CreateJobForm
  const handleJobCreated = (newTask: Task) => {
    setTasks((prev) => {
      const next = { ...prev, [newTask.id]: newTask };
      setColumns((c) =>
        sortColumnsData(
          c.map((col) =>
            col.id === START_COLUMN_ID
              ? { ...col, taskIds: [...col.taskIds, newTask.id], pendingTaskIds: col.pendingTaskIds }
              : col
          ),
          next as any
        )
      );
      return next;
    });
  };

  // Open task modal
  const handleTaskClick = async (task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const column = columns.find((c) => c.id === task.columnId);
    setSelectedTaskColumnTitle(column ? column.title : null);
    try {
      const res = await fetch(`/api/jobs/${task.id}`);
      if (res.ok) {
        const full: Task = await res.json();
        setSelectedTask(full);
      } else {
        setSelectedTask(task);
      }
    } catch {
      setSelectedTask(task);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedTask(null);
      setSelectedTaskColumnTitle(null);
    }, 300);
  };

  // Which columns are shown in production vs business mode
  const visibleColumns = useMemo(() => {
    if (viewMode === "production") {
      return columns.filter((c) =>
        ["approval", "outsourcing", "daohe", "program", "operate", "manual", "batch", "surface", "inspect", "ship", "archive2"].includes(
          c.id
        )
      );
    }
    return columns;
  }, [viewMode, columns]);

  /* ──────────────────────────────────────────────────────────────────────────
     RENDER
     - Prevent body scroll; board horizontally scrolls inside.
     - Add pb-16 to avoid overlap with the fixed mini-map.
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="h-screen w-full flex flex-col text-gray-900 overflow-hidden bg-[#F4F5F7] pb-16">
      {/* Toast (handoff feedback) */}
      {handoffToast && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 z-50">
          <div
            className={`rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm transition-all duration-500 ${
              handoffToastVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
            }`}
          >
            {handoffToast.message}
          </div>
        </div>
      )}

      {/* Horizontal board scroller (this is what MiniMapNav controls) */}
      <div
        ref={scrollContainerRef}
        className="board-scroll flex-1 min-h-0 flex gap-4 overflow-x-auto overflow-y-hidden p-6 [scrollbar-gutter:stable] scroll-smooth overscroll-x-contain"
      >
        {viewMode === "business" && !isRefreshing && <CreateJobForm onJobCreated={handleJobCreated} />}

        {isRefreshing ? (
          <>
            {visibleColumns.map((column) => (
              <ColumnSkeleton key={column.id} title={column.title} />
            ))}
          </>
        ) : (
          visibleColumns.map((column) => {
            const columnTasks = column.taskIds
              .map((id) => tasks[id])
              .filter(Boolean)
              .filter((t) => doesTaskMatchQuery(t as any, searchQuery));
            const pendingTasks = column.pendingTaskIds.map((id) => tasks[id]).filter(Boolean);
            const isArchive = ["archive", "archive2"].includes(column.id);

            return (
              <div
                data-col-id={column.id} // ← for MiniMapNav measurement
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnterColumn(column.id)}
                onDragLeave={handleDragLeaveColumn}
                onDrop={(e) => handleDrop(e, column.id, dropIndicatorIndex ?? undefined)}
                className="relative flex-shrink-0 w-80 flex flex-col rounded-md border border-gray-200 bg-gray-50 overflow-hidden min-h-0"
              >
                {/* Column Header */}
                <div className="relative z-10 bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
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
                        className="text-[11px] px-2 py-0.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition"
                        title="待接受"
                      >
                        待接受 {pendingTasks.length}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setAddPickerQuery("");
                        setAddPickerOpenFor((prev) => (prev === column.id ? null : column.id));
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                      aria-label="添加现有任务"
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-[11px] font-medium text-gray-700 bg-white px-2 py-0.5 rounded-full border border-gray-300">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Column body (vertical scroll) */}
                <div className="flex-1 overflow-y-auto p-3 pb-6 space-y-2 [scrollbar-gutter:stable] scroll-smooth overscroll-y-contain">
                  <div className="pointer-events-none sticky top-0 z-0 -mt-3 h-3 bg-gradient-to-b from-gray-50 to-transparent" />
                  {addPickerOpenFor === column.id && (
                    <div className="mb-3 rounded-md border border-gray-200 bg-white p-2 shadow-sm">
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
                          className="p-1 rounded hover:bg-gray-100"
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
                            .filter((t) => {
                              if (q === "") return true;
                              const text = `${t.customerName} ${t.representative} ${t.ynmxId || ""} ${t.notes || ""}`.toLowerCase();
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
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {(t as any).customerName}{" "}
                                    <span className="text-gray-500">· {(t as any).representative}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {(t as any).ynmxId && <span className="truncate">{(t as any).ynmxId}</span>}
                                    {col && (
                                      <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                                        {col.title}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {openPending[column.id] && pendingTasks.length > 0 && (
                    <div className="mb-3 rounded-md border border-gray-200 bg-white p-2 shadow-sm">
                      <div className="flex items-center justify-between px-1 pb-2">
                        <div className="text-[11px] font-medium text-gray-700">待接受</div>
                        <button
                          className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100"
                          onClick={() => setOpenPending((prev) => ({ ...prev, [column.id]: !prev[column.id] }))}
                        >
                          收起
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {pendingTasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-md border border-yellow-200 bg-yellow-50 p-2.5 cursor-pointer transition-all duration-200"
                            onClick={(e) => handleTaskClick(task as Task, e)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                  {getTaskDisplayName(task)}
                                </h3>
                                <p className="text-xs text-gray-600">{task.representative}</p>
                              </div>
                              <div className="flex gap-1 ml-2 flex-shrink-0">
                                <button
                                  className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    animateAcceptPending(task.id, column.id);
                                  }}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
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
                        ))}
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
                      <div key={task.id} className="relative">
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
                              onDragStart: (e) => handleDragStart(e, task as any),
                              onDragEnd: handleDragEnd,
                              onDragOver: (e) => handleDragOverTask(e, index, column.id),
                            }}
                          />
                        </div>
                        {dragOverColumn === column.id && dropIndicatorIndex === index + 1 && (
                          <div className="h-0.5 bg-blue-500 rounded-full mt-2 animate-pulse" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <TaskModal
        open={isModalOpen}
        task={selectedTask}
        columnTitle={selectedTaskColumnTitle}
        viewMode={viewMode}
        userName={userName}
        onOpenChange={(o) => !o && closeModal()}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />

      {/* ALWAYS visible Jira-style mini map (bottom-right fixed) */}
      <MiniMapNav containerRef={scrollContainerRef} />

      <style jsx global>{`
        .board-scroll {
          scrollbar-gutter: stable both-edges;
        }
      `}</style>
    </div>
  );
}
