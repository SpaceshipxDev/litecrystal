import path from 'path'

// Root of the shared SMB storage. Defaults to the network share used by the
// organisation. Can be overridden by setting the `SMB_ROOT` environment
// variable on the server.
export const STORAGE_ROOT =
  process.env.SMB_ROOT || String.raw`\\192.168.5.21\d\Estara\Tasks`

// Keep the SQLite board on the server's persistent data volume
export const LOCAL_STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT || '/data'
export const BOARD_DB_PATH = path.join(LOCAL_STORAGE_ROOT, 'board.sqlite')
