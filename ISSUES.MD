# File Sync Error When Downloading Job Folder

## Architecture Overview
- **taintedpaint** provides the Next.js web interface and REST API. Job files are saved under `storage/项目`. Metadata is tracked in `storage/metadata.json`.
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
