// file: components/KanbanDrawer.tsx
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

interface KanbanDrawerProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  viewMode?: "business" | "production";
}

export default function KanbanDrawer({
  isOpen,
  task,
  columnTitle,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  viewMode = "business",
}: KanbanDrawerProps) {
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
    if (!confirm('确定要删除此任务及其文件吗？')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/delete`, { method: 'POST' });
      if (res.ok) {
        onTaskDeleted?.(task.id);
        onClose();
      } else {
        console.error('Delete task failed');
      }
    } catch (err) {
      console.error('Delete task failed', err);
    } finally {
      setIsDeleting(false);
    }
  }, [task, onTaskDeleted, onClose]);

  if (!task) {
    return (
      <aside className="fixed inset-y-0 right-0 w-[400px] translate-x-full pointer-events-none transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]" />
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl border-l border-gray-200/50 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 flex flex-col ${
        isOpen ? "translate-x-0 shadow-[0_8px_64px_0_rgba(0,0,0,0.12)]" : "translate-x-full"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Task Details</h2>
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

        {/* Primary Info */}
        <div className="space-y-3">
          {isEditMode ? (
            <>
              <Input
                ref={customerInputRef}
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="客户名称"
                className="text-lg font-semibold border-0 bg-gray-50 focus:bg-white transition-all duration-200 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={formData.representative}
                  onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                  placeholder="代表人"
                  className="border-0 bg-gray-50 focus:bg-white transition-all duration-200 rounded-lg"
                />
                <Input
                  value={formData.ynmxId}
                  onChange={(e) => setFormData({ ...formData, ynmxId: e.target.value })}
                  placeholder="生产编号"
                  className="border-0 bg-gray-50 focus:bg-white transition-all duration-200 rounded-lg font-mono"
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900">
                {viewMode === "business" ? formData.customerName : formData.ynmxId || formData.customerName}
              </h1>
              <div className="flex items-center gap-3 text-sm">
                {viewMode === "business" && formData.representative && (
                  <span className="text-gray-600">{formData.representative}</span>
                )}
                {formData.ynmxId && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-mono text-xs">
                    {formData.ynmxId}
                  </span>
                )}
                {columnTitle && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {columnTitle}
                  </span>
                )}
                {task?.deliveryNoteGenerated && (
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    出货单已生成
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-4">
          {/* Customer Info Section */}
          {isEditMode && viewMode === "production" && (
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">客户信息</h3>
              <div className="space-y-3">
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="客户名称"
                    className="pl-10 border-0 bg-white transition-all duration-200 rounded-lg"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    value={formData.representative}
                    onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                    placeholder="代表人"
                    className="pl-10 border-0 bg-white transition-all duration-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Manufacturing ID */}
          {isEditMode && viewMode === "business" && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">生产信息</h3>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.ynmxId}
                  onChange={(e) => setFormData({ ...formData, ynmxId: e.target.value })}
                  placeholder="生产编号"
                  className="pl-10 border-0 bg-white transition-all duration-200 rounded-lg font-mono"
                />
              </div>
            </div>
          )}

          {/* Dates Section */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">时间信息</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">询价日期</span>
                </div>
                {isEditMode ? (
                  <Input
                    type="date"
                    value={formData.inquiryDate}
                    onChange={(e) => setFormData({ ...formData, inquiryDate: e.target.value })}
                    className="w-auto border-0 bg-white transition-all duration-200 rounded-lg"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{formData.inquiryDate || "未设置"}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">交货日期</span>
                </div>
                {isEditMode ? (
                  <Input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                    className="w-auto border-0 bg-white transition-all duration-200 rounded-lg"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900">{formData.deliveryDate || "未设置"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</h3>
            </div>
          {isEditMode ? (
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="添加备注..."
              rows={4}
              className="border-0 bg-white transition-all duration-200 rounded-lg resize-none"
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {formData.notes || "暂无备注"}
            </p>
          )}
        </div>

        {/* Open folder action */}

          {/* Action Button */}
          <button
            onClick={handleOpenFolder}
            disabled={isOpening}
            className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-200 group disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors duration-200">
              {isOpening ? (
                <svg className="h-5 w-5 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 1-10 10" />
                </svg>
              ) : (
                <Folder className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">
                {isOpening ? "正在打开..." : "打开文件夹"}
              </p>
              <p className="text-xs text-gray-500">直接在共享磁盘中查看任务文件</p>
            </div>
          </button>
    </div>
  </div>
</aside>
  );
}
