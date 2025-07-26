# Local Files Deleted When Server Folder Missing

## Architecture Recap
- **taintedpaint** hosts uploaded files under `storage/tasks/<taskId>`.
- **blackpaint** downloads a task's folder and keeps it in sync via `startBidirectionalSync` in `blackpaint/src/sync.ts`.

## What Happened
If the server's task directory was removed (for example after a server cleanup) while the metadata file still listed the task, subsequent sync cycles returned an empty file list. The client interpreted this as the task having no files and deleted every local file under that task.

## Root Cause
`/api/jobs/[taskId]/files` previously responded with an empty array when the directory did not exist. `pullFromServer` treated an empty list as truth and removed any local paths not found in the response.

## Fix
- The API route now returns `404` with `{"error":"Task files missing"}` when the directory is absent.
- `pullFromServer` only removes local files if the remote list contains at least one entry. When the response is empty (or a 404 is received) the existing local files are preserved.
