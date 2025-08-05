import { NextRequest, NextResponse } from 'next/server';
import { readBoardData, updateBoardData } from '@/lib/boardDataStore';
import { STORAGE_ROOT } from '@/lib/storagePaths';
import path from 'path';
import { spawn } from 'child_process';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    const board = await readBoardData();
    const task = board.tasks[taskId];
    if (!task || !task.taskFolderPath) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const folderPath = path.join(STORAGE_ROOT, task.taskFolderPath);
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_delivery_note.py');

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'python',
        [
          scriptPath,
          folderPath,
          task.customerName || '',
          task.representative || '',
          task.ynmxId || '',
          '系统自动',
        ],
        { stdio: 'inherit' }
      );
      proc.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`Python script exited with code ${code}`));
      });
    });

    await updateBoardData(data => {
      const t = data.tasks[taskId];
      if (t) t.deliveryNoteGenerated = true;
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to generate delivery note', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
