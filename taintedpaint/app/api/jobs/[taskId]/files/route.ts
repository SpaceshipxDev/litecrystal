// src/app/api/jobs/[taskId]/files/route.ts (in your Next.js project)

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const TASKS_STORAGE_DIR = path.join(process.cwd(), "public", "storage", "tasks");

// A list of common system files to ignore. You can add more if you find them.
const ignoredFiles = ['.DS_Store', 'Thumbs.db'];

// This is our recursive helper function
async function getFilesRecursively(directory: string, basePath: string): Promise<{ filename: string, relativePath: string, url: string }[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  let fileList: { filename:string, relativePath:string, url:string }[] = [];

  for (const entry of entries) {
    // ** THIS IS THE FIX **
    // If the filename is in our ignore list, skip it and continue to the next one.
    if (ignoredFiles.includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await getFilesRecursively(fullPath, basePath);
      fileList = fileList.concat(subFiles);
    } else if (entry.isFile()) {
      const relativePath = path.relative(basePath, fullPath);

      // --- PROACTIVE IMPROVEMENT ---
      // To handle all special characters (like #, ?, etc.) safely in URLs,
      // we should encode each part of the path separately.
      const urlPathParts = relativePath.split(path.sep).map(part => encodeURIComponent(part));
      const encodedRelativePath = urlPathParts.join('/');
      
      const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/storage/tasks/${path.basename(basePath)}/${encodedRelativePath}`;

      fileList.push({
        filename: entry.name,
        relativePath: relativePath,
        url: url
      });
    }
  }
  return fileList;
}

// The GET handler function remains the same, it just calls our improved helper
export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    const files = await getFilesRecursively(taskDirectoryPath, taskDirectoryPath);
    return NextResponse.json(files);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json([]);
    }
    console.error(`Failed to list files for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}