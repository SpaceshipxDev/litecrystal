# Missing Storage Directory Prevents Job Creation

## Architecture Overview
- **taintedpaint** – Next.js server providing the Kanban board and API routes. Board data is persisted to `storage/metadata.json` at the repository root.
- **blackpaint** – Electron wrapper (Estara) that simply loads the web app. It relies on the server to store uploaded folders and task updates.

## Problem
Running `npm run build && npm run start` produced a working web UI, but creating a job stalled indefinitely and dragging a task between columns reverted after refreshing the page.

## Root Cause
`lib/boardDataStore.ts` writes updates to `../storage/metadata.json`. When the `storage` directory does not exist, the first call to `fs.open(LOCK_FILE, 'wx')` throws `ENOENT`. The API routes catch this error and return 500 responses, so the frontend keeps waiting and never saves changes. Because no metadata file is written, subsequent page loads restore the previous board state.

## Solution
Ensure the storage directory is present before reading or writing board data. `boardDataStore.ts` now calls `fs.mkdir(STORAGE_DIR, { recursive: true })` inside an `ensureStorageDir` helper used by both `readBoardData` and `updateBoardData`. A `.gitkeep` file is also committed so `storage/` exists when cloning the repo.

