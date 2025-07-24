# Storage Folder Reappears After Deletion

## Architecture Overview
- **taintedpaint** hosts the Next.js web app and REST API. Uploaded tasks are saved under `public/storage/tasks/<taskId>` and metadata lives in `public/storage/metadata.json`.
- **blackpaint** is the Electron client (*Estara*). When a task is opened it downloads files locally and starts a bidirectional sync via `startBidirectionalSync` in `blackpaint/src/sync.ts`.

## Why deleted server files return
When the server's `/public/storage` directory is removed, any running Estara clients still think their tasks exist. The sync process lists files locally and uploads missing ones to the server every 10 seconds. The upload route (`app/api/jobs/[taskId]/upload/route.ts`) previously wrote files to disk before checking that the task was still present in `metadata.json`. As a result, clients recreated `/storage/tasks/<taskId>` even though the metadata file was gone.

## Temporary metadata files
`lib/boardDataStore.ts` writes updates using a lock file and a temporary path like `metadata.json.<uuid>.tmp` before renaming it to `metadata.json`.
These temp files normally disappear instantly, but if the process crashes mid-write they may linger. They can be safely deleted.

## Are these issues?
- The reappearance of task folders without metadata can lead to orphaned files. The upload API now verifies the task exists using `readBoardData()` before accepting files.
- Leftover temporary metadata files are harmless and only occur if a write is interrupted.

