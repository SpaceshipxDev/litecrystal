# LCK/BAK Files and Missing Empty Directories

## Architecture
- **taintedpaint** runs the Next.js API. Task files live under `public/storage/tasks/<taskId>` and are listed through `/api/jobs/[taskId]/files`.
- **blackpaint (Estara)** downloads a job's folder then keeps it in sync via `startBidirectionalSync` in `blackpaint/src/sync.ts`.

## Problem
While testing downloads on multiple machines the client began to receive extra files ending with `.lck` or `.bak`. These lock/backup files are created by CAD software when a user opens a drawing. Our sync logic uploaded them to the server where they were later downloaded by other clients. Additionally, empty subfolders that existed on the original machine did not appear after downloading a job on another computer.

## Root Cause
- `startBidirectionalSync` only ignored a few system files and uploaded every other file change. AutoCAD lock (`*.lck`) and backup (`*.bak`) files therefore propagated to the server.
- The `/api/jobs/[taskId]/files` route only returned regular files. Because empty folders contain no files they were never listed and thus were not recreated when downloading.

## Fix
- Updated both the client sync logic and the server file listing to ignore `*.lck` and `*.bak` files.
- Added new API routes `/api/jobs/[taskId]/create-dir` and `/api/jobs/[taskId]/delete-dir` so the client can explicitly sync directory creation and removal.
- `startBidirectionalSync` now watches `addDir` and `unlinkDir` events. Directories reported by the server are recreated locally during sync so empty folders persist across machines.

