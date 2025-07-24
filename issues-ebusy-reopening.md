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
