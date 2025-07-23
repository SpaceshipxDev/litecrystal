# Folder from Another Job Appears Inside a Task

## Architecture Recap
- **taintedpaint** (Next.js web UI & API) stores uploaded job files under `public/storage/tasks/{taskId}`. Metadata about tasks lives in `public/storage/metadata.json`.
- **blackpaint** (Electron client "Estara") downloads a job's files to the user's `Downloads/{folderName}` and runs `startBidirectionalSync` from `blackpaint/src/sync.ts` to keep local and remote files in sync.

## Problem
When many jobs are opened in Estara, some folders from one job occasionally appear inside another job's local folder. The extra folders then upload back to the server as part of the wrong task.

### Root Cause
`startBidirectionalSync` maintains two global sets: `pendingWrites` and `pendingUploads`. If uploading a file fails (e.g. network hiccup) its full path is stored in `pendingUploads`. Because this set was shared across all running syncs, the next sync cycle for *any* job retried every pending path. The retry calculated the path relative to its own root folder and uploaded the file under that task's ID. A failed upload from Job B therefore re‑uploaded into Job A as `../Job B/file`, creating a nested folder.

## Fix
Each active sync now tracks its own `pendingUploads` set. `uploadFile` and `pullFromServer` receive this set so retries only apply to their respective task. This prevents files from one job being uploaded to another.

See the implementation in `blackpaint/src/sync.ts` where `activeSyncs` stores `{ watcher, interval, pendingUploads }` and all upload logic references the per‑task set.

## Result
Folders no longer appear inside other tasks. Failed uploads are retried only for the correct job, keeping local and remote structures consistent.
