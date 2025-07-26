"use client"

import type React from "react"
import type { Task, Column, BoardData } from "@/types"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import CreateJobForm from "@/components/CreateJobForm"
import { Card } from "@/components/ui/card"
import { Archive, Search, LayoutGrid, Lock, X, ChevronRight } from "lucide-react"
import Link from "next/link"
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns"
import KanbanDrawer from "@/components/KanbanDrawer"

export default function KanbanBoard() {
  const restricted =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('restricted') === '1'

  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [columns, setColumns] = useState<Column[]>(baseColumns)
  const [viewMode, setViewMode] = useState<'business' | 'production'>(
    restricted ? 'production' : 'business',
  )
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSearchResult, setSelectedSearchResult] = useState<string | null>(null)

  const columnColors: Record<string, string> = {
    create: 'bg-blue-500',
    quote: 'bg-purple-500',
    send: 'bg-teal-500',
    sheet: 'bg-orange-500',
    approval: 'bg-yellow-500',
    outsourcing: 'bg-sky-500',
    program: 'bg-indigo-500',
    operate: 'bg-cyan-500',
    manual: 'bg-pink-500',
    surface: 'bg-rose-500',
    inspect: 'bg-lime-500',
    ship: 'bg-green-500',
    archive: 'bg-gray-400',
    archive2: 'bg-gray-400',
  }
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const taskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase()
    return Object.values(tasks).filter(task => {
      const searchableText = `${task.customerName} ${task.representative} ${task.ynmxId || ''} ${task.notes || ''}`.toLowerCase()
      return searchableText.includes(query)
    }).map(task => {
      const column = columns.find(col => col.id === task.columnId)
      return { task, column }
    })
  }, [tasks, columns, searchQuery])

  const handleSearchResultClick = (taskId: string) => {
    setSelectedSearchResult(taskId)
    const node = taskRefs.current.get(taskId)
    const container = scrollContainerRef.current
    
    if (node && container) {
      // Calculate scroll position
      const containerRect = container.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const scrollPadding = 100
      
      // Horizontal scroll
      if (nodeRect.left < containerRect.left || nodeRect.right > containerRect.right) {
        const targetScrollLeft = node.offsetLeft - scrollPadding
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        })
      }
      
      // Vertical scroll into view
      setTimeout(() => {
        node.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 300)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        setSearchQuery("")
        setSelectedSearchResult(null)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  const getNextYnmxId = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    const random = Math.floor(1000 + Math.random() * 9000)
    return `YNMX-${today}-${random}`
  }, [])

  const getTaskDisplayName = (task: Task) => {
    if (viewMode === 'production') {
      return task.ynmxId || `${task.customerName} - ${task.representative}`
    }
    return `${task.customerName} - ${task.representative}`
  }

  const mergeWithSkeleton = (saved: Column[]): Column[] => {
    const savedColumnsMap = new Map(saved.map((c) => [c.id, c]))
    return baseColumns.map(
      (baseCol) => savedColumnsMap.get(baseCol.id) || baseCol
    )
  }

  const saveBoard = async (nextBoard: BoardData) => {
    try {
      await fetch("/api/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextBoard),
      })
    } catch (err) {
      console.error("保存看板失败", err)
    }
  }

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs")
      if (res.ok) {
        const data: BoardData = await res.json()
        setTasks(data.tasks || {})
        setColumns(mergeWithSkeleton(data.columns || []))
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置")
      setTasks({})
      setColumns(baseColumns)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
    const interval = setInterval(fetchBoard, 10000)
    return () => clearInterval(interval)
  }, [fetchBoard])

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setTasks((prev) => ({
      ...prev,
      [updatedTask.id]: updatedTask,
    }))
    setSelectedTask(updatedTask)
  }, [])

  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDragEnter = (columnId: string) => setDragOverColumn(columnId)
  const handleDragLeave = () => setDragOverColumn(null)

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (!draggedTask || draggedTask.columnId === targetColumnId) return

    let updatedTask: Task = { ...draggedTask, columnId: targetColumnId }
    if (targetColumnId === 'sheet' && !draggedTask.ynmxId) {
      updatedTask = { ...updatedTask, ynmxId: getNextYnmxId() }
    }

    const nextTasks = {
      ...tasks,
      [draggedTask.id]: updatedTask,
    }

    const nextColumns = columns.map((col) => {
      if (col.id === draggedTask.columnId) {
        return {
          ...col,
          taskIds: col.taskIds.filter((id) => id !== draggedTask.id),
        }
      }
      if (col.id === targetColumnId) {
        return { ...col, taskIds: [...col.taskIds, draggedTask.id] }
      }
      return col
    })

    setTasks(nextTasks)
    setColumns(nextColumns)
    saveBoard({ tasks: nextTasks, columns: nextColumns })
    setDraggedTask(null)
  }

  const handleJobCreated = (newTask: Task) => {
    setTasks((prev) => ({ ...prev, [newTask.id]: newTask }))
    setColumns((prev) =>
      prev.map((col) =>
        col.id === START_COLUMN_ID
          ? { ...col, taskIds: [...col.taskIds, newTask.id] }
          : col,
      ),
    )
  }

  const handleTaskClick = (task: Task, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (task.columnId === "archive" || task.columnId === "archive2") return

    const column = columns.find((c) => c.id === task.columnId)
    setSelectedTaskColumnTitle(column ? column.title : null)
    setSelectedTask(task)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => {
      setSelectedTask(null)
      setSelectedTaskColumnTitle(null)
    }, 300)
  }

  const visibleColumns = useMemo(() => {
    if (viewMode === 'production') {
      return columns.filter(c => ['approval', 'outsourcing', 'program', 'operate', 'manual', 'surface', 'inspect', 'ship', 'archive2'].includes(c.id))
    }
    return columns
  }, [viewMode, columns])

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 px-6 bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-gray-200/50 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">Estara</h1>
            
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => !restricted && setViewMode('business')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'business' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${restricted ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={restricted}
              >
                {restricted && <Lock className="inline-block w-3 h-3 mr-1" />}
                商务
              </button>
              <button
                onClick={() => setViewMode('production')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'production' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                生产
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 100)
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              <Search className="w-4 h-4" />
              <span>搜索</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded">
                ⌘K
              </kbd>
            </button>

            {!restricted && (
              <Link 
                href="/holistic" 
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>总揽</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <div className="relative flex-1 flex overflow-hidden">
        {/* Search Sidebar */}
        <div className={`absolute top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl z-40 transition-all duration-300 ${
          isSearchOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900">搜索任务</h2>
              <button
                onClick={() => {
                  setIsSearchOpen(false)
                  setSearchQuery("")
                  setSelectedSearchResult(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索客户、负责人或ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-400">如：海康 徐鹏</p>
          </div>
          
          <div className="overflow-y-auto h-[calc(100%-88px)]">
            {searchQuery && searchResults.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                没有找到相关任务
              </div>
            )}
            
            {searchResults.map(({ task, column }) => (
              <button
                key={task.id}
                onClick={() => handleSearchResultClick(task.id)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedSearchResult === task.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-1 h-4 rounded-full ${columnColors[task.columnId]}`} />
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {task.customerName}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 mb-0.5">{task.representative}</p>
                    {task.ynmxId && (
                      <p className="text-xs text-gray-500">{task.ynmxId}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">{column?.title}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Backdrop */}
        {isDrawerOpen && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={closeDrawer} />
        )}

        {/* Main Board */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex gap-3 overflow-x-auto p-6 transition-all duration-300"
          style={{ marginLeft: isSearchOpen ? '320px' : '0' }}
        >
          {viewMode === 'business' && (
            <CreateJobForm onJobCreated={handleJobCreated} />
          )}

          {visibleColumns.map((column) => {
            const columnTasks = column.taskIds.map(id => tasks[id]).filter(Boolean)
            const isArchive = ['archive', 'archive2'].includes(column.id)

            return (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-80 h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200/50 transition-all duration-200 ${
                  dragOverColumn === column.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                }`}
              >
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isArchive && <Archive className="w-4 h-4 text-gray-400" />}
                      <h2 className="text-sm font-medium text-gray-700">{column.title}</h2>
                    </div>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 min-h-0">
                  {columnTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
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
                    <div className="space-y-2">
                      {columnTasks.map((task) => (
                        <div
                          key={task.id}
                          ref={(node) => {
                            if (node) taskRefs.current.set(task.id, node)
                            else taskRefs.current.delete(task.id)
                          }}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onClick={(e) => handleTaskClick(task, e)}
                          className={`relative group bg-white border border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
                            selectedSearchResult === task.id
                              ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md'
                              : ''
                          }`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${columnColors[task.columnId]} rounded-l-lg`} />
                          
                          <div className="pl-2">
                            {viewMode === 'business' ? (
                              <>
                                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                                  {task.customerName}
                                </h3>
                                <p className="text-xs text-gray-600">{task.representative}</p>
                                {task.ynmxId && (
                                  <p className="text-xs text-gray-500 mt-0.5">{task.ynmxId}</p>
                                )}
                              </>
                            ) : (
                              <h3 className="text-sm font-medium text-gray-900">
                                {getTaskDisplayName(task)}
                              </h3>
                            )}
                            
                            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                              {task.deliveryDate ? (
                                <span>交期: {task.deliveryDate}</span>
                              ) : (
                                <span>询价: {task.inquiryDate}</span>
                              )}
                            </div>
                            
                            {task.notes && (
                              <p className="mt-1 text-xs text-gray-400 truncate">
                                {task.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <KanbanDrawer
          isOpen={isDrawerOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          viewMode={viewMode}
          onClose={closeDrawer}
          onTaskUpdated={handleTaskUpdated}
        />
      </div>
    </div>
  )
}
