# File Management

Estara no longer performs background file synchronisation. The simplified workflow is:

1. **Upload** – A new job is created by uploading a folder through the web UI (`POST /api/jobs`). The server stores the folder under `storage/tasks/<taskId>`.
2. **Download** – From the Kanban drawer the desktop app downloads the current files with `download-and-open-task-folder` and opens the folder on disk.
3. **Replace** – After editing locally, select a new folder and upload it via `POST /api/jobs/<taskId>/replace`. The server removes the old files and saves the new upload.

There is no polling or bidirectional sync. Files only change when a new folder is uploaded.
