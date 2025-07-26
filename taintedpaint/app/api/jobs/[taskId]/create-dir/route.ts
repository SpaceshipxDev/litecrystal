import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { sanitizeRelativePath } from '@/lib/pathUtils.mjs'

// Use storage directory at the repository root
const TASKS_STORAGE_DIR = path.join(process.cwd(), '..', 'storage', 'tasks')

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  if (!taskId) return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })

  try {
    const { relativePath } = await req.json()
    if (!relativePath) {
      return NextResponse.json({ error: 'relativePath required' }, { status: 400 })
    }
    let safeRel
    try {
      safeRel = sanitizeRelativePath(relativePath)
    } catch {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const dirPath = path.join(TASKS_STORAGE_DIR, taskId, safeRel)
    await fs.mkdir(dirPath, { recursive: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('create-dir error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
