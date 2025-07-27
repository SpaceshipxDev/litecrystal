// src/app/api/jobs/[taskId]/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";
import { updateBoardData, readBoardData } from "@/lib/boardDataStore";

// --- Path Definitions ---
// Root-level storage directory keeps dynamic data accessible in production
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
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const paths = formData.getAll("paths") as string[];

    const boardData = await readBoardData();
    if (!boardData.tasks[taskId]) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    const newlyAddedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPathRaw = paths[i] || file.name;
      const relPath = relPathRaw;

      if (path.isAbsolute(relPath)) {
        return NextResponse.json({ error: "Paths must be relative" }, { status: 400 });
      }

      const safeRelPath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(taskDirectoryPath, safeRelPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buf);
      newlyAddedFiles.push(safeRelPath);
    }

    let updatedTask: BoardData["tasks"][string] | undefined;
    await updateBoardData(async (boardData) => {
      const taskToUpdate = boardData.tasks[taskId];
      if (!taskToUpdate) throw new Error("Task not found in metadata");

      if (!taskToUpdate.files) {
        taskToUpdate.files = [];
      }
      taskToUpdate.files.push(...newlyAddedFiles);
      updatedTask = taskToUpdate;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to upload files for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb'
    }
  }
};