"use client"

import type React from "react"
import type { Task, TaskSummary, Column, BoardData, BoardSummaryData } from "@/types"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import CreateJobForm from "@/components/CreateJobForm"
import { Card } from "@/components/ui/card"
import { Archive, Search, Lock, X, ChevronRight, RotateCw, Move, CalendarDays, Check, Plus, Clock } from "lucide-react"
import { baseColumns, START_COLUMN_ID, ARCHIVE_COLUMN_ID } from "@/lib/baseColumns"
import KanbanDrawer from "@/components/KanbanDrawer"
import AccountButton from "@/components/AccountButton"
import { formatTimeAgo } from "@/lib/utils"

// Skeleton component
const TaskSkeleton = () => (
  <div className="relative bg-white border border-gray-200 rounded-lg p-3 animate-pulse">
    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 rounded-l-lg" />
    <div className="pl-2">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  </div>
)

const ColumnSkeleton = ({ title }: { title: string }) => (
  <div className="flex-shrink-0 w-80 h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200/50">
    <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">{title}</h2>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full animate-pulse">
          <div className="h-3 w-4 bg-gray-200 rounded" />
        </span>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-3 min-h-0">
      <div className="space-y-2">
        <TaskSkeleton />
        <TaskSkeleton />
        <TaskSkeleton />
      </div>
    </div>
  </div>
)

export default function KanbanBoard() {
  const restricted = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('restricted') === '1'

  const [tasks, setTasks] = useState<Record<string, TaskSummary & Partial<Task>>>(
    {},
  )
  const [columns, setColumns] = useState<Column[]>(baseColumns)
  const [viewMode, setViewMode] = useState<'business' | 'production'>(
    restricted ? 'production' : 'business',
  )
  const [draggedTask, setDraggedTask] = useState<(TaskSummary & Partial<Task>) | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchStartDate, setSearchStartDate] = useState("")
  const [searchEndDate, setSearchEndDate] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSearchResult, setSelectedSearchResult] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [openPending, setOpenPending] = useState<Record<string, boolean>>({})
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null)

  const columnColors: Record<string, string> = {
    create: 'bg-blue-500',
    quote: 'bg-purple-500',
    send: 'bg-teal-500',
    sheet: 'bg-orange-500',
    approval: 'bg-yellow-500',
    outsourcing: 'bg-sky-500',
    daohe: 'bg-emerald-500',
    program: 'bg-indigo-500',
    operate: 'bg-cyan-500',
    manual: 'bg-pink-500',
    batch: 'bg-fuchsia-500',
    surface: 'bg-rose-500',
    inspect: 'bg-lime-500',
    ship: 'bg-green-500',
    archive: 'bg-gray-400',
    archive2: 'bg-gray-400',
  }

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null)
  const taskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchStartDateInputRef = useRef<HTMLInputElement>(null)
  const searchEndDateInputRef = useRef<HTMLInputElement>(null)
  const openSearchDatePicker = (
    ref: React.RefObject<HTMLInputElement | null>,
  ) => {
    const input = ref.current
    if (!input) return
    if ((input as any).showPicker) {
      (input as any).showPicker()
    } else {
      input.focus()
      input.click()
    }
  }
  const isSavingRef = useRef(false)
  const pendingBoardRef = useRef<BoardData | null>(null)

  // Search functionality
  const searchResults = useMemo(() => {
    const hasQuery = searchQuery.trim() !== ''
    const hasStart = searchStartDate.trim() !== ''
    const hasEnd = searchEndDate.trim() !== ''
    if (!hasQuery && !hasStart && !hasEnd) return []

    const query = searchQuery.toLowerCase()
    return Object.values(tasks)
      .filter(task => {
        if (task.columnId === ARCHIVE_COLUMN_ID || task.columnId === 'archive2') return false
        const text = `${task.customerName} ${task.representative} ${task.ynmxId || ''} ${task.notes || ''}`.toLowerCase()
        const matchesQuery = hasQuery ? text.includes(query) : true
        let matchesDate = true
        if (hasStart && hasEnd) {
          matchesDate = (task.deliveryDate || '') >= searchStartDate && (task.deliveryDate || '') <= searchEndDate
        } else if (hasStart) {
          matchesDate = (task.deliveryDate || '') >= searchStartDate
        } else if (hasEnd) {
          matchesDate = (task.deliveryDate || '') <= searchEndDate
        }
        return matchesQuery && matchesDate
      })
      .map(task => {
        const column = columns.find(col => col.id === task.columnId)
        return { task, column }
      })
  }, [tasks, columns, searchQuery, searchStartDate, searchEndDate])

  const handleAddExistingTask = async (taskId: string, columnId: string) => {
    const original = tasks[taskId]
    if (!original) return
    const newId = `${taskId}-${Date.now()}`
    const newTask: TaskSummary & Partial<Task> = {
      ...original,
      id: newId,
      columnId,
      awaitingAcceptance: false,
      previousColumnId: undefined,
      updatedAt: new Date().toISOString(),
    }
    const nextTasks = { ...tasks, [newId]: newTask }
    let nextColumns = columns.map(col =>
      col.id === columnId ? { ...col, taskIds: [newId, ...col.taskIds] } : col
    )
    nextColumns = sortColumnsData(nextColumns, nextTasks)
    setTasks(nextTasks)
    setColumns(nextColumns)
    await saveBoard({ tasks: nextTasks, columns: nextColumns })
  }

  const handleSearchResultClick = (taskId: string) => {
    if (addingColumnId) {
      handleAddExistingTask(taskId, addingColumnId)
      setAddingColumnId(null)
      setIsSearchOpen(false)
      setSearchQuery("")
      setSearchStartDate("")
      setSearchEndDate("")
      return
    }

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
        setSearchStartDate("")
        setSearchEndDate("")
        setSelectedSearchResult(null)
        setAddingColumnId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  useEffect(() => {
    if (!highlightTaskId) return
    const node = taskRefs.current.get(highlightTaskId)
    const container = scrollContainerRef.current
    if (node && container) {
      const containerRect = container.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const scrollPadding = 100
      if (nodeRect.left < containerRect.left || nodeRect.right > containerRect.right) {
        const targetScrollLeft = node.offsetLeft - scrollPadding
        container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' })
      }
      setTimeout(() => {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [highlightTaskId])

  const getNextYnmxId = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    const random = Math.floor(1000 + Math.random() * 9000)
    return `YNMX-${today}-${random}`
  }, [])

  const getTaskDisplayName = (task: TaskSummary) => {
    if (viewMode === 'production') {
      return task.ynmxId || `${task.customerName} - ${task.representative}`
    }
    return `${task.customerName} - ${task.representative}`
  }

  const sortTaskIds = useCallback(
    (ids: string[], taskMap: Record<string, TaskSummary>) => {
      return [...ids].sort((a, b) => {
        const ta = taskMap[a]
        const tb = taskMap[b]
        const hasDa = ta?.deliveryDate
        const hasDb = tb?.deliveryDate
        if (hasDa && !hasDb) return -1
        if (!hasDa && hasDb) return 1
        if (hasDa && hasDb) {
          return (ta.deliveryDate || '').localeCompare(tb.deliveryDate || '')
        }
        return (ta?.inquiryDate || '').localeCompare(tb?.inquiryDate || '')
      })
    },
    []
  )

  const sortColumnsData = useCallback(
    (cols: Column[], taskMap: Record<string, TaskSummary>) => {
      return cols.map((c) => ({
        ...c,
        taskIds: sortTaskIds(c.taskIds, taskMap),
        pendingTaskIds: sortTaskIds(c.pendingTaskIds, taskMap),
      }))
    },
    [sortTaskIds]
  )

  const mergeWithSkeleton = (saved: Column[]): Column[] => {
    const savedColumnsMap = new Map(saved.map((c) => [c.id, c]))
    return baseColumns.map(baseCol => {
      const savedCol = savedColumnsMap.get(baseCol.id)
      return {
        ...baseCol,
        ...savedCol,
        taskIds: savedCol?.taskIds || [],
        pendingTaskIds: savedCol?.pendingTaskIds || [],
      }
    })
  }

  const saveBoard = async (nextBoard: BoardData) => {
    pendingBoardRef.current = nextBoard
    if (isSavingRef.current) return
    isSavingRef.current = true
    try {
      while (pendingBoardRef.current) {
        const board = pendingBoardRef.current
        pendingBoardRef.current = null
        await fetch('/api/jobs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(board),
        })
      }
      await fetchBoardFull(true)
    } catch (err) {
      console.error('保存看板失败', err)
    } finally {
      isSavingRef.current = false
    }
  }

  const fetchBoardSummary = useCallback(async (force = false) => {
    if (isSavingRef.current && !force) return
    try {
      const res = await fetch("/api/jobs?summary=1")
      if (res.ok) {
        const data: BoardSummaryData = await res.json()
        const tasksData = data.tasks || {}
        let merged = mergeWithSkeleton(data.columns || [])
        const colIds = new Set(merged.map(c => c.id))
        const startCol = merged.find(c => c.id === START_COLUMN_ID) || merged[0]
        for (const [id, t] of Object.entries(tasksData)) {
          if (!colIds.has(t.columnId)) {
            t.columnId = START_COLUMN_ID
            if (!startCol.taskIds.includes(id)) startCol.taskIds.push(id)
          }
        }
        setTasks(tasksData)
        merged = sortColumnsData(merged, tasksData)
        setColumns(merged)
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置")
      setTasks({})
      setColumns(baseColumns)
    }
  }, [])

  const fetchBoardFull = useCallback(async (force = false) => {
    if (isSavingRef.current && !force) return
    try {
      const res = await fetch("/api/jobs")
      if (res.ok) {
        const data: BoardData = await res.json()
        const tasksData = data.tasks || {}
        let merged = mergeWithSkeleton(data.columns || [])
        const colIds = new Set(merged.map(c => c.id))
        const startCol = merged.find(c => c.id === START_COLUMN_ID) || merged[0]
        for (const [id, t] of Object.entries(tasksData)) {
          if (!colIds.has(t.columnId)) {
            t.columnId = START_COLUMN_ID
            if (!startCol.taskIds.includes(id)) startCol.taskIds.push(id)
          }
        }
        setTasks(tasksData)
        merged = sortColumnsData(merged, tasksData)
        setColumns(merged)
      }
    } catch (e) {
      console.warn("metadata.json 不存在或无效，已重置")
      setTasks({})
      setColumns(baseColumns)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Add a minimum delay to show the skeleton UI
    await Promise.all([
      fetchBoardSummary(true).then(() => fetchBoardFull(true)),
      new Promise(resolve => setTimeout(resolve, 500))
    ])
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchBoardSummary()
    fetchBoardFull()
    const interval = setInterval(fetchBoardFull, 10000)
    return () => clearInterval(interval)
  }, [fetchBoardSummary, fetchBoardFull])

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    const withTime = {
      ...updatedTask,
      updatedAt: updatedTask.updatedAt || new Date().toISOString(),
    }
    setTasks(prev => {
      const next = { ...prev, [withTime.id]: withTime }
      setColumns(c => sortColumnsData(c, next))
      return next
    })
    setSelectedTask(withTime)
  }, [])

  const handleTaskDeleted = useCallback(
    async (taskId: string) => {
      setTasks(prev => {
        const t = { ...prev }
        delete t[taskId]
        setColumns(c =>
          sortColumnsData(
            c.map(col => ({
              ...col,
              taskIds: col.taskIds.filter(id => id !== taskId),
              pendingTaskIds: col.pendingTaskIds.filter(id => id !== taskId),
            })),
            t
          )
        )
        return t
      })
      setSelectedTask(null)
      setIsDrawerOpen(false)
      await fetchBoardFull()
    },
    [fetchBoardFull]
  )

  const handleDragStart = (e: React.DragEvent, task: TaskSummary) => {
    setDraggedTask(task)
    setHighlightTaskId(task.id)
    // Make the drag image semi-transparent
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      const dragImage = e.currentTarget as HTMLElement
      const clone = dragImage.cloneNode(true) as HTMLElement
      clone.style.opacity = '0.5'
      clone.style.position = 'absolute'
      clone.style.top = '-1000px'
      document.body.appendChild(clone)
      e.dataTransfer.setDragImage(clone, 0, 0)
      setTimeout(() => document.body.removeChild(clone), 0)
    }
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverColumn(null)
    setDropIndicatorIndex(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragOverTask = (e: React.DragEvent, index: number, columnId: string) => {
    e.preventDefault()
    if (!draggedTask) return

    const taskElement = e.currentTarget as HTMLElement
    const rect = taskElement.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    // Determine if we should show indicator above or below this task
    if (y < height / 2) {
      setDropIndicatorIndex(index)
    } else {
      setDropIndicatorIndex(index + 1)
    }
    setDragOverColumn(columnId)
  }

  const handleDragEnterColumn = (columnId: string) => {
    if (draggedTask) {
      setDragOverColumn(columnId)
    }
  }

  const handleDragLeaveColumn = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the column
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropIndicatorIndex(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetColumnId: string, dropIndex?: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedTask || !columns.some(c => c.id === targetColumnId)) {
      setDragOverColumn(null)
      setDropIndicatorIndex(null)
      return
    }

    const sourceColumnId = draggedTask.columnId
    const isArchive = targetColumnId === ARCHIVE_COLUMN_ID || targetColumnId === 'archive2'

    // Reordering within the same column
    if (sourceColumnId === targetColumnId) {
      if (dropIndex === undefined) {
        setDragOverColumn(null)
        setDropIndicatorIndex(null)
        return
      }
      const col = columns.find(c => c.id === sourceColumnId)!
      const newTaskIds = [...col.taskIds]
      const fromIndex = newTaskIds.indexOf(draggedTask.id)
      if (fromIndex !== -1) newTaskIds.splice(fromIndex, 1)
      newTaskIds.splice(dropIndex, 0, draggedTask.id)
      const nextColumns = sortColumnsData(
        columns.map(c => c.id === sourceColumnId ? { ...c, taskIds: newTaskIds } : c),
        tasks
      )
      setColumns(nextColumns)
      setDragOverColumn(null)
      setDropIndicatorIndex(null)
      await saveBoard({ tasks, columns: nextColumns })
      return
    }

    let updatedTask: Task = {
      ...draggedTask,
      columnId: targetColumnId,
      previousColumnId: sourceColumnId,
      deliveryNoteGenerated: draggedTask.deliveryNoteGenerated,
      awaitingAcceptance: !isArchive,
      updatedAt: new Date().toISOString(),
    }
    if (targetColumnId === 'sheet' && !draggedTask.ynmxId) {
      updatedTask = { ...updatedTask, ynmxId: getNextYnmxId() }
    }
    if (targetColumnId === 'ship') {
      try {
        const res = await fetch(`/api/jobs/${draggedTask.id}/delivery-note`, {
          method: 'POST',
        })
        if (res.ok) {
          updatedTask.deliveryNoteGenerated = true
        }
      } catch (err) {
        console.error('生成出货单失败', err)
      }
    }

    const nextTasks = { ...tasks }
    if (isArchive) {
      delete nextTasks[draggedTask.id]
    } else {
      nextTasks[draggedTask.id] = updatedTask
    }

    let nextColumns = columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, taskIds: col.taskIds.filter(id => id !== draggedTask.id) }
      }
      if (col.id === targetColumnId) {
        if (isArchive) return col
        return { ...col, pendingTaskIds: [draggedTask.id, ...col.pendingTaskIds] }
      }
      return col
    })

    nextColumns = sortColumnsData(nextColumns, nextTasks)
    setTasks(nextTasks)
    setColumns(nextColumns)
    setHighlightTaskId(isArchive ? null : draggedTask.id)
    if (isArchive) {
      taskRefs.current.delete(draggedTask.id)
    }
    setDragOverColumn(null)
    setDropIndicatorIndex(null)
    await saveBoard({ tasks: nextTasks, columns: nextColumns })
  }

  const togglePending = (columnId: string) => {
    setOpenPending(prev => ({ ...prev, [columnId]: !prev[columnId] }))
  }

  const handleAddTaskButton = (columnId: string) => {
    setAddingColumnId(columnId)
    setIsSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  const handleAcceptTask = async (taskId: string, columnId: string) => {
    const task = tasks[taskId]
    if (!task) return
    const nextTasks = {
      ...tasks,
      [taskId]: {
        ...task,
        awaitingAcceptance: false,
        previousColumnId: undefined,
        updatedAt: new Date().toISOString(),
      }
    }
    let nextColumns = columns.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          pendingTaskIds: col.pendingTaskIds.filter(id => id !== taskId),
          taskIds: [taskId, ...col.taskIds]
        }
      }
      return col
    })
    nextColumns = sortColumnsData(nextColumns, nextTasks)
    setTasks(nextTasks)
    setColumns(nextColumns)
    await saveBoard({ tasks: nextTasks, columns: nextColumns })
  }

  const handleDeclineTask = async (taskId: string, _columnId: string) => {
    if (!tasks[taskId]) return
    const nextTasks = { ...tasks }
    delete nextTasks[taskId]
    let nextColumns = columns.map(col => ({
      ...col,
      taskIds: col.taskIds.filter(id => id !== taskId),
      pendingTaskIds: col.pendingTaskIds.filter(id => id !== taskId)
    }))
    nextColumns = sortColumnsData(nextColumns, nextTasks)
    setTasks(nextTasks)
    setColumns(nextColumns)
    await saveBoard({ tasks: nextTasks, columns: nextColumns })
  }

  const handleJobCreated = (newTask: Task) => {
    setTasks(prev => {
      const next = { ...prev, [newTask.id]: newTask }
      setColumns(c =>
        sortColumnsData(
          c.map(col =>
            col.id === START_COLUMN_ID
              ? { ...col, taskIds: [...col.taskIds, newTask.id], pendingTaskIds: col.pendingTaskIds }
              : col
          ),
          next
        )
      )
      return next
    })
  }

  const handleTaskClick = async (task: Task, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const column = columns.find((c) => c.id === task.columnId)
    setSelectedTaskColumnTitle(column ? column.title : null)
    try {
      const res = await fetch(`/api/jobs/${task.id}`)
      if (res.ok) {
        const full: Task = await res.json()
        setSelectedTask(full)
      } else {
        setSelectedTask(task)
      }
    } catch {
      setSelectedTask(task)
    }
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
      return columns.filter(c => ['approval', 'outsourcing', 'daohe', 'program', 'operate', 'manual', 'batch', 'surface', 'inspect', 'ship', 'archive2'].includes(c.id))
    }
    return columns
  }, [viewMode, columns])

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 px-6 bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-gray-200/50 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Estara</h1>

            <button
              onClick={handleRefresh}
              className={`p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-all ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              disabled={isRefreshing}
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-2" />
            
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

            <AccountButton />
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
                  setSearchStartDate("")
                  setSearchEndDate("")
                  setSelectedSearchResult(null)
                  setAddingColumnId(null)
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
            <div className="flex gap-2 mt-3">
              <div className="relative flex-1">
                <input
                  readOnly
                  placeholder="开始交期"
                  value={searchStartDate}
                  onClick={() => openSearchDatePicker(searchStartDateInputRef)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg pr-9 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchStartDateInputRef}
                  type="date"
                  value={searchStartDate}
                  onChange={(e) => setSearchStartDate(e.target.value)}
                  className="sr-only"
                />
              </div>
              <div className="relative flex-1">
                <input
                  readOnly
                  placeholder="结束交期"
                  value={searchEndDate}
                  onClick={() => openSearchDatePicker(searchEndDateInputRef)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg pr-9 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchEndDateInputRef}
                  type="date"
                  value={searchEndDate}
                  onChange={(e) => setSearchEndDate(e.target.value)}
                  className="sr-only"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">如：海康 徐鹏</p>
          </div>
          
          <div className="overflow-y-auto h-[calc(100%-88px)]">
            {(searchQuery || searchStartDate || searchEndDate) && searchResults.length === 0 && (
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
          {viewMode === 'business' && !isRefreshing && (
            <CreateJobForm onJobCreated={handleJobCreated} />
          )}

          {isRefreshing ? (
            <>
              {viewMode === 'business' && (
                <div className="flex-shrink-0 w-80 h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200/50 animate-pulse">
                  <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="h-10 bg-gray-100 rounded-lg" />
                      <div className="h-10 bg-gray-100 rounded-lg" />
                      <div className="h-10 bg-gray-100 rounded-lg" />
                    </div>
                  </div>
                </div>
              )}
              {visibleColumns.map((column) => (
                <ColumnSkeleton key={column.id} title={column.title} />
              ))}
            </>
          ) : (
            visibleColumns.map((column) => {
              const columnTasks = column.taskIds.map(id => tasks[id]).filter(Boolean)
              const pendingTasks = column.pendingTaskIds.map(id => tasks[id]).filter(Boolean)
              const isArchive = ['archive', 'archive2'].includes(column.id)

              return (
                <div
                  key={column.id}
                  onDragOver={handleDragOver}
                  onDragEnter={() => handleDragEnterColumn(column.id)}
                  onDragLeave={handleDragLeaveColumn}
                  onDrop={(e) => handleDrop(e, column.id, dropIndicatorIndex ?? undefined)}
                  className={`flex-shrink-0 w-80 h-full flex flex-col bg-white rounded-xl shadow-sm border transition-all duration-200 ${
                    dragOverColumn === column.id 
                      ? 'border-blue-400 shadow-lg' 
                      : 'border-gray-200/50'
                  }`}
                >
                  <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isArchive && <Archive className="w-4 h-4 text-gray-400" />}
                        <h2 className="text-sm font-medium text-gray-700">{column.title}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingTasks.length > 0 && (
                          <button
                            onClick={() => togglePending(column.id)}
                            className="text-xs text-blue-600"
                          >
                            待接受({pendingTasks.length})
                          </button>
                        )}
                        <button
                          onClick={() => handleAddTaskButton(column.id)}
                          className="p-1 hover:bg-gray-100 rounded-md"
                        >
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {columnTasks.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 min-h-0">
                    {openPending[column.id] && pendingTasks.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {pendingTasks.map(task => (
                          <div
                            key={task.id}
                            className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 cursor-pointer"
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
                                  className="p-1 rounded bg-green-100 text-green-600"
                                  onClick={() => handleAcceptTask(task.id, column.id)}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-1 rounded bg-red-100 text-red-600"
                                  onClick={() => handleDeclineTask(task.id, column.id)}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {columnTasks.length === 0 ? (
                      <div 
                        className={`h-full flex items-center justify-center rounded-lg transition-all duration-200 ${
                          dragOverColumn === column.id 
                            ? 'bg-blue-50 border-2 border-dashed border-blue-300' 
                            : ''
                        }`}
                      >
                        <div className="text-center">
                          {isArchive ? (
                            <>
                              <Archive className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-xs text-gray-400">拖拽任务到此处归档</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">
                              {dragOverColumn === column.id ? '放置任务' : '暂无任务'}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 relative">
                        {/* Drop indicator at top */}
                        {dragOverColumn === column.id && dropIndicatorIndex === 0 && (
                          <div className="h-0.5 bg-blue-500 rounded-full -mt-1 mb-2 animate-pulse" />
                        )}
                        
                        {columnTasks.map((task, index) => (
                          <div key={task.id} className="relative">
                            <div
                              ref={(node) => {
                                if (node) taskRefs.current.set(task.id, node)
                                else taskRefs.current.delete(task.id)
                              }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleDragOverTask(e, index, column.id)}
                              onClick={(e) => handleTaskClick(task, e)}
                              className={`relative group bg-white border border-gray-200 rounded-lg p-3 cursor-move transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
                                selectedSearchResult === task.id
                                  ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md'
                                  : ''
                              } ${
                                highlightTaskId === task.id ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md' : ''
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
                                    <span className="flex items-center gap-1">
                                      交期: {task.deliveryDate}
                                      {task.deliveryDate < new Date().toISOString().slice(0, 10) && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">逾期</span>
                                      )}
                                    </span>
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
                              {task.updatedAt && (
                                <div className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[10px] text-gray-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTimeAgo(task.updatedAt)}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Drop indicator after this task */}
                            {dragOverColumn === column.id && dropIndicatorIndex === index + 1 && (
                              <div className="h-0.5 bg-blue-500 rounded-full mt-2 animate-pulse" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <KanbanDrawer
          isOpen={isDrawerOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          viewMode={viewMode}
          onClose={closeDrawer}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      </div>
    </div>
  )
}