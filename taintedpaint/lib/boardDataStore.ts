import { mkdirSync } from 'fs'
import { BOARD_DB_PATH, STORAGE_ROOT } from './storagePaths'
import Database from 'better-sqlite3'
import { baseColumns, START_COLUMN_ID, ARCHIVE_COLUMN_ID } from './baseColumns'
import type { BoardData } from '@/types'

// Store dynamic data on the network share so it remains accessible
// to all clients and avoids writing to the local server disk.
const STORAGE_DIR = STORAGE_ROOT
const DB_PATH = BOARD_DB_PATH

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

function normalizeBoardData(data: BoardData) {
  const columnMap = new Map(data.columns.map(c => [c.id, c]))
  const columnIds = new Set(columnMap.keys())
  const archiveCol = columnMap.get(ARCHIVE_COLUMN_ID) || data.columns[0]

  // Normalize task arrays in columns
  for (const col of data.columns) {
    col.pendingTaskIds = Array.from(new Set(
      (col.pendingTaskIds || []).filter(id => {
        const t = (data.tasks as Record<string, any>)[id]
        return t && t.awaitingAcceptance && t.columnId === col.id
      })
    ))

    col.taskIds = Array.from(new Set(
      col.taskIds.filter(id => {
        const t = (data.tasks as Record<string, any>)[id]
        return t && !t.awaitingAcceptance && t.columnId !== ARCHIVE_COLUMN_ID && t.columnId !== 'archive2'
      })
    ))
  }

  for (const [id, task] of Object.entries(data.tasks)) {
    if (task.columnId === ARCHIVE_COLUMN_ID || task.columnId === 'archive2') {
      delete data.tasks[id]
      continue
    }
    if (!columnIds.has(task.columnId)) {
      task.columnId = ARCHIVE_COLUMN_ID
    }
    const col = columnMap.get(task.columnId) || archiveCol
    const list = task.awaitingAcceptance ? col.pendingTaskIds : col.taskIds
    if (!list.includes(id)) list.push(id)
  }
}

export async function readBoardData(): Promise<BoardData> {
  // `row` can be undefined if no record is found!
  const row = db.prepare('SELECT data FROM board_data WHERE id=1').get() as { data?: string } | undefined;
  if (!row || typeof row.data !== "string") return { tasks: {}, columns: baseColumns };
  try {
    const data = JSON.parse(row.data);
    if (data.tasks && data.columns) {
      normalizeBoardData(data)
      return data
    }
  } catch {}
  return { tasks: {}, columns: baseColumns };
}


export async function updateBoardData(
  updater: (data: BoardData) => void | Promise<void>
): Promise<BoardData> {
  const data = await readBoardData()
  await updater(data)
  normalizeBoardData(data)
  db.prepare('UPDATE board_data SET data=? WHERE id=1').run(JSON.stringify(data, null, 2))
  return data
}
