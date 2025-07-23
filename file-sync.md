# File Sync Architecture

This document explains how Estara's Electron clients communicate with the Next.js server to keep each user's local task folders in sync.

## Overview

The project consists of two parts:

- **taintedpaint** – the server and web UI built with Next.js. It exposes API routes under `/api/jobs` for managing task files and metadata. Uploaded files live in `public/storage/tasks/{taskId}` and metadata is stored in `public/storage/metadata.json`.
- **blackpaint (Estara)** – the Electron desktop client. When a user opens a task, it downloads that task's files and starts a two‑way sync process.

## Opening a Task

1. In the web UI, the Kanban drawer calls `window.electronAPI.downloadAndOpenTaskFolder()` with the task ID, a folder name and a list of files to download.
2. `blackpaint/src/index.ts` registers an IPC handler for `download-and-open-task-folder`. The handler:
   - Sanitises the folder name.
   - Creates a root directory on the user's desktop named **`Estera 数据库`**.
   - Creates a subfolder for the selected task beneath this root.
   - Downloads each file from the provided URLs into the task folder.
   - Opens the folder using the OS file manager.
   - Starts a bidirectional sync by calling `startBidirectionalSync(taskId, folderPath)`.

## Bidirectional Sync

`startBidirectionalSync` in `blackpaint/src/sync.ts` watches the local task folder and periodically pulls from the server:

- **Local → Server**
  - When a file is added or changed locally, it is uploaded via `POST /api/jobs/{taskId}/upload` with its relative path.
  - If a file is deleted locally, a request is sent to `POST /api/jobs/{taskId}/delete-file`.
- **Server → Local**
  - Every 10 seconds the client fetches `/api/jobs/{taskId}/files` to get the authoritative list of files with modification timestamps.
  - New or updated files are downloaded and written to the local folder.
  - Files that were removed on the server are also removed locally.

Each active sync keeps its own pending upload queue to retry failed uploads without affecting other tasks. When the application quits `stopAllSyncs()` stops all watchers.

## Storage Location

Originally task folders were downloaded under the user's **Downloads** directory. The Electron client now uses the Desktop instead, placing all task folders inside a single directory named **`Estera 数据库`**. For example:

```
~/Desktop/Estera 数据库/<Task Folder>
```

This path is created automatically if it does not exist. All synchronization still works the same—files within each task folder are kept up to date with the server in both directions.

