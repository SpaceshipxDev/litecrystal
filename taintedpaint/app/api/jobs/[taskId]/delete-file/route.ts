import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";
import { updateBoardData } from "@/lib/boardDataStore";
import { sanitizeRelativePath } from "@/lib/pathUtils.mjs";

// --- Path Definitions ---
// Root-level storage directory keeps dynamic data outside of Next.js public
const STORAGE_DIR = path.join(process.cwd(), "..", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
// ------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const rawFilename = body.filename; // treat as relative path
    const filename = rawFilename;

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    let safeFilename: string;
    try {
      safeFilename = sanitizeRelativePath(filename);
    } catch {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    const filePath = path.join(taskDirectoryPath, safeFilename);

    // 1. Delete the file from the filesystem
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') { // If error is not "File Not Found", re-throw
        throw e;
      }
      // If file is not found, we can proceed as the goal is to remove it from metadata
      console.warn(`File to be deleted not found on disk, proceeding to update metadata: ${filePath}`);
    }

    let updatedTask: BoardData["tasks"][string] | undefined;
    await updateBoardData(async (boardData) => {
      const taskToUpdate = boardData.tasks[taskId];
      if (!taskToUpdate) throw new Error("Task not found in metadata");

      if (taskToUpdate.files) {
        taskToUpdate.files = taskToUpdate.files.filter((f) => f !== safeFilename);
      }

      updatedTask = taskToUpdate;
    });

    return NextResponse.json(updatedTask);

  } catch (err) {
    console.error(`Failed to delete file for task ${taskId}:`, err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}