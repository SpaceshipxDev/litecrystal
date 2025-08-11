import path from 'path'

// Root of the shared SMB storage. If not provided, paths will be stored as-is.
export const STORAGE_ROOT = process.env.SMB_ROOT || ''

// Keep the SQLite board on the server's persistent data volume
export const LOCAL_STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT || '/data'
export const BOARD_DB_PATH = path.join(LOCAL_STORAGE_ROOT, 'board.sqlite')
