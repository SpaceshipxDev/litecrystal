// src/app/api/jobs/[taskId]/update-file/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";
import { updateBoardData } from "@/lib/boardDataStore";
import { sanitizeRelativePath } from "@/lib/pathUtils.mjs";

// Root-level storage directory keeps dynamic data accessible in production
const STORAGE_DIR = path.join(process.cwd(), "..", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const newFile = formData.get("newFile") as File | null;
    const oldFilenameRaw = formData.get("oldFilename") as string | null;
    const relativePathRaw = formData.get("relativePath") as string | null;
    const oldFilename = oldFilenameRaw || null;
    const relativePath = relativePathRaw || null;
    if (!newFile || !oldFilename) {
      return NextResponse.json({ error: "Missing newFile or oldFilename" }, { status: 400 });
    }

    let safeRelativePath: string | undefined;
    if (relativePath) {
      try {
        safeRelativePath = sanitizeRelativePath(relativePath);
      } catch {
        return NextResponse.json({ error: "Invalid relativePath" }, { status: 400 });
      }
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    const oldFilePath = path.join(taskDirectoryPath, safeRelativePath || oldFilename);

    // --- FIX: Use a less restrictive regex that allows Unicode characters ---
    const sanitizedNewFilename = newFile.name.replace(/[\\/:*?"<>|]/g, '_');
    // ----------------------------------------------------------------------
    const newFilePath = path.join(
      taskDirectoryPath,
      safeRelativePath ? path.dirname(safeRelativePath) : '',
      sanitizedNewFilename
    );

    await fs.mkdir(taskDirectoryPath, { recursive: true });

    // Try to delete the old file
    try {
      await fs.unlink(oldFilePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') { throw e; }
      console.warn(`File to be updated not found, proceeding to add new file: ${oldFilePath}`);
    }

    // Write the new file
    const buf = Buffer.from(await newFile.arrayBuffer());
    await fs.writeFile(newFilePath, buf);

    let updatedTask: BoardData["tasks"][string] | undefined;
    await updateBoardData(async (boardData) => {
      const taskToUpdate = boardData.tasks[taskId];
      if (!taskToUpdate) throw new Error("Task not found in metadata");

      const newPath = safeRelativePath
        ? path.join(path.dirname(safeRelativePath), sanitizedNewFilename)
        : sanitizedNewFilename;
      const fileIndex = taskToUpdate.files?.indexOf(oldFilename);
      if (taskToUpdate.files && fileIndex !== undefined && fileIndex > -1) {
        taskToUpdate.files[fileIndex] = newPath;
      } else {
        taskToUpdate.files = [...(taskToUpdate.files || []), newPath];
      }
      updatedTask = taskToUpdate;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to update file for task ${taskId}:`, err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb'
    }
  }
};