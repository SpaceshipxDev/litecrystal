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
      updatedBy,
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
    if (updatedBy !== undefined && typeof updatedBy !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let updatedTask: BoardData['tasks'][string] | undefined;
    await updateBoardData(async data => {
      const t = data.tasks[taskId];
      if (!t) throw new Error('Task not found');
      const changes: string[] = [];
      if (typeof customerName === 'string' && customerName.trim() !== t.customerName) {
        t.customerName = customerName.trim();
        changes.push('更新客户名称');
      }
      if (typeof representative === 'string' && representative.trim() !== t.representative) {
        t.representative = representative.trim();
        changes.push('更新负责人');
      }
      if (typeof ynmxId === 'string') {
        const trimmed = ynmxId.trim();
        if (trimmed !== (t.ynmxId || '')) {
          t.ynmxId = trimmed || undefined;
          changes.push(`将编号改为 ${trimmed || '空'}`);
        }
      } else if (ynmxId === null && t.ynmxId) {
        t.ynmxId = undefined;
        changes.push('清除编号');
      }
      if (typeof inquiryDate === 'string' && inquiryDate !== t.inquiryDate) {
        t.inquiryDate = inquiryDate;
        changes.push(`将询价日期改为 ${inquiryDate}`);
      }
      if (typeof deliveryDate === 'string' && deliveryDate !== t.deliveryDate) {
        t.deliveryDate = deliveryDate;
        changes.push(`将交期改为 ${deliveryDate}`);
      }
      if (typeof notes === 'string' && notes.trim() !== t.notes) {
        t.notes = notes.trim();
        changes.push('更新备注');
      }
      t.updatedAt = new Date().toISOString();
      if (typeof updatedBy === 'string') {
        t.updatedBy = updatedBy.trim();
      }
      if (changes.length && updatedBy) {
        const historyEntry = {
          user: updatedBy.trim(),
          timestamp: t.updatedAt,
          description: changes.join('；'),
        };
        t.history = [...(t.history || []), historyEntry];
      }
      updatedTask = t;
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error(`Failed to update task ${taskId}:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
