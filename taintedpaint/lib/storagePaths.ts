import path from 'path'

const SMB_ROOT = process.env.SMB_ROOT

if (!SMB_ROOT) {
  throw new Error('SMB_ROOT environment variable must point to the SMB share root')
}

// All task folders already live directly on the SMB share. We simply store
// references to those folders instead of copying files into a separate
// subdirectory.
export const STORAGE_ROOT = SMB_ROOT

// Store SQLite metadata locally rather than on the SMB share
export const LOCAL_STORAGE_ROOT = path.resolve(__dirname, '..', '..', 'storage')
export const BOARD_DB_PATH = path.join(LOCAL_STORAGE_ROOT, 'board.sqlite')
