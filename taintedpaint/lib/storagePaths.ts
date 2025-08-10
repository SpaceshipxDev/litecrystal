import path from 'path'

const SMB_ROOT = process.env.SMB_ROOT

if (!SMB_ROOT) {
  throw new Error('SMB_ROOT environment variable must point to the SMB share root')
}

export const STORAGE_ROOT = SMB_ROOT
export const TASKS_DIR_NAME = '项目'
export const TASKS_STORAGE_DIR = path.join(STORAGE_ROOT, TASKS_DIR_NAME)
export const BOARD_DB_PATH = path.join(STORAGE_ROOT, 'board.sqlite')
