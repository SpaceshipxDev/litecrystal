# Slow Download When Opening Job Folder

## Architecture Overview
- **taintedpaint** serves the Next.js UI and API. Task files are stored under `storage/tasks/{taskId}` and listed via `/api/jobs/[taskId]/files`.
- **blackpaint** is the Electron wrapper (Estara). The Kanban drawer invokes `downloadAndOpenTaskFolder` which downloads each listed file and then starts bidirectional sync.

## Problem
Some tasks contain many drawings or large files. Clicking **Open** in the drawer triggers `downloadAndOpenTaskFolder`, but the folder can take 20 seconds or more to appear. The UI only shows a spinner so users are unsure if the app is working.

## Root Cause
The Electron handler downloads every file individually from the server. When the total size is large or the connection is slow the operation naturally takes longer. The previous file list API did not report file sizes so the UI could not warn users about heavy downloads.

## Fix
- `/api/jobs/[taskId]/files` now returns a `sizeBytes` field for each entry.
- `KanbanDrawer` sums these sizes. If the total exceeds 20&nbsp;MB it prompts the user that the download may take time before proceeding.
- The drawer still shows a spinner while downloading.

## Result
Large tasks now provide a clear warning so users understand why the download may be slow. The backend and sync logic remain unchanged, but the user experience is smoother with feedback about big folders.
