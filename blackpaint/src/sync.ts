import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import chokidar, { FSWatcher } from 'chokidar';

const sanitizePart = (p: string) =>
  process.platform === 'win32'
    ? p.replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/, '')
    : p;

const sanitizeRelPath = (relPath: string) =>
  relPath
    .split(/[/\\]/)
    .map((part) => sanitizePart(part))
    .join(path.sep);

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.5.107:3000';

interface RemoteFile {
  filename: string;
  relativePath: string;
  url: string;
  mtimeMs: number;
  isDir?: boolean;
}

const IGNORED_NAMES = ['.DS_Store', 'Thumbs.db'];
const IGNORED_EXTS = ['.lck', '.bak'];

function isIgnored(name: string): boolean {
  return (
    IGNORED_NAMES.includes(name) ||
    IGNORED_EXTS.includes(path.extname(name).toLowerCase()) ||
    name.startsWith('~$') ||
    name.startsWith('$')
  );
}

async function listLocalFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (isIgnored(entry.name)) continue;
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

// Each active sync keeps its own pending upload list so files don't leak
// between tasks when retries occur.
const activeSyncs = new Map<string, {
  watcher: FSWatcher;
  interval: ReturnType<typeof setInterval>;
  pendingUploads: Set<string>;
  localRoot: string;
}>();
const pendingWrites = new Set<string>();

// Simple helper to upload or update a file
async function uploadFile(
  taskId: string,
  localRoot: string,
  relPath: string,
  pendingUploads: Set<string>,
) {
  const fullPath = path.join(localRoot, relPath);
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    return;
  }
  if (!stat.isFile()) return;
  pendingUploads.add(fullPath);

  let file: Buffer;
  try {
    file = await fs.readFile(fullPath);
  } catch (err) {
    console.error('Failed to read file', err);
    return; // keep in pendingUploads for retry
  }

  const form = new FormData();
  form.append('files', new Blob([file]));
  form.append('paths', relPath);

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

async function createDir(taskId: string, relPath: string) {
  try {
    await fetch(`${BASE_URL}/api/jobs/${taskId}/create-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: relPath }),
    });
  } catch (err) {
    console.error('Failed to create dir', err);
  }
}

async function deleteDir(taskId: string, relPath: string) {
  try {
    await fetch(`${BASE_URL}/api/jobs/${taskId}/delete-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: relPath }),
    });
  } catch (err) {
    console.error('Failed to delete dir', err);
  }
}

async function pullFromServer(
  taskId: string,
  localRoot: string,
  pendingUploads: Set<string>,
) {
  try {
    const res = await axios.get<RemoteFile[]>(`${BASE_URL}/api/jobs/${taskId}/files`);
    const files = res.data;
    for (const file of files) {
      const sanitizedRel = sanitizeRelPath(file.relativePath);
      const localPath = path.join(localRoot, sanitizedRel);
      if (file.isDir) {
        await fs.mkdir(localPath, { recursive: true });
        continue;
      }
      let stat;
      try {
        stat = await fs.stat(localPath);
      } catch {
        stat = null;
      }
      if (!stat || stat.mtimeMs < file.mtimeMs) {
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        const response = await axios.get(file.url, { responseType: 'stream', timeout: 0 });
        pendingWrites.add(localPath);
        try {
          await new Promise<void>((resolve, reject) => {
            const writer = createWriteStream(localPath);
            response.data.pipe(writer);
            response.data.on('error', reject);
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
        } catch (err) {
          console.error('Failed to write file', err);
        }
        pendingWrites.delete(localPath);
      }
    }
    const remoteSet = new Set(
      files.map(f => path.join(localRoot, sanitizeRelPath(f.relativePath)))
    );
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
      await uploadFile(taskId, localRoot, relPath, pendingUploads);
    }
  } catch (err) {
    console.error('sync pull error', err);
  }
}

export function startBidirectionalSync(taskId: string, localRoot: string) {
  if (activeSyncs.has(taskId)) return;

  const pendingUploads = new Set<string>();

  // initial pull
  pullFromServer(taskId, localRoot, pendingUploads);

  const watcher = chokidar.watch(localRoot, {
    persistent: true,
    ignoreInitial: true,
    ignored: (p) => isIgnored(path.basename(p)),
  });

  const toRel = (fullPath: string) =>
    path.relative(localRoot, fullPath).replace(/\\/g, '/');

  const shouldSkip = (p: string) => {
    const name = path.basename(p);
    if (isIgnored(name)) return true;
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
      await uploadFile(taskId, localRoot, relPath, pendingUploads);
    })
    .on('change', async (filePath) => {
      if (shouldSkip(filePath)) return;
      const relPath = toRel(filePath);
      await uploadFile(taskId, localRoot, relPath, pendingUploads);
    })
    .on('unlink', async (filePath) => {
      if (shouldSkip(filePath)) return;
      const relPath = toRel(filePath);
      await deleteFile(taskId, relPath);
    })
    .on('addDir', async (dirPath) => {
      if (shouldSkip(dirPath)) return;
      const relPath = toRel(dirPath);
      await createDir(taskId, relPath);
    })
    .on('unlinkDir', async (dirPath) => {
      if (shouldSkip(dirPath)) return;
      const relPath = toRel(dirPath);
      await deleteDir(taskId, relPath);
    });

  const interval = setInterval(
    () => pullFromServer(taskId, localRoot, pendingUploads),
    10000,
  );
  activeSyncs.set(taskId, { watcher, interval, pendingUploads, localRoot });
}

export function stopAllSyncs() {
  for (const { watcher, interval } of activeSyncs.values()) {
    watcher.close();
    clearInterval(interval);
  }
  activeSyncs.clear();
}

export function getSyncPath(taskId: string): string | undefined {
  return activeSyncs.get(taskId)?.localRoot;
}
