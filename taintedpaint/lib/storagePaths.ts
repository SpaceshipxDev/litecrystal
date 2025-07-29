import path from 'path';

export const STORAGE_ROOT = process.env.SMB_ROOT || path.join(process.cwd(), '..', 'storage');
export const TASKS_STORAGE_DIR = path.join(STORAGE_ROOT, 'tasks');
