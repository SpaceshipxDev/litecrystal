// types/electron.d.ts (in your Next.js project)

// This interface must match the object exposed in preload.ts
export interface ElectronAPI {
  downloadAndOpenTaskFolder: (
    taskId: string,
    folderName: string,
    // This signature must match the one in preload.ts
    filesToDownload: { filename: string, relativePath: string, url: string }[]
  ) => Promise<void>;
}

declare global {
  interface Window {
    // This tells TypeScript that window.electronAPI might exist and what its shape is
    electronAPI?: ElectronAPI;
  }
}

// Adding 'export {}' makes this a module, which is good practice.
export {};
