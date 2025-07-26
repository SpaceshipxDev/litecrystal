import { NextRequest, NextResponse } from 'next/server';
import { updateBoardData } from '@/lib/boardDataStore';
import type { BoardData } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  try {
    const {
      customerName,
      representative,
      ynmxId,
      inquiryDate,
      deliveryDate,
      notes,
    } = await req.json();
    if (customerName !== undefined && typeof customerName !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (representative !== undefined && typeof representative !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (ynmxId !== undefined && typeof ynmxId !== 'string' && ynmxId !== null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (inquiryDate !== undefined && typeof inquiryDate !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
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
      if (typeof customerName === 'string') t.customerName = customerName.trim();
      if (typeof representative === 'string') t.representative = representative.trim();
      if (typeof ynmxId === 'string') {
        t.ynmxId = ynmxId.trim() || undefined;
      } else if (ynmxId === null) {
        t.ynmxId = undefined;
      }
      if (typeof inquiryDate === 'string') t.inquiryDate = inquiryDate;
      if (typeof deliveryDate === 'string') t.deliveryDate = deliveryDate;
      if (typeof notes === 'string') t.notes = notes.trim();
      updatedTask = t;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to update task ${taskId}:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
