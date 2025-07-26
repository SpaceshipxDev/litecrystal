import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { baseColumns } from './baseColumns'
import type { BoardData } from '@/types'

// Store dynamic data outside of the public directory so it remains
// accessible when running `npm run build && npm run start`.
const STORAGE_DIR = path.join(process.cwd(), '..', 'storage')
const META_FILE = path.join(STORAGE_DIR, 'metadata.json')
const LOCK_FILE = META_FILE + '.lock'

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function readBoardData(): Promise<BoardData> {
  await ensureStorageDir()
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8')
    const data = JSON.parse(raw)
    if (data.tasks && data.columns) return data
    throw new Error('Invalid metadata format')
  } catch {
    return { tasks: {}, columns: baseColumns }
  }
}

export async function updateBoardData(
  updater: (data: BoardData) => void | Promise<void>
): Promise<BoardData> {
  await ensureStorageDir()
  // simple lock using a temp file
  while (true) {
    try {
      const fd = await fs.open(LOCK_FILE, 'wx')
      await fd.close()
      break
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        await sleep(50)
        continue
      }
      throw err
    }
  }

  try {
    const data = await readBoardData()
    await updater(data)

    const tempPath = `${META_FILE}.${randomUUID()}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
    await fs.rename(tempPath, META_FILE)

    return data
  } finally {
    await fs.unlink(LOCK_FILE).catch(() => {})
  }
}
