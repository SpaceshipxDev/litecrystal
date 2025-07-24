# Issue Archive

# File Sync Error When Downloading Job Folder

## Architecture Overview
- **taintedpaint** provides the Next.js web interface and REST API. Job files are saved under `public/storage/tasks`. Metadata is tracked in `public/storage/metadata.json`.
- **blackpaint** is the Electron wrapper (Estara). When the Kanban drawer's "Open" button is used, the Electron main process downloads the job's files to the user's `Downloads` directory and starts a bidirectional sync (`startBidirectionalSync` in `blackpaint/src/sync.ts`).

## Problem Description
During testing a job folder `YNMX-25-7-15-208` was uploaded successfully. The job appeared in 建单, but clicking **Open** in the Kanban drawer caused a popup:
```
下载失败: Error invoking remote method 'download-and-open-task-folder':
Error: ENOENT: no such file or directory,
open 'd:\Downloads\ewf_fwe\YNMX-25-7-15-208\QG2507040003 005腕部-吴东东 2025.07.07\0111□□-17 按钮 01.pdf'
```
Inspecting the local Downloads folder showed empty files.

The server stores uploaded filenames exactly as received. Some names contain characters that are invalid on Windows (`?`, `*`, `:` etc.). `download-and-open-task-folder` only sanitized the root folder name, so when the Electron app attempted to create files with disallowed characters Windows refused, triggering an `ENOENT` error and leaving zero‑byte files.

## Resolution
`blackpaint/src/index.ts` now sanitizes every component of each downloaded file path. On Windows, characters `\/:*?"<>|` and trailing spaces or dots are replaced with underscores before writing. This prevents filesystem errors when jobs include filenames with Windows‑reserved characters.

## Ongoing Issue: Hex Decoding of Underscore Sequences
Another bug surfaced after the above fix. The server-side API routes apply `decodeUnderscoreHex` to uploaded filenames and paths. This helper interprets any sequence like `_E5_B9_BF` as hexadecimal bytes and decodes them. Legitimate filenames containing underscore-digit patterns (e.g. `0111_03_04-17 拨钮 01.PDF`) are therefore mangled into control characters when saved on the server. When Estara later downloads the job it requests these garbled names, producing `ENOENT` errors such as:

```
下载失败: Error invoking remote method 'download-and-open-task-folder':
Error: ENOENT: no such file or directory,
open 'd:\Downloads\X0 - X0\YNMX-25-7-15-208\QG2507040003 200S腕部-吴东东 2025.07.07\0111□□-17 数组 01.pdf'
```

The fix removes `decodeUnderscoreHex` from all API routes. Filenames are now stored exactly as uploaded, avoiding accidental conversion of underscores followed by digits.
# EBUSY Error When Reopening Downloaded Job

## Architecture Overview
- **taintedpaint** is the Next.js server and web UI. Task files live under `public/storage/tasks/{taskId}`.
- **blackpaint (Estara)** downloads a task's files to `C:\EstaraSync/<Folder>` on Windows (or `~/Desktop/Estara 数据/<Folder>` on other platforms) and starts `startBidirectionalSync` from `blackpaint/src/sync.ts`.

## What Happened
An employee uploaded a folder and created a new job. The job appeared on the Kanban board and they successfully opened the folder on their desktop. When they clicked **Open** again a short time later, Estara showed:

```
下载失败: Error invoking remote method 'download-and-open-task-folder':
Error: EBUSY: resource busy or locked, open 'C:\EstaraSync\海康邱影 - 周正哥 - 12345\7-24（周正哥）报价单.xlsx'
```

The local Excel file remained open, so the second download attempted to overwrite it. Windows reported `EBUSY` because the file was locked by another process.

## Solution
`download-and-open-task-folder` no longer redownloads an already-synced job. `blackpaint/src/sync.ts` now tracks each task's local path. Before downloading, the handler checks `getSyncPath(taskId)`:

- If the task is already syncing, it simply opens the existing folder.
- Otherwise it downloads the files and starts a new sync.

This avoids writing over open files and prevents `EBUSY` errors when reopening a job.
# Nested Folders Reappear in Downloads

## Architecture and Workflow Overview
- **taintedpaint** serves as the Next.js web interface and provides REST API routes for file management. Uploaded jobs are stored under `public/storage/tasks/{taskId}`.
- **blackpaint (Estara)** is the Electron shell. When the user clicks *Open* in the Kanban drawer it downloads all job files to `~/Downloads/{folderName}` and starts a bidirectional sync via `startBidirectionalSync`.

## Problem
When uploading a folder through the web interface each file is sent with its `webkitRelativePath`. This path includes the root folder name. The server stored the files exactly as received (e.g. `task-123/partA.pdf`). When Estara later downloaded the job it also created a folder named after the job (e.g. `YNMX-001`). Because the stored paths already contained the top level directory, the downloaded folder ended up containing another copy of the root (e.g. `YNMX-001/task-123/partA.pdf`). If the user deleted the extra subfolder locally it was recreated on the next sync because the server kept that prefix.

## Fix
Strip the uploaded root folder name from each file path on the server. The `POST /api/jobs` route now removes the `folderName` prefix from every `filePaths` entry before saving. Newly created tasks therefore store files directly under `public/storage/tasks/{taskId}` without the extra subdirectory.

## Result
Opening a job in Estara now downloads files directly into the job folder without nesting. Deleting local folders no longer results in them reappearing from the server.
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
# Duplicate Local Folder Names Before YNMX Assignment

## Problem
If multiple tasks are created for the same customer and representative before a YNMX ID is assigned, Estara would name each local folder using only `customerName - representative`. Opening more than one such task would map them to the exact same directory on the user's desktop. This risked files from different tasks mixing together or uploads going to the wrong job.

## Solution
`KanbanDrawer` now appends the unique task ID whenever a YNMX ID is not present:

```ts
const folderName =
  task.ynmxId || `${task.customerName} - ${task.representative} - ${task.id}`;
```

Each job therefore downloads to a distinct path even when customer and representative are identical. Bidirectional sync continues per task ID so local and remote files remain separate.
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

# Cannot Open Synced Files on Windows

## Architecture Context
- **taintedpaint** stores uploaded files under `public/storage/tasks/{taskId}`.
- **blackpaint** syncs each task to a local folder via `startBidirectionalSync`.

## Problem
Opening PDFs or spreadsheets from a synced task folder produced an error from
WPS Office:

```
C;\Users\admin\Desktop\Estara 数据\...\file.pdf
请先检查和确认您拥有此文件的访问权限...
```

The files existed but Windows refused to open them.

### Root Cause
The absolute path exceeded Windows' 260 character limit. Long customer folder
names combined with the previous base path `C:\Users\<user>\Desktop\Estara 数据`
resulted in paths that some programs could not access.

## Solution
`blackpaint/src/index.ts` now places synced jobs under `C:\EstaraSync` on
Windows. This shorter base path keeps most file names well under the legacy
limit, allowing WPS and other applications to open them normally. macOS and
Linux continue to use `~/Desktop/Estara 数据`.
