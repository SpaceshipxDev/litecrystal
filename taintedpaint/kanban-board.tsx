"use client"

import type React from "react"
import type { Task, Column, BoardData } from "@/types"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import CreateJobForm from "@/components/CreateJobForm"
import { Card } from "@/components/ui/card"
import { Archive, Search, LayoutGrid, RotateCcw } from "lucide-react"
import Link from "next/link"
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns"
import KanbanDrawer from "@/components/KanbanDrawer"
import SearchDialog from "@/components/SearchDialog"

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [columns, setColumns] = useState<Column[]>(baseColumns)
  const [viewMode, setViewMode] = useState<'business' | 'production'>('business')
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const columnColors: Record<string, string> = {
    create: 'bg-blue-500',
    quote: 'bg-purple-500',
    send: 'bg-teal-500',
    sheet: 'bg-orange-500',
    approval: 'bg-yellow-500',
    program: 'bg-indigo-500',
    ship: 'bg-green-500',
    archive: 'bg-gray-400',
    archive2: 'bg-gray-400',
  }
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const taskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!highlightedTaskId) return;

    const node = taskRefs.current.get(highlightedTaskId);
    const container = scrollContainerRef.current;
    if (node && container) {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const scrollPadding = 60; 

      if (nodeRect.left < containerRect.left) {
        container.scrollTo({
          left: container.scrollLeft + nodeRect.left - containerRect.left - scrollPadding,
          behavior: 'smooth',
        });
      } else if (nodeRect.right > containerRect.right) {
        container.scrollTo({
          left: container.scrollLeft + nodeRect.right - containerRect.right + scrollPadding,
          behavior: 'smooth',
        });
      }

      node.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    const timer = setTimeout(() => {
      setHighlightedTaskId(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [highlightedTaskId]);

  const getNextYnmxId = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `YNMX-${today}-${random}`;
  }, []);

  const getTaskDisplayName = (task: Task) => {
    if (['sheet', 'approval', 'program', 'ship', 'archive2'].includes(task.columnId)) {
      return task.ynmxId || `${task.customerName} - ${task.representative}`;
    }
    return `${task.customerName} - ${task.representative}`;
  };

  const mergeWithSkeleton = (saved: Column[]): Column[] => {
    const savedColumnsMap = new Map(saved.map((c) => [c.id, c]));
    return baseColumns.map(
      (baseCol) => savedColumnsMap.get(baseCol.id) || baseCol
    );
  };

  const saveBoard = async (nextBoard: BoardData) => {
    try {
      await fetch("/api/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextBoard),
      });
    } catch (err) {
      console.error("保存看板失败", err);
    }
  };

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data: BoardData = await res.json();
        setTasks(data.tasks || {});
        setColumns(mergeWithSkeleton(data.columns || []));
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置");
      setTasks({});
      setColumns(baseColumns);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 10000);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  // This is the callback for the drawer. It updates the board's state.
  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setTasks((prev) => ({
      ...prev,
      [updatedTask.id]: updatedTask,
    }));
    setSelectedTask(updatedTask);
  }, []);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (columnId: string) => setDragOverColumn(columnId);
  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTask || draggedTask.columnId === targetColumnId) return;

    let updatedTask: Task = { ...draggedTask, columnId: targetColumnId };
    if (targetColumnId === 'sheet' && !draggedTask.ynmxId) {
      updatedTask = { ...updatedTask, ynmxId: getNextYnmxId() };
    }

    const nextTasks = {
      ...tasks,
      [draggedTask.id]: updatedTask,
    };

    const nextColumns = columns.map((col) => {
      if (col.id === draggedTask.columnId) {
        return {
          ...col,
          taskIds: col.taskIds.filter((id) => id !== draggedTask.id),
        };
      }
      if (col.id === targetColumnId) {
        return { ...col, taskIds: [...col.taskIds, draggedTask.id] };
      }
      return col;
    });

    setTasks(nextTasks);
    setColumns(nextColumns);
    saveBoard({ tasks: nextTasks, columns: nextColumns });
    setDraggedTask(null);
  };

  const handleJobCreated = (newTask: Task) => {
    setTasks((prev) => ({ ...prev, [newTask.id]: newTask }));
    setColumns((prev) =>
      prev.map((col) =>
        col.id === START_COLUMN_ID
          ? { ...col, taskIds: [...col.taskIds, newTask.id] }
          : col,
      ),
    );
  };

  const handleTaskClick = (task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.columnId === "archive" || task.columnId === "archive2") return;

    const column = columns.find((c) => c.id === task.columnId);
    setSelectedTaskColumnTitle(column ? column.title : null);
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    // Delay clearing task to allow for smooth exit animation
    setTimeout(() => {
      setSelectedTask(null);
      setSelectedTaskColumnTitle(null);
    }, 300);
  };

  const allTasksForSearch = useMemo(() => Object.values(tasks), [tasks]);
  const visibleColumns = useMemo(() => {
    if (viewMode === 'production') {
      return columns.filter(c => ['approval', 'program', 'ship', 'archive2'].includes(c.id))
    }
    return columns
  }, [viewMode, columns])

  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-gray-900 font-sans">
      <header className="px-6 py-4 bg-white/90 backdrop-blur-sm sticky top-0 z-30 border-b border-gray-200/80">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-medium text-gray-900 tracking-tight">Eldaline</h1>
            <span className="text-sm text-gray-500 font-normal">项目看板</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100/50 backdrop-blur-sm border border-gray-200/60 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('business')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'business' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
              >
                商务
              </button>
              <button
                onClick={() => setViewMode('production')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'production' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
              >
                生产
              </button>
            </div>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="group relative flex items-center justify-center gap-2.5 px-4 py-2.5
                        bg-gray-100/60 backdrop-blur-sm
                        border border-gray-200/60 hover:border-gray-300/80
                        rounded-md shadow-sm hover:shadow-md
                        transform-gpu transition-all duration-200 ease-out
                        hover:bg-white/80 active:scale-[0.96]"
            >
              <Search className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors duration-200" strokeWidth={2} />
              <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                搜索
              </span>
              <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-gray-300/60">
                <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-200/60 rounded border border-gray-300/40">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-200/60 rounded border border-gray-300/40">K</kbd>
              </div>
            </button>

            <button
              onClick={fetchBoard}
              className="group relative flex items-center justify-center px-3 py-2.5 bg-gray-100/60 backdrop-blur-sm border border-gray-200/60 hover:border-gray-300/80 rounded-md shadow-sm hover:shadow-md transform-gpu transition-all duration-200 ease-out hover:bg-white/80 active:scale-[0.96]"
            >
              <RotateCcw className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors duration-200" strokeWidth={2} />
            </button>
            <Link href="/holistic" className="group relative flex items-center justify-center gap-2.5 px-4 py-2.5 bg-gray-100/60 backdrop-blur-sm border border-gray-200/60 hover:border-gray-300/80 rounded-md shadow-sm hover:shadow-md transform-gpu transition-all duration-200 ease-out hover:bg-white/80 active:scale-[0.96]">
              <LayoutGrid className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors duration-200" strokeWidth={2} />
              <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-200">总揽</span>
            </Link>
          </div>
        </div>
      </header>
      
      <div className="relative flex-1 flex min-h-0">
        {isDrawerOpen && <div className="fixed inset-0 backdrop-blur-[2px] z-40" onClick={closeDrawer} />}

        <div
          ref={scrollContainerRef}
          className="flex-1 flex gap-4 overflow-x-auto p-4 transition-all duration-300 z-10"
        >
          {viewMode === 'business' && (
            <CreateJobForm onJobCreated={handleJobCreated} />
          )}

          {visibleColumns.map((column) => {
            const columnTasks = column.taskIds.map(id => tasks[id]).filter(Boolean);

            return ['archive', 'archive2'].includes(column.id) ? (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-72 flex flex-col rounded-lg transition-colors duration-200 ${
                  dragOverColumn === column.id ? 'bg-blue-50/50' : 'bg-white/70'
                }`}
              >
                <div className="p-4 border-b border-gray-200/80 sticky top-0 z-20 bg-white/80 backdrop-blur-sm rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
                    <h2 className="text-base font-semibold text-gray-800">{column.title}</h2>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pb-20">
                  {columnTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <Archive className="h-12 w-12 text-gray-400 mb-4" strokeWidth={1.2} />
                      <p className="text-sm font-medium text-gray-600 mb-1">{column.title}区域</p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        拖拽任务到此处{column.title}
                        <br />
                        归档的任务将被保存
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {columnTasks.map((task) => (
                        <Card
                          key={task.id}
                          ref={(node) => {
                            const map = taskRefs.current;
                            if (node) map.set(task.id, node);
                            else map.delete(task.id);
                          }}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onClick={(e) => handleTaskClick(task, e)}
                          className="relative p-3 cursor-pointer hover:shadow-md hover:-translate-y-px transform transition-all duration-200 border border-gray-200 bg-white group rounded-lg shadow-sm"
                        >
                          <div className={`absolute left-0 top-0 h-full w-1 rounded-l ${columnColors[task.columnId]}`} />
                          <div className="pl-4 pr-2">
                            <div className={`p-1 -m-1 rounded-md transition-colors duration-500 ${highlightedTaskId === task.id ? 'bg-yellow-200/70' : 'bg-transparent'}`}
                            >
                              <h3 className="text-sm font-medium text-gray-800 mb-1.5 leading-tight group-hover:text-gray-900 transition-colors">
                                {getTaskDisplayName(task)}
                              </h3>
                              <p className="text-xs text-gray-500 leading-relaxed">{task.orderDate}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-72 flex flex-col rounded-lg border border-gray-200/80 shadow-sm hover:shadow-md transform-gpu transition-all duration-300 bg-white/70 ${
                  dragOverColumn === column.id ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="p-4 border-b border-gray-200/80 sticky top-0 z-20 bg-white/80 backdrop-blur-sm rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-800">{column.title}</h2>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
                  {columnTasks.map((task) => (
                    <Card
                      key={task.id}
                      ref={(node) => {
                        const map = taskRefs.current;
                        if (node) map.set(task.id, node);
                        else map.delete(task.id);
                      }}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={(e) => handleTaskClick(task, e)}
                      className="relative p-3 cursor-pointer hover:shadow-md hover:-translate-y-px transform transition-all duration-200 border border-gray-200 bg-white group rounded-lg shadow-sm"
                    >
                      <div className={`absolute left-0 top-0 h-full w-1 rounded-l ${columnColors[task.columnId]}`} />
                      <div className="pl-4 pr-2">
                        <div className={`p-1 -m-1 rounded-md transition-colors duration-500 ${highlightedTaskId === task.id ? 'bg-yellow-200/70' : 'bg-transparent'}`}
                        >
                          <h3 className="text-sm font-medium text-gray-800 mb-1.5 leading-tight group-hover:text-gray-900 transition-colors">
                            {getTaskDisplayName(task)}
                          </h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{task.orderDate}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onTaskSelect={(task) => {
            setHighlightedTaskId(task.id);
          }}
        />

        <KanbanDrawer
          isOpen={isDrawerOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          onClose={closeDrawer}
          onTaskUpdated={handleTaskUpdated}
        />
      </div>
    </div>
  );
}