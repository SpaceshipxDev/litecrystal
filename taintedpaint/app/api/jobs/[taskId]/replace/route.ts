import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { updateBoardData } from '@/lib/boardDataStore';
import { invalidateFilesCache } from '@/lib/filesCache';
import { STORAGE_ROOT } from '@/lib/storagePaths';

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
    const folderPath = formData.get('folderPath') as string | null;
    const updatedBy = formData.get('updatedBy') as string | null;

    if (!folderPath) {
      return NextResponse.json({ error: 'No folder path provided' }, { status: 400 });
    }

    // Normalise path relative to SMB root if possible
    const normalisedRoot = path.normalize(STORAGE_ROOT);
    const normalisedFolder = path.normalize(folderPath);
    const relativePath =
      path.isAbsolute(normalisedFolder) && normalisedFolder.startsWith(normalisedRoot)
        ? path.relative(normalisedRoot, normalisedFolder)
        : folderPath;

    let updatedTask: any;
    await updateBoardData(async data => {
      const t = data.tasks[taskId];
      if (!t) throw new Error('Task not found');
      t.taskFolderPath = relativePath;
      t.files = [];
      t.updatedAt = new Date().toISOString();
      if (updatedBy) {
        t.updatedBy = updatedBy;
        const entry = { user: updatedBy, timestamp: t.updatedAt, description: '替换文件夹' };
        t.history = [...(t.history || []), entry];
      }
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
