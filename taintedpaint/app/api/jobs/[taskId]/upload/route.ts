// src/app/api/jobs/[taskId]/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";
import { writeJsonAtomic } from "@/lib/fileUtils";

// --- Path Definitions ---
const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json");
// ------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const paths = formData.getAll("paths") as string[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    const newlyAddedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = paths[i] || file.name;

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

    const rawMeta = await fs.readFile(META_FILE, "utf-8");
    const boardData: BoardData = JSON.parse(rawMeta);

    const taskToUpdate = boardData.tasks[taskId];
    if (!taskToUpdate) {
      throw new Error("Task not found in metadata");
    }

    // --- IMPROVEMENT: Append new files instead of re-reading the directory ---
    if (!taskToUpdate.files) {
      taskToUpdate.files = [];
    }
    taskToUpdate.files.push(...newlyAddedFiles);
    // ----------------------------------------------------------------------

    await writeJsonAtomic(META_FILE, boardData);

    return NextResponse.json(taskToUpdate);
  } catch (err) {
    console.error(`Failed to upload files for task ${taskId}:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}