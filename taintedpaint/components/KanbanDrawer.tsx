// file: components/KanbanDrawer.tsx
"use client";

import type { Task } from "@/types";
import type { ElectronAPI } from "@/types/electron";
import { useState, useCallback } from "react";
import { X, CalendarDays, MessageSquare, Folder, FileCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KanbanDrawerProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
}

export default function KanbanDrawer({
  isOpen,
  task,
  columnTitle,
  onClose,
}: KanbanDrawerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const handleDownloadAndOpen = useCallback(async () => {
    if (!task) return;
    const electronAPI: ElectronAPI | undefined = window.electronAPI;
    if (!electronAPI) {
      alert("此功能仅在桌面应用中可用。请下载桌面版以获得最佳体验。");
      return;
    }
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/files`);
      if (!res.ok) throw new Error("无法获取文件列表");
      const filesToDownload: { filename: string; url: string; relativePath: string }[] = await res.json();
      if (filesToDownload.length === 0) {
        alert("此任务没有可下载的文件。");
        return;
      }
      const folderName = task.ynmxId || `${task.customerName} - ${task.representative}`;
      await electronAPI.downloadAndOpenTaskFolder(task.id, folderName, filesToDownload);
    } catch (err: any) {
      console.error("Download and open failed:", err);
      alert(`下载失败: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  }, [task]);

  if (!task) {
    return (
      <aside className="fixed inset-y-0 right-0 w-[400px] translate-x-full pointer-events-none transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]" />
    );
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 right-0 w-[400px] bg-white/90 backdrop-blur-md border-l border-gray-200/80 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 flex flex-col ${isOpen ? "translate-x-0 shadow-[0_8px_64px_0_rgba(0,0,0,0.25)]" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-6 pb-0 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-xl font-semibold text-black tracking-tight truncate -mb-0.5">
              {task.ynmxId || task.customerName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {!task.ynmxId && (
                <p className="text-[15px] text-black/60 truncate">{task.representative}</p>
              )}
              {columnTitle && (
                <>
                  {!task.ynmxId && <span className="text-black/30 text-sm">·</span>}
                  <span className="text-[13px] font-medium text-black/50 bg-black/5 px-2 py-0.5 rounded-full">
                    {columnTitle}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-black/5 hover:bg-black/10 transition-colors duration-200"
          >
            <X className="h-4 w-4 text-black/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between py-3 border-b border-black/[0.08]">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-black/40" />
                <span className="text-[15px] text-black/60">订单日期</span>
              </div>
              <span className="text-[15px] font-medium text-black">{task.orderDate}</span>
            </div>
            {task.notes && (
              <div className="py-3 border-b border-black/[0.08]">
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare className="h-4 w-4 text-black/40" />
                  <span className="text-[15px] text-black/60">备注</span>
                </div>
                <p className="text-[15px] text-black leading-relaxed ml-7">{task.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDownloadAndOpen}
              disabled={isDownloading}
              className="w-full flex items-center gap-4 p-4 bg-green-500/8 hover:bg-green-500/12 rounded-lg transition-all duration-200 group disabled:opacity-60 disabled:cursor-wait"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded bg-green-500/15 group-hover:bg-green-500/20 transition-colors duration-200">
                {isDownloading ? (
                  <svg className="h-5 w-5 text-green-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" />
                  </svg>
                ) : (
                  <Folder className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-medium text-black">
                  {isDownloading ? "正在下载..." : "打开文件夹"}
                </p>
                <p className="text-[13px] text-black/50">
                  {isDownloading ? "文件将保存在您的下载目录" : "快速获取所有项目文件"}
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowMetadata(true)}
              className="w-full flex items-center gap-4 p-4 bg-black/5 hover:bg-black/10 rounded-lg transition-all duration-200"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded bg-black/10">
                <FileCode className="h-5 w-5 text-black/70" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-medium text-black">查看元数据</p>
                <p className="text-[13px] text-black/50">显示此任务的原始记录</p>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <Dialog open={showMetadata} onOpenChange={setShowMetadata}>
        <DialogContent className="max-w-xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>任务元数据</DialogTitle>
          </DialogHeader>
          <pre className="mt-4 text-sm bg-black/5 rounded-md p-4 whitespace-pre-wrap overflow-x-auto">
{JSON.stringify(task, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
