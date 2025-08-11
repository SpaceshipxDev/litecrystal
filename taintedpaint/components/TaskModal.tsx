"use client"

/* ──────────────────────────────────────────────────────────────────────────────
   TaskModal — Jira-style, no fluff
   - Square container (no rounded corners), neutral tones, compact density
   - Header: title on the left, "打开文件夹" on the right, close button
   - Body: Left (Description, Activity History). Right (Details, Created/Updated)
   - Footer: Edit / Delete (view)  →  Cancel / Delete / Save (edit)
   - No comments/worklog/status/lock/watchers/etc.
   ─────────────────────────────────────────────────────────────────────────── */

import type { Task } from "@/types"
import type { ElectronAPI } from "@/types/electron"
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, Folder, Pencil, Check, Trash2, Building2, User, Hash, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatTimeAgo } from "@/lib/utils"

/* — Minimal, square, ESC-to-close modal shell — */
function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: { open: boolean; onClose: () => void; children: React.ReactNode; labelledBy?: string }) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={backdropRef}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-[100] bg-black/45 p-6 md:p-8 flex items-center justify-center"
      aria-labelledby={labelledBy}
      aria-modal="true"
      role="dialog"
    >
      {children}
    </div>,
    document.body
  )
}

/* — Jira-flat action button (tiny, square, neutral) — */
function ActionButton({
  children,
  onClick,
  variant = "neutral",
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "neutral" | "subtle" | "danger" | "primary"
  disabled?: boolean
  title?: string
}) {
  const base = "h-8 px-3 text-[13px] inline-flex items-center gap-2 border transition select-none"
  const shape = "rounded-none"
  const variants: Record<string, string> = {
    neutral: "border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800",
    subtle:  "border-transparent bg-transparent hover:bg-zinc-100 text-zinc-800",
    danger:  "border-zinc-300 bg-white hover:bg-red-50 text-red-700",
    primary: "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800",
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${shape} ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

interface TaskModalProps {
  open: boolean
  task: Task | null
  columnTitle: string | null
  onOpenChange: (open: boolean) => void
  onTaskUpdated?: (task: Task) => void
  onTaskDeleted?: (taskId: string) => void
  viewMode?: "business" | "production" // not displayed; kept for compatibility
  userName?: string
}

export default function TaskModal({
  open,
  task,
  columnTitle, // not shown explicitly; details show the fields
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
  userName = "",
}: TaskModalProps) {
  /* — edit mode + form state (inline Jira editing) — */
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState({
    customerName: "",
    representative: "",
    ynmxId: "",
    inquiryDate: "",
    deliveryDate: "",
    notes: "",
  })
  const firstEditRef = useRef<HTMLInputElement>(null)

  /* — sync task → form and exit edit on change — */
  useEffect(() => {
    if (!task) return
    setFormData({
      customerName: task.customerName || "",
      representative: task.representative || "",
      ynmxId: task.ynmxId || "",
      inquiryDate: task.inquiryDate || "",
      deliveryDate: task.deliveryDate || "",
      notes: task.notes || "",
    })
    setIsEditMode(false)
  }, [task])

  /* — autofocus first field when entering edit — */
  useEffect(() => { if (isEditMode) firstEditRef.current?.focus() }, [isEditMode])

  /* — save/update — */
  const handleSave = useCallback(async () => {
    if (!task) return
    const res = await fetch(`/api/jobs/${task.id}/update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, updatedBy: userName }),
    })
    if (res.ok) {
      const updated: Task = await res.json()
      onTaskUpdated?.(updated)
      setIsEditMode(false)
    }
  }, [task, formData, onTaskUpdated, userName])

  /* — cancel edit (reset) — */
  const handleCancel = useCallback(() => {
    if (!task) return
    setFormData({
      customerName: task.customerName || "",
      representative: task.representative || "",
      ynmxId: task.ynmxId || "",
      inquiryDate: task.inquiryDate || "",
      deliveryDate: task.deliveryDate || "",
      notes: task.notes || "",
    })
    setIsEditMode(false)
  }, [task])

  /* — delete — */
  const handleDelete = useCallback(async () => {
    if (!task) return
    if (!confirm("确定要删除此任务及其文件吗？")) return
    const res = await fetch(`/api/jobs/${task.id}/delete`, { method: "POST" })
    if (res.ok) {
      onTaskDeleted?.(task.id)
      onOpenChange(false)
    }
  }, [task, onTaskDeleted, onOpenChange])

  /* — open task (electron only) — */
  const handleOpenTask = useCallback(async () => {
    if (!task?.taskFolderPath) return
    const electronAPI: ElectronAPI | undefined = (window as any).electronAPI
    if (!electronAPI) {
      alert("此功能仅在桌面应用中可用。")
      return
    }
    await electronAPI.openTask(task.taskFolderPath)
  }, [task])

  if (!task) return null

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy="task-modal-title">
      {/* — Square, neutral container (Jira-like density) — */}
      <section className="w-full max-w-6xl h-[86vh] bg-white text-zinc-900 rounded-none shadow-xl ring-1 ring-black/10 border border-zinc-300 overflow-hidden flex flex-col">
        {/* ───────────────────────────────── Header ─────────────────────────── */}
        <header className="border-b border-zinc-300 bg-white px-5 pt-4 pb-3">
          {/* title left, open-folder + close right */}
          <div className="flex items-start justify-between gap-3">
            <h2 id="task-modal-title" className="text-[20px] font-semibold tracking-tight leading-tight truncate">
              {task.customerName || "—"}
              {task.representative ? <span className="text-zinc-500"> · {task.representative}</span> : null}
            </h2>

            <div className="flex items-center gap-2">
              {task.taskFolderPath && (
                <ActionButton onClick={handleOpenTask} variant="neutral" title="打开任务">
                  <Folder className="h-4 w-4" />
                  打开任务
                </ActionButton>
              )}
              <ActionButton onClick={() => onOpenChange(false)} variant="subtle" title="关闭">
                <X className="h-4 w-4" />
              </ActionButton>
            </div>
          </div>
        </header>

        {/* ─────────────────────────────── Body ─────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-16 px-5 py-5 overflow-hidden">
          {/* LEFT: Description + Activity (history only) */}
          <div className="min-w-0 overflow-y-auto pr-1">
            {/* Description */}
            <section className="space-y-2">
              <div className="text-sm font-medium text-zinc-900">Description</div>

              {!isEditMode ? (
                <div className="text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">
                  {task.notes || "无描述"}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* main identity fields inline (Jira edits in place) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      ref={firstEditRef}
                      value={formData.customerName}
                      onChange={(e) => setFormData((f) => ({ ...f, customerName: e.target.value }))}
                      placeholder="客户名称"
                      className="h-9 rounded-none"
                    />
                    <Input
                      value={formData.representative}
                      onChange={(e) => setFormData((f) => ({ ...f, representative: e.target.value }))}
                      placeholder="负责人"
                      className="h-9 rounded-none"
                    />
                    <Input
                      value={formData.ynmxId}
                      onChange={(e) => setFormData((f) => ({ ...f, ynmxId: e.target.value }))}
                      placeholder="编号（YNMX）"
                      className="h-9 rounded-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        value={formData.inquiryDate}
                        onChange={(e) => setFormData((f) => ({ ...f, inquiryDate: e.target.value }))}
                        className="h-9 rounded-none"
                      />
                      <Input
                        type="date"
                        value={formData.deliveryDate}
                        onChange={(e) => setFormData((f) => ({ ...f, deliveryDate: e.target.value }))}
                        className="h-9 rounded-none"
                      />
                    </div>
                  </div>

                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="描述 / 备注"
                    className="min-h-28 rounded-none"
                  />
                </div>
              )}
            </section>

            {/* Activity (history only, single vertical list) */}
            <section className="mt-8">
              <div className="text-sm font-medium text-zinc-900">Activity</div>
              <div className="mt-3 space-y-2">
                {(Array.isArray((task as any).history) ? (task as any).history : [])
                  .slice(-30)
                  .reverse()
                  .map((h: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="h-7 w-7 bg-zinc-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-[13px] text-zinc-800">
                            <span className="font-medium text-zinc-900 mr-1">{h.user}</span>
                            <span className="text-zinc-600">{h.description}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 whitespace-nowrap">
                            {formatTimeAgo(h.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                {(!Array.isArray((task as any).history) || (task as any).history.length === 0) && (
                  <div className="text-sm text-zinc-500">暂无变更记录</div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Details grid + timestamps (no automation, no fluff) */}
          <div className="min-w-0 overflow-y-auto pl-1">
            <section className="space-y-4">
              <div className="text-sm font-medium text-zinc-900">Details</div>

              {/* read mode rows */}
              {!isEditMode ? (
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <FieldRow icon={<Building2 className="h-4 w-4 text-zinc-500" />} label="客户" value={task.customerName || "—"} />
                  <FieldRow icon={<User className="h-4 w-4 text-zinc-500" />} label="负责人" value={task.representative || "—"} />
                  <FieldRow icon={<Hash className="h-4 w-4 text-zinc-500" />} label="编号" value={task.ynmxId || "—"} />
                  <FieldRow icon={<CalendarDays className="h-4 w-4 text-zinc-500" />} label="询价日期" value={task.inquiryDate || "—"} />
                  <FieldRow icon={<CalendarDays className="h-4 w-4 text-zinc-500" />} label="交期" value={task.deliveryDate || "—"} />
                </div>
              ) : (
                /* edit mode rows */
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <LabeledInput label="客户" value={formData.customerName} onChange={(v) => setFormData((f) => ({ ...f, customerName: v }))} />
                  <LabeledInput label="负责人" value={formData.representative} onChange={(v) => setFormData((f) => ({ ...f, representative: v }))} />
                  <LabeledInput label="编号" value={formData.ynmxId} onChange={(v) => setFormData((f) => ({ ...f, ynmxId: v }))} />
                  <LabeledInput label="询价日期" type="date" value={formData.inquiryDate} onChange={(v) => setFormData((f) => ({ ...f, inquiryDate: v }))} />
                  <LabeledInput label="交期" type="date" value={formData.deliveryDate} onChange={(v) => setFormData((f) => ({ ...f, deliveryDate: v }))} />
                </div>
              )}

              {/* timestamps */}
              <div className="pt-2 text-xs text-zinc-500 flex items-center justify-between">
                <div>Created {task.createdAt ? formatTimeAgo(task.createdAt as any) : "—"}</div>
                <div>Updated {task.updatedAt ? formatTimeAgo(task.updatedAt) : "—"}</div>
              </div>
            </section>
          </div>
        </div>

        {/* ───────────────────────────── Footer actions ─────────────────────── */}
        <footer className="border-t border-zinc-300 bg-white px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            {!isEditMode ? (
              <>
                <ActionButton variant="neutral" onClick={() => setIsEditMode(true)}>
                  <Pencil className="h-4 w-4" />
                  编辑
                </ActionButton>
                <ActionButton variant="danger" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton variant="subtle" onClick={handleCancel}>取消</ActionButton>
                <ActionButton variant="danger" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </ActionButton>
                <ActionButton variant="primary" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                  保存
                </ActionButton>
              </>
            )}
          </div>
        </footer>
      </section>
    </Modal>
  )
}

/* — read-only row (icon + label + value), Jira density — */
function FieldRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-sm text-zinc-900 truncate">{value}</div>
      </div>
    </div>
  )
}

/* — labeled input used in edit mode (square, compact) — */
function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-none" />
    </label>
  )
}
