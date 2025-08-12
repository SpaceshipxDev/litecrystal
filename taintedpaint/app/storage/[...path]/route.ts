import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/storagePaths'

// Serve files from the SMB storage root so clients always access the
// network share rather than the local server disk.
const STORAGE_DIR = STORAGE_ROOT

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts = [] } = await params
  const filePath = path.join(STORAGE_DIR, ...parts)
  const normalised = path.normalize(filePath)
  if (!normalised.startsWith(STORAGE_DIR)) {
    return new NextResponse('Invalid path', { status: 400 })
  }
  try {
    const data = await fs.readFile(normalised)
    // fs.readFile returns a Node Buffer which isn't directly accepted by
    // the NextResponse constructor's `BodyInit` type. Convert the buffer to
    // an ArrayBuffer so the Response can be constructed without type errors.
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer
    return new NextResponse(arrayBuffer)
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return new NextResponse('Not Found', { status: 404 })
    }
    console.error('file serve error', err)
    return new NextResponse('Server Error', { status: 500 })
  }
}
