import { mkdirSync } from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { baseColumns } from './baseColumns'
import type { BoardData } from '@/types'

// Store dynamic data outside of the public directory so it remains
// accessible when running `npm run build && npm run start`.
const STORAGE_DIR = path.join(process.cwd(), '..', 'storage')
const DB_PATH = path.join(STORAGE_DIR, 'board.sqlite')

mkdirSync(STORAGE_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS board_data (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  data TEXT NOT NULL
)`)

// Insert an empty board if DB is fresh
const existing = db.prepare('SELECT data FROM board_data WHERE id=1').get()
if (!existing) {
  const initial = JSON.stringify({ tasks: {}, columns: baseColumns })
  db.prepare('INSERT INTO board_data (id, data) VALUES (1, ?)').run(initial)
}

export async function readBoardData(): Promise<BoardData> {
  const row = db.prepare('SELECT data FROM board_data WHERE id=1').get()
  if (!row) return { tasks: {}, columns: baseColumns }
  try {
    const data = JSON.parse(row.data)
    if (data.tasks && data.columns) return data
  } catch {}
  return { tasks: {}, columns: baseColumns }
}

export async function updateBoardData(
  updater: (data: BoardData) => void | Promise<void>
): Promise<BoardData> {
  const data = await readBoardData()
  await updater(data)
  db.prepare('UPDATE board_data SET data=? WHERE id=1').run(JSON.stringify(data, null, 2))
  return data
}
