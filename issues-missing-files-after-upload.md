# Files Disappear After Syncing on Another Client

## Architecture Recap
- **taintedpaint** stores uploaded job files under `storage/项目/{taskId}`.
- **blackpaint** downloads a job's files locally and runs `startBidirectionalSync` from `blackpaint/src/sync.ts`.

## What Happened
A user uploaded a folder with filenames containing characters invalid on Windows (e.g. `:` or `?`). The job appeared correctly in the Kanban board and could be opened on a macOS machine. When a Windows client later downloaded the same task, many files vanished shortly after the initial download.

## Root Cause
`blackpaint/src/index.ts` sanitises each downloaded file path when saving to disk on Windows. However `startBidirectionalSync` did not apply the same sanitisation when pulling updates from the server. The sync process therefore looked for unsanitised paths like `QG2507040003 005腕部-吴东东 2025.07.07/0111?:17 按钮 01.pdf`. These paths are illegal on Windows, so the files could not be written and the existing sanitised copies were deleted as "extraneous" during cleanup.

## Fix
`blackpaint/src/sync.ts` now uses the same `sanitizeRelPath` helper as the download logic. Remote filenames are sanitised before being compared or written locally, and the remote set uses the sanitised paths. This prevents valid files from being removed on Windows clients.


