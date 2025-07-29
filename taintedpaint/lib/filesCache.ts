// Utility for caching file lists per task
export type CachedFiles = { files: any[]; timestamp: number };

const cache = new Map<string, CachedFiles>();

const TTL_MS = 60_000; // 1 minute

export function getCachedFiles(taskId: string): any[] | null {
  const entry = cache.get(taskId);
  if (entry && Date.now() - entry.timestamp < TTL_MS) {
    return entry.files;
  }
  return null;
}

export function setCachedFiles(taskId: string, files: any[]) {
  cache.set(taskId, { files, timestamp: Date.now() });
}

export function invalidateFilesCache(taskId: string) {
  cache.delete(taskId);
}
