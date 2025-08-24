// src/app/api/jobs/[taskId]/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData } from "@/types";
import { updateBoardData, readBoardData } from "@/lib/boardDataStore";
import { invalidateFilesCache } from "@/lib/filesCache";
import { STORAGE_ROOT } from "@/lib/storagePaths";

// Accepts uploaded files and writes them to the SMB share. Paths stored in the
// task metadata are relative to `STORAGE_ROOT`.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  let taskDir = "";
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const updatedBy = formData.get("updatedBy") as string | null;

    const boardData = await readBoardData();
    const task = boardData.tasks[taskId];
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    taskDir = path.join(STORAGE_ROOT, task.taskFolderPath || taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const relativePaths: string[] = [];
    for (const file of files) {
      const relative = file.name;
      const dest = path.join(taskDir, relative);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(dest, Buffer.from(arrayBuffer));
      relativePaths.push(relative);
    }

    let updatedTask: BoardData["tasks"][string] | undefined;
    await updateBoardData(async (data) => {
      const t = data.tasks[taskId];
      if (!t) throw new Error("Task not found in metadata");

      t.taskFolderPath = t.taskFolderPath || taskId;
      t.files = [...(t.files || []), ...relativePaths];
      t.updatedAt = new Date().toISOString();
      if (updatedBy) {
        t.updatedBy = updatedBy;
        const entry = { user: updatedBy, timestamp: t.updatedAt, description: '上传文件' };
        t.history = [...(t.history || []), entry];
      }
      updatedTask = t;
    });

    invalidateFilesCache(taskId);

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to upload files for task ${taskId}:`, err);

    if (taskDir) {
      try {
        await fs.rm(taskDir, { recursive: true, force: true });
      } catch (e) {
        console.error(`Failed to remove folder for task ${taskId}:`, e);
      }
    }

    try {
      await updateBoardData(async (data) => {
        delete data.tasks[taskId];
        for (const col of data.columns) {
          const idx = col.taskIds.indexOf(taskId);
          if (idx !== -1) col.taskIds.splice(idx, 1);
        }
      });
    } catch (e) {
      console.error(`Failed to remove task ${taskId} from metadata:`, e);
    }

    invalidateFilesCache(taskId);

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