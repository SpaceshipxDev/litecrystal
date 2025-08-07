"use client";

import type { Task } from "@/types";
import type { ElectronAPI } from "@/types/electron";
import { useState, useCallback, useEffect, useRef } from "react";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatTimeAgo } from "@/lib/utils";

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
          updatedBy: userName,
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
  }, [task, formData, onTaskUpdated, userName]);

  const handleOpenFolder = useCallback(async () => {
    if (!task || !task.taskFolderPath) return;
    const electronAPI: ElectronAPI | undefined = (window as any).electronAPI;
    if (!electronAPI) {
      alert("此功能仅在桌面应用中可用。请下载桌面版以获得最佳体验。");
      return;
    }
    try {
      await electronAPI.openTaskFolder(task.taskFolderPath);
    } catch (err: any) {
      console.error("Open folder failed:", err);
      alert(`打开失败: ${err.message}`);
    }
  }, [task]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirm('确定要删除此任务及其文件吗？')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/delete`, { method: 'POST' });
      if (res.ok) {
        onTaskDeleted?.(task.id);
        onOpenChange(false);
      } else {
        console.error('Delete task failed');
      }
    } catch (err) {
      console.error('Delete task failed', err);
    } finally {
      setIsDeleting(false);
    }
  }, [task, onTaskDeleted, onOpenChange]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">任务详情</h2>
            {columnTitle && (
              <p className="text-sm text-gray-500">{columnTitle}</p>
            )}
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isEditMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                ref={customerInputRef}
                value={formData.customerName}
                onChange={e => setFormData(f => ({ ...f, customerName: e.target.value }))}
                placeholder="客户名称"
              />
              <Input
                value={formData.representative}
                onChange={e => setFormData(f => ({ ...f, representative: e.target.value }))}
                placeholder="负责人"
              />
              <Input
                value={formData.ynmxId}
                onChange={e => setFormData(f => ({ ...f, ynmxId: e.target.value }))}
                placeholder="编号"
              />
              <Input
                value={formData.inquiryDate}
                onChange={e => setFormData(f => ({ ...f, inquiryDate: e.target.value }))}
                placeholder="询价日期"
                type="date"
              />
              <Input
                value={formData.deliveryDate}
                onChange={e => setFormData(f => ({ ...f, deliveryDate: e.target.value }))}
                placeholder="交期"
                type="date"
              />
            </div>
            <Textarea
              value={formData.notes}
              onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              placeholder="备注"
            />
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? '删除中...' : '删除'}
              </Button>
              <Button onClick={handleSave}>
                <Check className="w-4 h-4 mr-1" /> 保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span>{task.customerName || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span>{task.representative || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <span>{task.ynmxId || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span>{task.inquiryDate || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span>{task.deliveryDate || '—'}</span>
              </div>
            </div>
            {task.notes && (
              <p className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 mt-0.5 text-gray-400" />
                <span>{task.notes}</span>
              </p>
            )}
            <div className="flex justify-end gap-2">
              {task.taskFolderPath && (
                <Button variant="outline" onClick={handleOpenFolder}>
                  <Folder className="w-4 h-4 mr-1" /> 打开文件夹
                </Button>
              )}
              <Button onClick={() => setIsEditMode(true)}>
                <Pencil className="w-4 h-4 mr-1" /> 编辑
              </Button>
            </div>
          </div>
        )}

        {task.history && task.history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">变更记录</h3>
            <ul className="space-y-1">
              {task.history.slice().reverse().map((h, i) => (
                <li key={i} className="text-xs text-gray-500">
                  {h.user} {h.description} · {formatTimeAgo(h.timestamp)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
