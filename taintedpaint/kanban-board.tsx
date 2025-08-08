"use client";

import type React from "react";
import type { Task, TaskSummary, Column, BoardData, BoardSummaryData } from "@/types";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CreateJobForm from "@/components/CreateJobForm";
import { baseColumns, START_COLUMN_ID, ARCHIVE_COLUMN_ID } from "@/lib/baseColumns";
import TaskModal from "@/components/TaskModal";
import { ColumnSkeleton } from "@/components/Skeletons";
import MiniMapNav from "@/components/MiniMapNav";
import KanbanColumn from "@/components/KanbanColumn";


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
                <KanbanColumn
                  key={column.id}
                  column={column}
                  columnTasks={columnTasks}
                  pendingTasks={pendingTasks}
                  isArchive={isArchive}
                  taskRefs={taskRefs}
                  viewMode={viewMode}
                  isRestricted={isRestricted}
                  searchQuery={searchQuery}
                  renderHighlighted={renderHighlighted}
                  highlightTaskId={highlightTaskId}
                  handleTaskClick={handleTaskClick}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleDragOverTask={handleDragOverTask}
                  handleDragOver={handleDragOver}
                  handleDragEnterColumn={handleDragEnterColumn}
                  handleDragLeaveColumn={handleDragLeaveColumn}
                  handleDrop={handleDrop}
                  dragOverColumn={dragOverColumn}
                  dropIndicatorIndex={dropIndicatorIndex}
                  addPickerOpenFor={addPickerOpenFor}
                  setAddPickerOpenFor={setAddPickerOpenFor}
                  addPickerQuery={addPickerQuery}
                  setAddPickerQuery={setAddPickerQuery}
                  handleSelectAddTask={handleSelectAddTask}
                  columns={columns}
                  tasks={tasks}
                  openPending={openPending}
                  setOpenPending={setOpenPending}
                  animateAcceptPending={animateAcceptPending}
                  animateDeclinePending={animateDeclinePending}
                  getTaskDisplayName={getTaskDisplayName}
                />
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
