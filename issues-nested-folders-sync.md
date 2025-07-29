# Nested Folders Reappear in Downloads

## Architecture and Workflow Overview
- **taintedpaint** serves as the Next.js web interface and provides REST API routes for file management. Uploaded jobs are stored under `storage/项目/{taskId}`.
- **blackpaint (Estara)** is the Electron shell. When the user clicks *Open* in the Kanban drawer it downloads all job files to `~/Downloads/{folderName}` and starts a bidirectional sync via `startBidirectionalSync`.

## Problem
When uploading a folder through the web interface each file is sent with its `webkitRelativePath`. This path includes the root folder name. The server stored the files exactly as received (e.g. `task-123/partA.pdf`). When Estara later downloaded the job it also created a folder named after the job (e.g. `YNMX-001`). Because the stored paths already contained the top level directory, the downloaded folder ended up containing another copy of the root (e.g. `YNMX-001/task-123/partA.pdf`). If the user deleted the extra subfolder locally it was recreated on the next sync because the server kept that prefix.

## Fix
Strip the uploaded root folder name from each file path on the server. The `POST /api/jobs` route now removes the `folderName` prefix from every `filePaths` entry before saving. Newly created tasks therefore store files directly under `storage/项目/{taskId}` without the extra subdirectory.

## Result
Opening a job in Estara now downloads files directly into the job folder without nesting. Deleting local folders no longer results in them reappearing from the server.
