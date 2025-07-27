# SQLite Migration Guide

This project now stores Kanban board data in a SQLite database instead of the previous `storage/metadata.json` file.

## Prerequisites

- **Node.js** `>=20`
- `npm` installed

`taintedpaint` depends on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) which compiles native bindings. On most systems the required build tools are already available. If installation fails you may need `python` and a C++ compiler (`build-essential` on Debian/Ubuntu).

## Installing Dependencies

```bash
cd taintedpaint
npm install
```

This installs `better-sqlite3` and other packages. The first run may take a moment while the native module compiles.

## Database Location

The database file lives at `storage/board.sqlite` in the repository root. It is created automatically the first time the app starts. The `board_data` table contains one row with the entire board state as JSON. Using SQLite allows safe concurrent writes and works in both development and packaged Electron builds.

## Running the App

```bash
# from the repository root
cd taintedpaint
npm run dev
```

When the server starts it ensures `storage/board.sqlite` exists and seeds it with empty board data if needed. The Next.js API routes read and update this database through `lib/boardDataStore.ts`.

## Architecture Overview

- **taintedpaint** – Next.js web app. API routes under `app/api` interact with the database via `boardDataStore.ts`.
- **blackpaint** – Electron wrapper that loads the web app for desktop usage.
- **storage** – Directory holding uploaded task files and `board.sqlite`.

`boardDataStore.ts` uses `better-sqlite3` to synchronously read/write the board JSON. Other application code remains mostly unchanged and continues to call `readBoardData()` and `updateBoardData()`.

## Flow

1. User actions in the UI trigger API calls (e.g., creating a task, uploading files).
2. API route handlers modify the in-memory board object via `updateBoardData()`.
3. `updateBoardData()` writes the updated JSON back to `board.sqlite`.
4. The UI polls `/api/jobs` periodically to refresh the board state.

This approach keeps the persistence layer simple while leveraging SQLite's reliability.
