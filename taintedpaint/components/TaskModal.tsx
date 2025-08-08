"use client";

/* ──────────────────────────────────────────────────────────────────────────────
   TaskModal — clean, consistent, non-redundant modal
   - No shadcn Dialog; custom Portal modal
   - Fixed size card (doesn’t grow/shrink with activity length)
   - Header shows ONLY identity (no duplicate meta)
   - Single sticky footer for all actions (no duplicate save buttons)
   - Edit mode has Cancel (resets form) + Save; Delete kept left as destructive
   ─────────────────────────────────────────────────────────────────────────── */

import type { Task } from "@/types";
import type { ElectronAPI } from "@/types/electron";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CalendarDays,
  MessageSquare,
  Folder,
  Pencil,
  Check,
  Trash2,
  Building2,
  User,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeAgo } from "@/lib/utils";

/* ── Lightweight Modal (portal + backdrop) ─────────────────────────────────── */
function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] p-4 flex items-center justify-center"
      aria-labelledby={labelledBy}
      aria-modal="true"
      role="dialog"
    >
      {children}
    </div>,
    document.body
  );
}

/* ── Small pill for ID / status ────────────────────────────────────────────── */
const Badge = ({
  children,
  tone = "neutral" as "neutral" | "blue",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue";
}) => {
  const toneCls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-blue-200/80"
      : "bg-zinc-50 text-zinc-700 ring-zinc-200/80";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${toneCls}`}>
      {children}
    </span>
  );
};

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  columnTitle: string | null;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  viewMode?: "business" | "production";
  userName?: string;
}

export default function TaskModal({
  open,
  task,
  columnTitle,
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
  viewMode = "business",
  userName = "",
}: TaskModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ── form state (only used in edit mode)
  const [formData, setFormData] = useState({
    customerName: "",
    representative: "",
    ynmxId: "",
    inquiryDate: "",
    deliveryDate: "",
    notes: "",
  });
  const customerInputRef = useRef<HTMLInputElement>(null);

  // ── sync incoming task → form; always exit edit mode on task change
  useEffect(() => {
    if (task) {
      setFormData({
        customerName: task.customerName || "",
        representative: task.representative || "",
        ynmxId: task.ynmxId || "",
        inquiryDate: task.inquiryDate || "",
        deliveryDate: task.deliveryDate || "",
        notes: task.notes || "",
      });
    }
    setIsEditMode(false);
  }, [task]);

  // ── autofocus first field when entering edit
  useEffect(() => {
    if (isEditMode) customerInputRef.current?.focus();
  }, [isEditMode]);

  // ── Save changes
  const handleSave = useCallback(async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/jobs/${task.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, updatedBy: userName }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        onTaskUpdated?.(updated);
        setIsEditMode(false);
      }
    } catch (err) {
      console.error("Failed to update task", err);
    }
  }, [task, formData, onTaskUpdated, userName]);

  // ── Cancel edit (reset form → current task; exit edit)
  const handleCancel = useCallback(() => {
    if (!task) return;
    setFormData({
      customerName: task.customerName || "",
      representative: task.representative || "",
      ynmxId: task.ynmxId || "",
      inquiryDate: task.inquiryDate || "",
      deliveryDate: task.deliveryDate || "",
      notes: task.notes || "",
    });
    setIsEditMode(false);
  }, [task]);

  // ── Delete task
  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirm("确定要删除此任务及其文件吗？")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/delete`, { method: "POST" });
      if (res.ok) {
        onTaskDeleted?.(task.id);
        onOpenChange(false);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [task, onTaskDeleted, onOpenChange]);

  // ── Open folder (Electron only)
  const handleOpenFolder = useCallback(async () => {
    if (!task?.taskFolderPath) return;
    const electronAPI: ElectronAPI | undefined = (window as any).electronAPI;
    if (!electronAPI) {
      alert("此功能仅在桌面应用中可用。请下载桌面版以获得最佳体验。");
      return;
    }
    try {
      await electronAPI.openTaskFolder(task.taskFolderPath);
    } catch (err: any) {
      alert(`打开失败: ${err.message}`);
    }
  }, [task]);

  if (!task) return null;

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy="task-modal-title">
      {/* ── Fixed-size card: doesn’t resize with content ───────────────────── */}
      <section className="w-full max-w-5xl h-[84vh] bg-white text-zinc-900 rounded-2xl shadow-2xl ring-1 ring-black/5 border border-zinc-200 overflow-hidden flex flex-col">
        {/* ── Header (identity only) ───────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="task-modal-title" className="text-xl font-semibold tracking-tight truncate">
                {task.customerName || "—"}
                {task.representative ? (
                  <span className="ml-1 text-zinc-400">· {task.representative}</span>
                ) : null}
              </h2>
              {task.ynmxId ? <Badge>{task.ynmxId}</Badge> : null}
              {columnTitle ? <Badge tone="blue">{columnTitle}</Badge> : null}
              {viewMode === "production" ? <Badge>生产</Badge> : null}
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-zinc-100 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ── Body (scrolling) ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 overflow-y-auto grow">
          {/* LEFT: Details / Editor (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {isEditMode ? (
              /* EDIT MODE — minimal inputs, clean grid */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    ref={customerInputRef}
                    value={formData.customerName}
                    onChange={(e) => setFormData((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder="客户名称"
                  />
                  <Input
                    value={formData.representative}
                    onChange={(e) => setFormData((f) => ({ ...f, representative: e.target.value }))}
                    placeholder="负责人"
                  />
                  <Input
                    value={formData.ynmxId}
                    onChange={(e) => setFormData((f) => ({ ...f, ynmxId: e.target.value }))}
                    placeholder="编号"
                  />
                  <Input
                    type="date"
                    value={formData.inquiryDate}
                    onChange={(e) => setFormData((f) => ({ ...f, inquiryDate: e.target.value }))}
                    placeholder="询价日期"
                  />
                  <Input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData((f) => ({ ...f, deliveryDate: e.target.value }))}
                    placeholder="交期"
                  />
                </div>

                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="备注"
                  className="min-h-28"
                />
              </div>
            ) : (
              /* READ MODE — single source of truth; no duplicate in header */
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-[15px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">{task.customerName || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">{task.representative || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">{task.ynmxId || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">询价: {task.inquiryDate || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="h-4 w-4 text-zinc-400" />
                    <span className="truncate">交期: {task.deliveryDate || "—"}</span>
                  </div>
                </div>

                {/* Centerpiece Action — large, intuitive open-folder tile */}
                {task.taskFolderPath && (
                  <div className="min-h-[20vh] hidden lg:flex items-center justify-center">
                    <button
                      onClick={handleOpenFolder}
                      className="group w-full max-w-xl rounded-2xl apple-glass apple-border-light apple-shadow p-6 flex items-center justify-center gap-4 hover:bg-white/70 transition"
                    >
                      <div className="rounded-2xl p-3 bg-gradient-to-b from-blue-50 to-blue-100 text-blue-700 ring-1 ring-blue-200/70">
                        <Folder className="h-8 w-8" />
                      </div>
                      <div className="text-left">
                        <div className="text-base font-semibold leading-tight">打开文件夹</div>
                        <div className="text-xs text-zinc-500">在访达中查看任务文件</div>
                      </div>
                    </button>
                  </div>
                )}

                {task.notes ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-zinc-900">备注</div>
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-zinc-400" />
                      <p className="whitespace-pre-wrap leading-relaxed text-zinc-700">
                        {task.notes}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

{/* RIGHT: Activity — fixed rail, own scroll; clean, no dots */}
<aside className="lg:col-span-1">
  <div className="bg-white border border-zinc-200 rounded-xl p-4 h-full max-h-[unset] overflow-hidden">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium tracking-tight">变更记录</h3>
      {Array.isArray((task as any).history) && (task as any).history.length > 10 ? (
        <button
          className="text-xs text-blue-700 hover:underline"
          onClick={() => setShowAllHistory((v) => !v)}
        >
          {showAllHistory ? "收起" : `展开全部(${(task as any).history.length})`}
        </button>
      ) : null}
    </div>

    {/* Inner scroller so the card height stays constant */}
    <div className="h-[46vh] overflow-y-auto mt-4">
      <ul className="space-y-2.5">
        {(Array.isArray((task as any).history) ? (task as any).history : [])
          .slice(showAllHistory ? 0 : -10)
          .reverse()
          .map((h: any, i: number) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[13px] text-zinc-800">
                  <span className="font-medium text-zinc-900 mr-1">{h.user}</span>
                  <span className="text-zinc-600">{h.description}</span>
                </div>
                <div className="text-[11px] text-zinc-400 whitespace-nowrap">
                  {formatTimeAgo(h.timestamp)}
                </div>
              </div>
            </li>
          ))}
      </ul>

      {(!Array.isArray((task as any).history) || (task as any).history.length === 0) && (
        <div className="text-sm text-zinc-500">暂无变更记录</div>
      )}
    </div>
  </div>
</aside>



        </div>

        {/* ── Footer (single source of actions; sticky) ─────────────────────── */}
        <footer className="shrink-0 border-t border-zinc-200 bg-white/95 backdrop-blur px-6 py-3">
          <div className="flex items-center justify-between">
            {/* left: destructive */}
            <div>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeleting ? "删除中..." : "删除"}
              </Button>
            </div>

            {/* right: context actions */}
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <>
                  {task.taskFolderPath && (
                    <Button variant="outline" onClick={handleOpenFolder} className="rounded-xl">
                      <Folder className="h-4 w-4 mr-1" />
                      打开文件夹
                    </Button>
                  )}
                  <Button onClick={() => setIsEditMode(true)} className="rounded-xl">
                    <Pencil className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancel} className="rounded-xl">
                    取消
                  </Button>
                  <Button onClick={handleSave} className="rounded-xl">
                    <Check className="h-4 w-4 mr-1" />
                    保存
                  </Button>
                </>
              )}
            </div>
          </div>
        </footer>
      </section>
    </Modal>
  );
}
