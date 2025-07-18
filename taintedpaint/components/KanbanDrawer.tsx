// file: components/KanbanDrawer.tsx

"use client";

import type { Task } from "@/types";
import type React from "react";
import { useState, useCallback } from "react";
import { X, CalendarDays, MessageSquare, Loader2, Folder } from "lucide-react";

// The 'window.electronAPI' object is injected by the Electron preload script.
// To make TypeScript aware of it, you would typically have a declaration file
// (e.g., 'electron.d.ts') in your project.
declare global {
  interface Window {
    electronAPI?: {
      downloadAndOpenTaskFolder: (
        taskId: string,
        folderName: string,
        filesToDownload: { filename: string, url: string; relativePath: string }[]
      ) => Promise<void>;
    }
  }
}

interface KanbanDrawerProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
}

const truncateFilename = (name: string, maxLength = 25) => {
  if (name.length <= maxLength) return name;
  const extMatch = name.match(/\.[^./]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const core = name.replace(ext, "");
  const coreMaxLength = maxLength - ext.length - 1;
  if (coreMaxLength <= 3) return name;
  return `${core.slice(0, coreMaxLength)}…${ext}`;
};

export default function KanbanDrawer({
  isOpen,
  task,
  columnTitle,
  onClose,
}: KanbanDrawerProps) {
  // --- UI & API State ---
  // Electron open progress state
  const [isDownloading, setIsDownloading] = useState(false);

  // --- [Electron] Open the synced folder ---
  
  // --- [NEW] Electron-powered download handler ---
  const handleDownloadAndOpen = useCallback(async () => {
    if (!task) return;

    // This is the crucial check. If 'window.electronAPI' doesn't exist, we're in a regular browser.
    if (!window.electronAPI) {
      alert("此功能仅在桌面应用中可用。请下载桌面版以获得最佳体验。");
      return;
    }
    
    setIsDownloading(true);
    try {
      // Step 1: Get the list of file URLs from our Next.js backend.
      const res = await fetch(`/api/jobs/${task.id}/files`);
      if (!res.ok) throw new Error('无法获取文件列表');
      const filesToDownload: { filename: string; url: string; relativePath: string }[] = await res.json();
      
      if (filesToDownload.length === 0) {
        alert("此任务没有可下载的文件。");
        return;
      }
      
      // Step 2: Pass the list to the Electron main process to handle the download and open.
      const folderName = `${task.customerName} - ${task.representative}`;
      await window.electronAPI.downloadAndOpenTaskFolder(task.id, folderName, filesToDownload);

    } catch (error) {
      console.error("Download and open failed:", error);
      alert(`下载失败: ${error.message}`);
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
    <aside
      className={`fixed inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl border-l border-black/[0.08] 
                 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 flex flex-col
                 ${isOpen ? "translate-x-0 shadow-[0_8px_64px_0_rgba(0,0,0,0.25)]" : "translate-x-full"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-shrink-0 px-6 pt-6 pb-0 flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <h1 className="text-xl font-semibold text-black tracking-tight truncate -mb-0.5">{task.customerName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[15px] text-black/60 truncate">{task.representative}</p>
            {columnTitle && (
              <>
                <span className="text-black/30 text-sm">·</span>
                <span className="text-[13px] font-medium text-black/50 bg-black/5 px-2 py-0.5 rounded-full">{columnTitle}</span>
              </>
            )}
          </div>
        </div>
        <button onClick={onClose} className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors duration-200">
          <X className="h-4 w-4 text-black/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between py-3 border-b border-black/[0.08]">
            <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-black/40" /><span className="text-[15px] text-black/60">订单日期</span></div>
            <span className="text-[15px] font-medium text-black">{task.orderDate}</span>
          </div>
          {task.notes && (
            <div className="py-3 border-b border-black/[0.08]">
              <div className="flex items-center gap-3 mb-2"><MessageSquare className="h-4 w-4 text-black/40" /><span className="text-[15px] text-black/60">备注</span></div>
              <p className="text-[15px] text-black leading-relaxed ml-7">{task.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={handleDownloadAndOpen}
            disabled={isDownloading}
            className="w-full flex items-center gap-4 p-4 bg-neutral-100 hover:bg-neutral-200 rounded-2xl transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-neutral-200 group-hover:bg-neutral-300 transition-colors duration-200">
              {isDownloading ? <Loader2 className="h-5 w-5 animate-spin text-neutral-600" /> : <Folder className="h-5 w-5 text-neutral-600" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-medium text-black">{isDownloading ? '打开中...' : '打开文件夹'}</p>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}