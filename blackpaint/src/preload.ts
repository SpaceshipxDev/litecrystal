// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

export const ELECTRON_API = {
  // Open a path located on the shared SMB disk
  openTask: (relativePath: string) =>
    ipcRenderer.invoke('open-task', relativePath),
};

// Expose it securely
contextBridge.exposeInMainWorld('electronAPI', ELECTRON_API);
