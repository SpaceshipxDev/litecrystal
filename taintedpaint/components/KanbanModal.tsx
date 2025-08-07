"use client";

import type { Task } from "@/types";
import type { ElectronAPI } from "@/types/electron";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  CalendarDays,
  Folder,
  Pencil,
  Check,
  Trash2,
  MessageSquare,
  Building2,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTimeAgo } from "@/lib/utils";

interface KanbanModalProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  viewMode?: "business" | "production";
}

export default function KanbanModal({
  isOpen,
  task,
  columnTitle,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  viewMode = "business",
}: KanbanModalProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    representative: "",
    ynmxId: "",
    inquiryDate: "",
    deliveryDate: "",
    notes: "",
  });

  const customerInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isEditMode && customerInputRef.current) {
      customerInputRef.current.focus();
    }
  }, [isEditMode]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    try {
      const stored = localStorage.getItem("user");
      const userName = stored ? JSON.parse(stored).name : "";
      const res = await fetch(`/api/jobs/${task.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          representative: formData.representative,
          ynmxId: formData.ynmxId,
          inquiryDate: formData.inquiryDate,
          deliveryDate: formData.deliveryDate,
          notes: formData.notes,
          userName,
        }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        onTaskUpdated?.(updated);
        setIsEditMode(false);
      }
    } catch (err) {
      console.error("Failed to update task", err);
    }
  }, [task, formData, onTaskUpdated]);

  const handleOpenFolder = useCallback(async () => {
    if (!task || !task.taskFolderPath) return;
    const electronAPI: ElectronAPI | undefined = window.electronAPI;
    if (!electronAPI) {
      alert("此功能仅在桌面应用中可用。请下载桌面版以获得最佳体验。");
      return;
    }
    setIsOpening(true);
    try {
      await electronAPI.openTaskFolder(task.taskFolderPath);
    } catch (err: any) {
      console.error("Open folder failed:", err);
      alert(`打开失败: ${err.message}`);
    } finally {
      setIsOpening(false);
    }
  }, [task]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirm("确定要删除此任务及其文件吗？")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/delete`, { method: "POST" });
      if (res.ok) {
        onTaskDeleted?.(task.id);
        onClose();
      } else {
        console.error("Delete task failed");
      }
    } catch (err) {
      console.error("Delete task failed", err);
    } finally {
      setIsDeleting(false);
    }
  }, [task, onTaskDeleted, onClose]);

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl">
        <DialogHeader className="pb-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">
              任务详情
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all duration-200 disabled:opacity-50"
                    title="删除任务"
                  >
                    {isDeleting ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M22 12a10 10 0 0 1-10 10" />
                      </svg>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                  <div className="w-px h-5 bg-gray-200" />
                  <button
                    onClick={handleSave}
                    className="h-8 px-3 flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                    保存
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="h-8 px-3 flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-all duration-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </button>
              )}
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all duration-200"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {isEditMode ? (
              <>
                <Input
                  ref={customerInputRef}
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="客户名称"
                  className="text-lg font-semibold border-0 bg-gray-50 focus:bg-white transition-all duration-200 rounded-lg"
                />
                <Input
                  value={formData.representative}
                  onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                  placeholder="负责人"
                  className="border-0 bg-gray-50 focus:bg-white transition-all duration-200 rounded-lg"
                />
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900">{task.customerName}</h3>
                <p className="text-sm text-gray-600">{task.representative}</p>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <Building2 className="w-4 h-4 text-gray-400" />
                客户编号
              </label>
              {isEditMode ? (
                <Input
                  value={formData.ynmxId}
                  onChange={(e) => setFormData({ ...formData, ynmxId: e.target.value })}
                  placeholder="生产编号"
                  className="h-8 text-sm bg-gray-50 border-0 focus:bg-white"
                />
              ) : (
                <p className="text-sm text-gray-600">{task.ynmxId || "—"}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <User className="w-4 h-4 text-gray-400" />
                当前列
              </label>
              <p className="text-sm text-gray-600">{columnTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                询价日期
              </label>
              {isEditMode ? (
                <Input
                  type="date"
                  value={formData.inquiryDate}
                  onChange={(e) => setFormData({ ...formData, inquiryDate: e.target.value })}
                  className="h-8 text-sm bg-gray-50 border-0 focus:bg-white"
                />
              ) : (
                <p className="text-sm text-gray-600">{task.inquiryDate}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                交货日期
              </label>
              {isEditMode ? (
                <Input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="h-8 text-sm bg-gray-50 border-0 focus:bg-white"
                />
              ) : (
                <p className="text-sm text-gray-600">{task.deliveryDate || "—"}</p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              备注
            </label>
            {isEditMode ? (
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="text-sm bg-gray-50 border-0 focus:bg-white"
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.notes || "—"}</p>
            )}
          </div>

          {task.taskFolderPath && (
            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenFolder}
                disabled={isOpening}
              >
                <Folder className="w-4 h-4 mr-2" />
                {isOpening ? "打开中..." : "打开文件夹"}
              </Button>
            </div>
          )}

          {task.history && task.history.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">活动记录</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {task.history.map((h, idx) => (
                  <div key={idx} className="text-xs text-gray-600 flex justify-between">
                    <span className="truncate">
                      {h.user} {h.action}
                    </span>
                    <span className="ml-2 text-gray-400 flex-shrink-0">
                      {formatTimeAgo(h.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

