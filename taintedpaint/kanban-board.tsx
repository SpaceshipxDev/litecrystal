"use client"

import type React from "react"
import type { Task, TaskSummary, Column, BoardData, BoardSummaryData } from "@/types"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import CreateJobForm from "@/components/CreateJobForm"
import { Archive, Lock, RotateCw, Check, Plus, Clock, Search, X } from "lucide-react"
import { baseColumns, START_COLUMN_ID, ARCHIVE_COLUMN_ID } from "@/lib/baseColumns"
import TaskModal from "@/components/TaskModal"
import AccountButton from "@/components/AccountButton"
import { formatTimeAgo } from "@/lib/utils"

// Skeleton component
  const TaskSkeleton = () => (
  <div className="apple-glass apple-border-light rounded-xl p-3 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3" />
  </div>
)

  const ColumnSkeleton = ({ title }: { title: string }) => (
  <div className="flex-shrink-0 w-96 h-full flex flex-col apple-glass rounded-2xl apple-shadow border apple-border-light">
    <div className="flex-shrink-0 px-4 py-3 border-b border-transparent">
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
  const [isNewOpen, setIsNewOpen] = useState(false)
  // Per-column add existing task picker state
  const [addPickerOpenFor, setAddPickerOpenFor] = useState<string | null>(null)
  const [addPickerQuery, setAddPickerQuery] = useState("")
  // Pending interaction animations
  const [acceptingPending, setAcceptingPending] = useState<Record<string, boolean>>({})
  const [decliningPending, setDecliningPending] = useState<Record<string, boolean>>({})
  // Transient handoff toast
  const [handoffToast, setHandoffToast] = useState<{ message: string } | null>(null)
  const [handoffToastVisible, setHandoffToastVisible] = useState(false)

  // Removed task color strips for a cleaner, more minimal design

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userName, setUserName] = useState("")
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
    const time = new Date().toISOString()
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
        { user: userName, timestamp: time, description: `复制到${columns.find(c => c.id === columnId)?.title || ''}` },
      ],
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

  const toggleAddPicker = (columnId: string) => {
    setAddPickerQuery("")
    setAddPickerOpenFor(prev => (prev === columnId ? null : columnId))
  }

  const handleSelectAddTask = async (taskId: string, columnId: string) => {
    await handleAddExistingTask(taskId, columnId)
    setAddPickerOpenFor(null)
    setAddPickerQuery("")
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

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setUserName(u.name || '')
      } catch {}
    }
  }, [])

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
      setIsModalOpen(false)
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

    const existingTask = tasks[draggedTask.id] as Task
    const moveTime = new Date().toISOString()
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
        { user: userName, timestamp: moveTime, description: `移动到${columns.find(c => c.id === targetColumnId)?.title || ''}` },
      ],
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
    // Show transient handoff toast and briefly expand pending, then auto-collapse
    if (!isArchive) {
      const colTitle = columns.find(c => c.id === targetColumnId)?.title || ''
      setHandoffToast({ message: `已移交到「${colTitle}」，由该环节负责人处理` })
      setHandoffToastVisible(true)
      setOpenPending(prev => ({ ...prev, [targetColumnId]: true }))
      setTimeout(() => {
        setOpenPending(prev => ({ ...prev, [targetColumnId]: false }))
      }, 1600)
      setTimeout(() => setHandoffToastVisible(false), 2200)
      setTimeout(() => setHandoffToast(null), 2600)
    }
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
    const time = new Date().toISOString()
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
          { user: userName, timestamp: time, description: `确认进入${columns.find(c => c.id === columnId)?.title || ''}` },
        ],
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

  const animateAcceptPending = async (taskId: string, columnId: string) => {
    setAcceptingPending(prev => ({ ...prev, [taskId]: true }))
    setTimeout(async () => {
      await handleAcceptTask(taskId, columnId)
      setAcceptingPending(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    }, 160)
  }

  const animateDeclinePending = async (taskId: string, columnId: string) => {
    setDecliningPending(prev => ({ ...prev, [taskId]: true }))
    setTimeout(async () => {
      await handleDeclineTask(taskId, columnId)
      setDecliningPending(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    }, 160)
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
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
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
    <div className="h-screen w-full flex flex-col text-gray-900 overflow-hidden">
      {/* Header moved to AppShell */}
      <header className="hidden">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Estara</h1>

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
            
            <div className="flex items-center bg-white/60 backdrop-blur rounded-xl p-0.5 border apple-border-light">
              <button
                onClick={() => !restricted && setViewMode('business')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'business' 
                    ? 'bg-white text-gray-900 apple-shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${restricted ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={restricted}
              >
                {restricted && <Lock className="inline-block w-3 h-3 mr-1" />}
                商务
              </button>
              <button
                onClick={() => setViewMode('production')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'production' 
                    ? 'bg-white text-gray-900 apple-shadow' 
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
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/70 apple-glass rounded-xl transition-all"
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
        {/* Board toolbar: refresh + view toggle + quick search */}
        <div className="absolute top-0 left-0 right-0 px-6 pt-4 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className={`p-1.5 text-gray-600 hover:text-gray-900 apple-glass rounded-md transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                disabled={isRefreshing}
                title="刷新"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center bg-white/60 backdrop-blur rounded-xl p-0.5 border apple-border-light">
                <button
                  onClick={() => !restricted && setViewMode('business')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'business' ? 'bg-white text-gray-900 apple-shadow' : 'text-gray-600 hover:text-gray-900'} ${restricted ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={restricted}
                >商务</button>
                <button
                  onClick={() => setViewMode('production')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-white text-gray-900 apple-shadow' : 'text-gray-600 hover:text-gray-900'}`}
                >生产</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索客户、负责人或ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-64 px-8 py-2 text-sm rounded-xl bg-white/60 backdrop-blur border apple-border-light focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSelectedSearchResult(null) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/70"
                    aria-label="清除"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
                {(isSearchOpen && searchQuery) && (
                  <div className="absolute right-0 mt-2 w-[28rem] max-h-[50vh] overflow-auto apple-glass apple-shadow border apple-border-light rounded-2xl p-2">
                    {searchResults.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-gray-500">没有找到相关任务</div>
                    ) : (
                      searchResults.slice(0, 50).map(({ task, column }) => (
                        <button
                          key={task.id}
                          onClick={() => handleSearchResultClick(task.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/70 transition-colors ${selectedSearchResult === task.id ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{task.customerName} <span className="text-gray-500">· {task.representative}</span></div>
                              {task.ynmxId && <div className="text-xs text-gray-500 truncate">{task.ynmxId}</div>}
                            </div>
                            <div className="ml-auto text-xs text-gray-500">{column?.title}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Removed redundant new task button per request */}
            </div>
          </div>
        </div>
        {/* Global search via CommandPalette (⌘K) */}

        {/* Main Board */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex gap-4 overflow-x-auto p-6 pt-16 transition-all duration-300"
        >
          {handoffToast && (
            <div className="fixed left-1/2 -translate-x-1/2 top-16 z-50">
              <div className={`apple-glass apple-shadow border apple-border-light rounded-xl px-4 py-2 text-sm text-gray-800 transition-all duration-500 ${handoffToastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                {handoffToast.message}
              </div>
            </div>
          )}
          {viewMode === 'business' && !isRefreshing && (
            <CreateJobForm onJobCreated={handleJobCreated} />
          )}

          {isRefreshing ? (
            <>
              {viewMode === 'business' && (
                <div className="flex-shrink-0 w-80 h-full flex flex-col apple-glass rounded-2xl apple-shadow border apple-border-light animate-pulse">
                  <div className="flex-shrink-0 px-4 py-3 border-b border-transparent">
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
                  className={`flex-shrink-0 w-80 h-full flex flex-col apple-glass rounded-2xl apple-shadow border transition-all duration-200 ${
                    dragOverColumn === column.id 
                      ? 'border-blue-400 shadow-lg' 
                      : 'apple-border-light'
                  }`}
                >
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="sticky top-0 z-10 px-4 py-3 bg-white/70 dark:bg-zinc-900/60 backdrop-blur border-b apple-border-light">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isArchive && <Archive className="w-4 h-4 text-gray-400" />}
                          <h2 className="text-sm font-medium text-gray-700">{column.title}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          {pendingTasks.length > 0 && (
                            <button
                              onClick={() => togglePending(column.id)}
                              className={`text-xs px-2 py-0.5 rounded-full border apple-border-light bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors`}
                              title="待接受"
                            >
                              待接受 {pendingTasks.length}
                            </button>
                          )}
                          <button
                            onClick={() => toggleAddPicker(column.id)}
                            className="p-1 hover:bg-white/70 rounded-md"
                          >
                            <Plus className="w-4 h-4 text-gray-500" />
                          </button>
                          <span className="text-xs font-medium text-gray-600 bg-white/70 px-2 py-0.5 rounded-full border apple-border-light">
                            {columnTasks.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                    {addPickerOpenFor === column.id && (
                      <div className="mb-3 apple-glass apple-shadow border apple-border-light rounded-2xl p-2">
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
                            onClick={() => { setAddPickerOpenFor(null); setAddPickerQuery("") }}
                            className="p-1 rounded hover:bg-white/70"
                            aria-label="关闭"
                          >
                            <X className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                        <div className="max-h-72 overflow-auto divide-y divide-gray-100/60">
                          {(() => {
                            const q = addPickerQuery.trim().toLowerCase()
                            const list = Object.values(tasks)
                              .filter(t => t && (t as any).id)
                              .filter(t => {
                                if (q === "") return true
                                const text = `${t.customerName} ${t.representative} ${t.ynmxId || ''} ${t.notes || ''}`.toLowerCase()
                                return text.includes(q)
                              })
                              .slice(0, 50)
                            if (list.length === 0) {
                              return (
                                <div className="px-3 py-6 text-center text-sm text-gray-500">没有匹配的任务</div>
                              )
                            }
                            return list.map(t => {
                              const col = columns.find(c => c.id === t.columnId)
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => handleSelectAddTask(t.id, column.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-white/70 rounded-lg transition-colors"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{t.customerName} <span className="text-gray-500">· {t.representative}</span></div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      {t.ynmxId && <span className="truncate">{t.ynmxId}</span>}
                                      {col && <span className="px-1.5 py-0.5 rounded bg-gray-100 border apple-border-light">{col.title}</span>}
                                    </div>
                                  </div>
                                </button>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    )}
                    {openPending[column.id] && pendingTasks.length > 0 && (
                      <div className="mb-4 apple-glass apple-shadow border apple-border-light rounded-2xl p-2 transition-all duration-400 ease-out animate-in">
                        <div className="flex items-center justify-between px-1 pb-2">
                          <div className="text-xs font-medium text-gray-700">待接受</div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs px-2 py-0.5 rounded-md bg-white/70 border apple-border-light hover:bg-white"
                              onClick={() => togglePending(column.id)}
                            >收起</button>
                          </div>
                        </div>
                        <div className="space-y-1.5 transition-all">
                        {pendingTasks.map(task => (
                           <div
                            key={task.id}
                             className={`bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 cursor-pointer transition-all duration-200 ${acceptingPending[task.id] ? 'opacity-60 scale-[0.98]' : ''} ${decliningPending[task.id] ? 'opacity-40 translate-x-1' : ''}`}
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
                                   onClick={() => animateAcceptPending(task.id, column.id)}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                   className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                   onClick={() => animateDeclinePending(task.id, column.id)}
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
                      <div className="space-y-1.5 relative">
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
                              className={`relative group apple-glass apple-border-light rounded-xl p-2.5 cursor-move transition-all duration-200 apple-hover ${
                                selectedSearchResult === task.id
                                  ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md'
                                  : ''
                              } ${
                                highlightTaskId === task.id ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md' : ''
                              }`}
                            >
                              <div>
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
                                  <span>
                                    {task.updatedBy ? `${task.updatedBy} · ` : ''}
                                    {formatTimeAgo(task.updatedAt)}
                                  </span>
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
                </div>
              )
            })
          )}
        </div>

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
        {/* New task dialog currently unused */}
      </div>
    </div>
  )
}