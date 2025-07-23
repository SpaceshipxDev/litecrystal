import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import chokidar, { FSWatcher } from 'chokidar';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.5.107:3000';

interface RemoteFile {
  filename: string;
  relativePath: string;
  url: string;
  mtimeMs: number;
}

async function listLocalFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await listLocalFiles(full));
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  } catch {
    /* ignore */
  }
  return results;
}

const activeSyncs = new Map<string, { watcher: FSWatcher; interval: ReturnType<typeof setInterval> }>();
const pendingWrites = new Set<string>();
const pendingUploads = new Set<string>();

// Simple helper to upload or update a file
async function uploadFile(taskId: string, localRoot: string, relPath: string) {
  const fullPath = path.join(localRoot, relPath);
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    return;
  }
  if (!stat.isFile()) return;

  const file = await fs.readFile(fullPath);

  const form = new FormData();
  form.append('files', new Blob([file]));
  form.append('paths', relPath);

  pendingUploads.add(fullPath);

  try {
    const res = await fetch(`${BASE_URL}/api/jobs/${taskId}/upload`, {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      pendingUploads.delete(fullPath);
    } else {
      console.error('Failed to upload file', res.statusText);
    }
  } catch (err) {
    console.error('Failed to upload file', err);
    // keep in pendingUploads for retry
  }
}

async function deleteFile(taskId: string, relPath: string) {
  try {
    await fetch(`${BASE_URL}/api/jobs/${taskId}/delete-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: relPath }),
    });
  } catch (err) {
    console.error('Failed to delete file', err);
  }
}

async function pullFromServer(taskId: string, localRoot: string) {
  try {
    const res = await axios.get<RemoteFile[]>(`${BASE_URL}/api/jobs/${taskId}/files`);
    const files = res.data;
    for (const file of files) {
      const localPath = path.join(localRoot, file.relativePath);
      let stat;
      try {
        stat = await fs.stat(localPath);
      } catch {
        stat = null;
      }
      if (!stat || stat.mtimeMs < file.mtimeMs) {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        const response = await axios.get(file.url, { responseType: 'arraybuffer' });
        pendingWrites.add(localPath);
        await fs.writeFile(localPath, Buffer.from(response.data));
        pendingWrites.delete(localPath);
      }
    }
    const remoteSet = new Set(files.map(f => path.join(localRoot, f.relativePath)));
    const localFiles = await listLocalFiles(localRoot);
    for (const lp of localFiles) {
      if (!remoteSet.has(lp) && !pendingUploads.has(lp)) {
        pendingWrites.add(lp);
        await fs.unlink(lp).catch(() => {});
        pendingWrites.delete(lp);
      }
    }

    // retry any pending uploads
    for (const lp of Array.from(pendingUploads)) {
      const relPath = path.relative(localRoot, lp).replace(/\\/g, '/');
      await uploadFile(taskId, localRoot, relPath);
    }
  } catch (err) {
    console.error('sync pull error', err);
  }
}

export function startBidirectionalSync(taskId: string, localRoot: string) {
  if (activeSyncs.has(taskId)) return;

  // initial pull
  pullFromServer(taskId, localRoot);

  const watcher = chokidar.watch(localRoot, {
    persistent: true,
    ignoreInitial: true,
  });

  const toRel = (fullPath: string) =>
    path.relative(localRoot, fullPath).replace(/\\/g, '/');

  const shouldSkip = (p: string) => {
    if (pendingWrites.has(p)) {
      pendingWrites.delete(p);
      return true;
    }
    return false;
  };

  watcher
    .on('add', async (filePath) => {
      if (shouldSkip(filePath)) return;
      const relPath = toRel(filePath);
      await uploadFile(taskId, localRoot, relPath);
    })
    .on('change', async (filePath) => {
      if (shouldSkip(filePath)) return;
      const relPath = toRel(filePath);
      await uploadFile(taskId, localRoot, relPath);
    })
    .on('unlink', async (filePath) => {
      if (shouldSkip(filePath)) return;
      const relPath = toRel(filePath);
      await deleteFile(taskId, relPath);
    });

  const interval = setInterval(() => pullFromServer(taskId, localRoot), 10000);
  activeSyncs.set(taskId, { watcher, interval });
}

export function stopAllSyncs() {
  for (const { watcher, interval } of activeSyncs.values()) {
    watcher.close();
    clearInterval(interval);
  }
  activeSyncs.clear();
}
