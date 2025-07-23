import { NextRequest, NextResponse } from 'next/server';
import { updateBoardData } from '@/lib/boardDataStore';
import type { BoardData } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = await params;
  try {
    const { deliveryDate, notes } = await req.json();
    if (deliveryDate !== undefined && typeof deliveryDate !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let updatedTask: BoardData['tasks'][string] | undefined;
    await updateBoardData(async data => {
      const t = data.tasks[taskId];
      if (!t) throw new Error('Task not found');
      if (typeof deliveryDate === 'string') t.deliveryDate = deliveryDate;
      if (typeof notes === 'string') t.notes = notes;
      updatedTask = t;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to update task ${taskId}:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
