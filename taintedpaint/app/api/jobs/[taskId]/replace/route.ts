import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { updateBoardData } from '@/lib/boardDataStore';
import { invalidateFilesCache } from '@/lib/filesCache';
import { TASKS_STORAGE_DIR } from '@/lib/storagePaths';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const paths = formData.getAll('paths') as string[];
    const folderName = formData.get('folderName') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const taskDir = path.join(TASKS_STORAGE_DIR, taskId);
    await fs.rm(taskDir, { recursive: true, force: true });
    await fs.mkdir(taskDir, { recursive: true });

    const rootPrefix = folderName ? folderName.replace(/[/\\]+$/, '') + '/' : '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPathRaw = paths[i] || file.name;
      const rel = rootPrefix && relPathRaw.startsWith(rootPrefix)
        ? relPathRaw.slice(rootPrefix.length)
        : relPathRaw;
      const safeRelPath = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(taskDir, safeRelPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buf);
    }

    let updatedTask: any;
    await updateBoardData(async data => {
      const t = data.tasks[taskId];
      if (!t) throw new Error('Task not found');
      t.files = folderName ? [folderName] : [];
      updatedTask = t;
    });

    invalidateFilesCache(taskId);

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to replace files for task ${taskId}:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb'
    }
  }
};
