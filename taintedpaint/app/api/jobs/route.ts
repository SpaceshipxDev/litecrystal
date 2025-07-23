// file: api/jobs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData, Task } from "@/types";
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns";
import { readBoardData, updateBoardData } from "@/lib/boardDataStore";

// --- Path Definitions ---
const STORAGE_DIR = path.join(process.cwd(), "public", "storage");
const TASKS_STORAGE_DIR = path.join(STORAGE_DIR, "tasks");
const META_FILE = path.join(STORAGE_DIR, "metadata.json");
// ------------------------

// Legacy helper removed in favour of boardDataStore

// GET: Returns the entire board data object (no changes)
export async function GET() {
  const boardData = await readBoardData();
  return NextResponse.json(boardData);
}

// POST: Creates a new job with folder support

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const files = formData.getAll("files") as File[];
    const filePaths = formData.getAll("filePaths") as string[];
    const customerName = formData.get("customerName") as string;
    const representative = formData.get("representative") as string;
    const inquiryDate = formData.get("inquiryDate") as string;
    const notes = formData.get("notes") as string;

    // deliveryDate is optional on creation
    const deliveryDate = "";
    
    // --- ADD THIS LINE ---
    // Get the folder name sent from the frontend.
    const folderName = formData.get("folderName") as string;
    // ---------------------

    if (
      files.length === 0 ||
      !customerName ||
      !representative ||
      !inquiryDate ||
      !folderName // Add validation for the folder name
    ) {
      return NextResponse.json(
        { error: "Missing required fields or folder" },
        { status: 400 }
      );
    }

    const taskId = Date.now().toString();
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    // This file saving logic is still correct and necessary to build the directory
    // strip the uploaded root folder name from each path
    const rootPrefix = folderName.replace(/[/\\]+$/, '') + '/';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawPath = filePaths[i];
      // remove the leading folderName/ if present
      const relativePath = rawPath.startsWith(rootPrefix)
        ? rawPath.slice(rootPrefix.length)
        : rawPath;
      const safeRelativePath = path
        .normalize(relativePath)
        .replace(/^(\.\.[\/\\])+/, '');
      if (safeRelativePath.includes('..')) continue;
      const destinationPath = path.join(taskDirectoryPath, safeRelativePath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(destinationPath, buf);
    }

    const newTask: Task = {
      id: taskId,
      columnId: START_COLUMN_ID,
      customerName: customerName.trim(),
      representative: representative.trim(),
      inquiryDate: inquiryDate.trim(),
      deliveryDate,
      notes: notes.trim(),
      taskFolderPath: `/storage/tasks/${taskId}`,
      // --- CHANGE THIS LINE ---
      // Instead of the detailed list, just store the root folder name.
      files: [folderName], 
      // ------------------------
    };

    await updateBoardData(async (boardData) => {
      boardData.tasks[taskId] = newTask;
      const startCol = boardData.columns.find((c) => c.id === START_COLUMN_ID);
      if (startCol) {
        startCol.taskIds.push(taskId);
      } else if (boardData.columns[0]) {
        boardData.columns[0].taskIds.push(taskId);
      }
    });

    return NextResponse.json(newTask);
  } catch (err) {
    console.error("Failed to create job:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Updates the entire board state (used for drag & drop, no changes)
export async function PUT(req: NextRequest) {
  try {
    const boardData = (await req.json()) as BoardData;
    if (!boardData.tasks || !boardData.columns) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await updateBoardData(async (data) => {
      data.tasks = boardData.tasks;
      data.columns = boardData.columns;
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update board:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}