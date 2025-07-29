import { NextRequest, NextResponse } from 'next/server'
import { readBoardData } from '@/lib/boardDataStore'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  const boardData = await readBoardData()
  const task = boardData.tasks[taskId]
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }
  return NextResponse.json(task)
}
