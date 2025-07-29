import path from 'path'

export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), '..', 'storage')
export const STORAGE_ROOT = process.env.SMB_ROOT || LOCAL_STORAGE_ROOT
export const TASKS_DIR_NAME = '项目'
export const TASKS_STORAGE_DIR = path.join(STORAGE_ROOT, TASKS_DIR_NAME)
export const BOARD_DB_PATH = path.join(LOCAL_STORAGE_ROOT, 'board.sqlite')
