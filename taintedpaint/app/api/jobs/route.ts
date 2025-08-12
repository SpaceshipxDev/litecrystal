// file: api/jobs/route.ts

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import type { BoardData, Task } from "@/types";
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns";
import { readBoardData, updateBoardData } from "@/lib/boardDataStore";
import { invalidateFilesCache } from "@/lib/filesCache";
import { STORAGE_ROOT } from "@/lib/storagePaths";

// --- Path Definitions ---
// Files live on a shared network disk. Configure the root path with the
// SMB_ROOT environment variable.
// ------------------------

// Legacy helper removed in favour of boardDataStore

// GET: Returns the board data. If `?summary=1` is passed only lightweight
// task information is returned.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const summary = url.searchParams.get('summary') === '1';
  const boardData = await readBoardData();
  if (summary) {
    const tasksSummary = Object.fromEntries(
      Object.entries(boardData.tasks).map(([id, t]) => [
        id,
        {
          id: t.id,
          columnId: t.columnId,
          previousColumnId: t.previousColumnId,
          customerName: t.customerName,
          representative: t.representative,
          inquiryDate: t.inquiryDate,
          deliveryDate: t.deliveryDate,
          notes: t.notes,
          ynmxId: t.ynmxId,
          deliveryNoteGenerated: t.deliveryNoteGenerated,
          awaitingAcceptance: t.awaitingAcceptance,
          archivedAt: t.archivedAt,
          updatedAt: t.updatedAt,
          updatedBy: t.updatedBy,
        },
      ])
    );
    return NextResponse.json({ tasks: tasksSummary, columns: boardData.columns });
  }
  return NextResponse.json(boardData);
}

// POST: Creates a new job and provisions a folder on the SMB share

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerName = (formData.get("customerName") as string | null) || "";
    const representative = (formData.get("representative") as string | null) || "";
    const inquiryDate = (formData.get("inquiryDate") as string | null) || "";
    const deliveryDate = (formData.get("deliveryDate") as string | null) || "";
    const ynmxId = (formData.get("ynmxId") as string | null) || "";
    const notes = (formData.get("notes") as string | null) || "";
    const updatedBy = (formData.get("updatedBy") as string | null) || "";

    const taskId = Date.now().toString();
    const taskFolderPath = taskId; // store relative to SMB root

    // Ensure the task directory exists on the shared drive
    const absoluteTaskPath = path.join(STORAGE_ROOT, taskFolderPath);
    await fs.mkdir(absoluteTaskPath, { recursive: true });

    const now = new Date().toISOString();
    const newTask: Task = {
      id: taskId,
      columnId: START_COLUMN_ID,
      customerName: customerName.trim() || undefined,
      representative: representative.trim() || undefined,
      inquiryDate: inquiryDate.trim() || undefined,
      deliveryDate: deliveryDate.trim() || undefined,
      notes: notes.trim() || undefined,
      ynmxId: ynmxId.trim() || undefined,
      taskFolderPath,
      files: [],
      deliveryNoteGenerated: false,
      awaitingAcceptance: false,
      updatedAt: now,
      updatedBy: updatedBy.trim() || undefined,
      history: updatedBy
        ? [{ user: updatedBy, timestamp: now, description: '创建任务' }]
        : [],
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

    invalidateFilesCache(taskId);

    return NextResponse.json(newTask);
  } catch (err) {
    console.error('Failed to create job:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb'
    }
  }
};