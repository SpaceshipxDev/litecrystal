// src/app/api/jobs/[taskId]/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import type { BoardData } from "@/types";
import { updateBoardData, readBoardData } from "@/lib/boardDataStore";
import { invalidateFilesCache } from "@/lib/filesCache";

// Files are referenced directly from the shared SMB disk. No file data is
// uploaded; we only record the provided paths in the task metadata.

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
    const paths = formData.getAll("paths") as string[];
    const updatedBy = formData.get("updatedBy") as string | null;

    const boardData = await readBoardData();
    if (!boardData.tasks[taskId]) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!paths || paths.length === 0) {
      return NextResponse.json({ error: "No paths provided" }, { status: 400 });
    }

    let updatedTask: BoardData["tasks"][string] | undefined;
    await updateBoardData(async (data) => {
      const t = data.tasks[taskId];
      if (!t) throw new Error("Task not found in metadata");

      if (!t.files) {
        t.files = [];
      }
      t.files.push(...paths);
      t.updatedAt = new Date().toISOString();
      if (updatedBy) {
        t.updatedBy = updatedBy;
        const entry = { user: updatedBy, timestamp: t.updatedAt, description: '引用文件' };
        t.history = [...(t.history || []), entry];
      }
      updatedTask = t;
    });

    invalidateFilesCache(taskId);

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