// src/app/api/jobs/[taskId]/files/route.ts (in your Next.js project)

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCachedFiles, setCachedFiles } from "@/lib/filesCache";
import { readBoardData } from "@/lib/boardDataStore";
import { STORAGE_ROOT } from "@/lib/storagePaths";

// Files are served from the shared disk defined by `SMB_ROOT`.
// A list of common system and temporary files to ignore
const ignoredFiles = ['.DS_Store', 'Thumbs.db'];
const ignoredExtensions = ['.lck', '.bak'];

// This is our recursive helper function
type FileInfo = {
  filename: string;
  relativePath: string;
  url: string;
  mtimeMs: number;
  sizeBytes: number;
  isDir?: boolean;
};

async function getFilesRecursively(
  directory: string,
  basePath: string,
  rootRelative: string,
  baseUrl: string
): Promise<FileInfo[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  let fileList: FileInfo[] = [];

  for (const entry of entries) {
    if (ignoredFiles.includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await getFilesRecursively(fullPath, basePath, rootRelative, baseUrl);
        fileList = fileList.concat(subFiles);
      } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ignoredExtensions.includes(ext)) continue;
      const relativePath = path.relative(basePath, fullPath);
      const stats = await fs.stat(fullPath);

      // Encode each path segment to produce a safe URL rooted at the SMB share.
      const combined = path.join(rootRelative, relativePath);
      const urlPathParts = combined.split(path.sep).map(part => encodeURIComponent(part));
      const url = `${baseUrl}/storage/${urlPathParts.join('/')}`;

      fileList.push({
        filename: entry.name,
        relativePath,
        url,
        mtimeMs: stats.mtimeMs,
        sizeBytes: stats.size,
      });
    }
  }
  return fileList;
}

// The GET handler function remains the same, it just calls our improved helper
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const board = await readBoardData();
    const task = board.tasks[taskId];
    if (!task || !task.taskFolderPath) {
      return NextResponse.json({ error: 'Task files missing' }, { status: 404 });
    }

    const rootPath = path.normalize(STORAGE_ROOT);
    const taskPath = path.normalize(
      path.isAbsolute(task.taskFolderPath)
        ? task.taskFolderPath
        : path.join(STORAGE_ROOT, task.taskFolderPath)
    );

    if (!taskPath.startsWith(rootPath)) {
      return NextResponse.json({ error: 'Task files missing' }, { status: 404 });
    }

    const cached = getCachedFiles(taskId);
    if (cached) {
      return NextResponse.json(cached);
    }

    const urlFromRequest = new URL(req.url);
    const host = req.headers.get('host');
    const baseUrl = host
      ? `${urlFromRequest.protocol}//${host}`
      : process.env.NEXT_PUBLIC_APP_URL || urlFromRequest.origin;

    const relativeRoot = path.relative(rootPath, taskPath);

    const files = await getFilesRecursively(
      taskPath,
      taskPath,
      relativeRoot,
      baseUrl
    );

    setCachedFiles(taskId, files);

    return NextResponse.json(files);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Task files missing' }, { status: 404 });
    }
    console.error(`Failed to list files for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
