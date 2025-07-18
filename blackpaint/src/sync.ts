import fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import path from 'path';
import axios from 'axios';

interface RemoteFile {
  filename: string;
  relativePath: string;
  url: string;
  mtimeMs: number;
}

const activeSyncs = new Map<string, { watcher: FSWatcher; interval: NodeJS.Timer }>();

// Simple helper to upload or update a file
async function uploadFile(taskId: string, localRoot: string, relPath: string) {
  const fullPath = path.join(localRoot, relPath);
  const file = await fs.readFile(fullPath);

  const form = new FormData();
  form.append('files', new Blob([file]));
  form.append('paths', relPath);

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/${taskId}/upload`, {
    method: 'POST',
    body: form,
  });
}

async function deleteFile(taskId: string, relPath: string) {
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/${taskId}/delete-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: relPath }),
  });
}

async function pullFromServer(taskId: string, localRoot: string) {
  try {
    const res = await axios.get<RemoteFile[]>(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/${taskId}/files`);
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
        await fs.writeFile(localPath, Buffer.from(response.data));
      }
    }
  } catch (err) {
    console.error('sync pull error', err);
  }
}

export function startBidirectionalSync(taskId: string, localRoot: string) {
  if (activeSyncs.has(taskId)) return;

  // initial pull
  pullFromServer(taskId, localRoot);

  const watcher = watch(localRoot, { recursive: true }, async (eventType, filename) => {
    if (!filename) return;
    const relPath = filename.replace(/\\/g, '/');
    if (eventType === 'rename') {
      try {
        await fs.stat(path.join(localRoot, relPath));
        await uploadFile(taskId, localRoot, relPath);
      } catch {
        await deleteFile(taskId, relPath);
      }
    } else if (eventType === 'change') {
      await uploadFile(taskId, localRoot, relPath);
    }
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
