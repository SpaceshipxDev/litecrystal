// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

export const ELECTRON_API = {
  // We update the type definition for filesToDownload here
  downloadAndOpenTaskFolder: (
    taskId: string,
    folderName: string,
    // This is the corrected type, now including relativePath
    filesToDownload: { filename: string, relativePath: string, url: string }[]
  ) => ipcRenderer.invoke('download-and-open-task-folder', taskId, folderName, filesToDownload),
};

// Expose it securely
contextBridge.exposeInMainWorld('electronAPI', ELECTRON_API);