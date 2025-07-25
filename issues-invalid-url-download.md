# Download Fails with Invalid URL Error

## Architecture Overview
- **taintedpaint** hosts the Next.js API routes and serves uploaded files from `public/storage/tasks/{taskId}`.
- **blackpaint** is the Electron client (Estara). The Kanban drawer calls `downloadAndOpenTaskFolder` which retrieves `/api/jobs/{taskId}/files`, downloads each entry and starts sync.

## Problem
After uploading a job, clicking **Open** in the drawer showed:

```
下载失败: Error invoking remote method 'download-and-open-task-folder':
TypeError: invalid url
```

Every task triggered the same error so no folders were downloaded locally.

## Root Cause
`/api/jobs/[taskId]/files` returned a list that included directory entries. These objects had `url: ''` because folders themselves are not downloadable. `blackpaint/src/index.ts` attempted to `axios.get()` each provided URL. When an empty string was encountered Node's URL parser threw `TypeError: Invalid URL`, aborting the entire download.

## Fix
The `getFilesRecursively` helper in `app/api/jobs/[taskId]/files/route.ts` now skips adding directories to the result. Only files with valid URLs are returned. The Electron handler already creates directories from each file's `relativePath`, so downloads proceed without errors.

