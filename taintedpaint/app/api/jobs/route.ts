// file: api/jobs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs, createWriteStream } from "fs";
import { Readable } from "stream";
import Busboy from "busboy";
import { renameWithFallback } from "@/lib/fileUtils";
import os from "os";
import path from "path";
import type { BoardData, Task } from "@/types";
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns";
import { readBoardData, updateBoardData } from "@/lib/boardDataStore";
import { invalidateFilesCache } from "@/lib/filesCache";
import { STORAGE_ROOT, TASKS_STORAGE_DIR, TASKS_DIR_NAME } from "@/lib/storagePaths";

// --- Path Definitions ---
// Files are stored on a shared network disk. Configure the root path with the
// SMB_ROOT environment variable. Defaults to the local `storage` folder for
// development.
// `TASKS_STORAGE_DIR` is exported from `lib/storagePaths`.
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
          updatedAt: t.updatedAt,
        },
      ])
    );
    return NextResponse.json({ tasks: tasksSummary, columns: boardData.columns });
  }
  return NextResponse.json(boardData);
}

// POST: Creates a new job with folder support

export async function POST(req: NextRequest) {
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const busboy = Busboy({ headers });

    const tempFiles: string[] = [];
    const pendingWrites: Promise<void>[] = [];
    const filePaths: string[] = [];
    const fields: Record<string, string> = {};

    busboy.on('file', (_name: string, file: NodeJS.ReadableStream) => {
      const tempPath = path.join(
        os.tmpdir(),
        `upload-${Date.now()}-${tempFiles.length}`
      );
      const writer = createWriteStream(tempPath);
      tempFiles.push(tempPath);
      pendingWrites.push(
        new Promise<void>((resolve, reject) => {
          file.pipe(writer);
          file.on('error', reject);
          writer.on('finish', resolve);
          writer.on('error', reject);
        })
      );
    });

    busboy.on('field', (name: string, val: string) => {
      if (name === 'filePaths') {
        filePaths.push(val);
      } else {
        fields[name] = val;
      }
    });

    await new Promise<void>((resolve, reject) => {
      busboy.on('finish', resolve);
      busboy.on('error', reject);
      Readable.fromWeb(req.body as any).pipe(busboy);
    });
    await Promise.all(pendingWrites);

    const {
      customerName = '',
      representative = '',
      inquiryDate = '',
      deliveryDate = '',
      ynmxId = '',
      notes = '',
      folderName = '',
    } = fields;

    if (
      tempFiles.length === 0 ||
      !customerName ||
      !representative ||
      !inquiryDate ||
      !folderName
    ) {
      return NextResponse.json(
        { error: 'Missing required fields or folder' },
        { status: 400 }
      );
    }

    const taskId = Date.now().toString();
    const taskDirectoryPath = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.mkdir(taskDirectoryPath, { recursive: true });

    const rootPrefix = folderName.replace(/[/\\]+$/, '') + '/';

    for (let i = 0; i < tempFiles.length; i++) {
      const rawPath = filePaths[i];
      if (!rawPath) continue;
      const relativePath = rawPath.startsWith(rootPrefix)
        ? rawPath.slice(rootPrefix.length)
        : rawPath;
      const safeRelativePath = path
        .normalize(relativePath)
        .replace(/^(\.\.[\/\\])+/, '');
      if (safeRelativePath.includes('..')) continue;
      const destinationPath = path.join(taskDirectoryPath, safeRelativePath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await renameWithFallback(tempFiles[i], destinationPath);
    }

    const newTask: Task = {
      id: taskId,
      columnId: START_COLUMN_ID,
      customerName: customerName.trim(),
      representative: representative.trim(),
      inquiryDate: inquiryDate.trim(),
      deliveryDate: deliveryDate.trim() || undefined,
      notes: notes.trim(),
      ynmxId: ynmxId.trim() || undefined,
      // Store the relative path inside the SMB share so clients can resolve it
      // using their own mounted location.
      taskFolderPath: `${TASKS_DIR_NAME}/${taskId}`,
      files: [folderName],
      deliveryNoteGenerated: false,
      awaitingAcceptance: false,
      updatedAt: new Date().toISOString(),
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