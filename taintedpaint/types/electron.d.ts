// types/electron.d.ts (in your Next.js project)

// This interface must match the object exposed in preload.ts
export interface ElectronAPI {
  // Opens a folder on the SMB share. The path is relative to the share root
  openTaskFolder: (relativePath: string) => Promise<void>;
}

declare global {
  interface Window {
    // This tells TypeScript that window.electronAPI might exist and what its shape is
    electronAPI?: ElectronAPI;
  }
}

// Adding 'export {}' makes this a module, which is good practice.
export {};
