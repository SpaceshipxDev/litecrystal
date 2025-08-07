import { NextRequest, NextResponse } from 'next/server';
import { updateBoardData } from '@/lib/boardDataStore';
import type { BoardData } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  try {
    const {
      customerName,
      representative,
      ynmxId,
      inquiryDate,
      deliveryDate,
      notes,
      userName,
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
      const timestamp = new Date().toISOString();
      const history: any[] = [];
      if (typeof customerName === 'string' && customerName.trim() !== t.customerName) {
        t.customerName = customerName.trim();
        history.push({ user: userName, action: `将客户名称修改为 ${t.customerName}`, timestamp });
      }
      if (typeof representative === 'string' && representative.trim() !== t.representative) {
        t.representative = representative.trim();
        history.push({ user: userName, action: `将负责人修改为 ${t.representative}`, timestamp });
      }
      if (typeof ynmxId === 'string' && ynmxId.trim() !== (t.ynmxId || '')) {
        t.ynmxId = ynmxId.trim() || undefined;
        history.push({ user: userName, action: `将YNMX号修改为 ${ynmxId.trim()}`, timestamp });
      } else if (ynmxId === null && t.ynmxId) {
        t.ynmxId = undefined;
        history.push({ user: userName, action: `清除YNMX号`, timestamp });
      }
      if (typeof inquiryDate === 'string' && inquiryDate !== t.inquiryDate) {
        t.inquiryDate = inquiryDate;
        history.push({ user: userName, action: `将询价日期修改为 ${inquiryDate}`, timestamp });
      }
      if (typeof deliveryDate === 'string' && deliveryDate !== t.deliveryDate) {
        t.deliveryDate = deliveryDate;
        history.push({ user: userName, action: `将交货日期修改为 ${deliveryDate}`, timestamp });
      }
      if (typeof notes === 'string' && notes.trim() !== t.notes) {
        t.notes = notes.trim();
        history.push({ user: userName, action: `修改备注`, timestamp });
      }
      if (history.length && userName) {
        t.history = t.history ? [...history, ...t.history] : history;
      }
      t.updatedAt = timestamp;
      updatedTask = t;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to update task ${taskId}:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
