# CrystalPaint Setup

This repository contains two parts:

- `taintedpaint` – the Next.js web app.
- `blackpaint` – the Electron wrapper named **Estara**.

Two Electron builds can be produced:

1. **Administrator build** – full access.
2. **Production build** – locked to production view with some UI disabled.

## Web App

```
cd taintedpaint
npm install
npm run dev
```

By default the web app runs on `http://localhost:3000`. Set `NEXT_PUBLIC_APP_URL` in the environment if the Electron app should point elsewhere.

## Building Electron Apps

```
cd blackpaint
npm install
```

### Administrator version

```
npm run make
```

### Production version

```
npm run make:restricted
```

The production build adds `?restricted=1` to the web URL so the web interface automatically hides the Business switcher and Holistic view.

### Why it mattered

Initially the `make:restricted` script set the `RESTRICTED` environment variable only while running the build. Because the packaged application started without that variable present, `process.env.RESTRICTED` evaluated to `undefined`, so the restricted mode was never enabled. Webpack now copies the value of `RESTRICTED` into the bundled code at build time, ensuring the production package always loads with the proper query parameter.

The packaged apps can be found in `blackpaint/out` after running the commands.

## Architecture & Workflow

The project is split into two directories:

- **taintedpaint** – a Next.js application that renders the Kanban board and REST
  API endpoints.
- **blackpaint** – an Electron shell (called *Estara*) which loads the web app
  and packages it as a desktop application.

### Data flow

1. **Metadata store** – All tasks and column data are persisted to
   `storage/metadata.json` at the repository root.
2. **Board loading** – The `KanbanBoard` component fetches this file through
   `/api/jobs` and keeps the board state in React.
3. **Creating jobs** – `CreateJobForm` uploads a folder of files and creates a
   new task entry via `POST /api/jobs`.
4. **Drag & drop** – Moving cards between columns updates the board state and
   saves it with `PUT /api/jobs`.
5. **Task details** – Clicking a card opens `KanbanDrawer` where users can view
   metadata, download files, and (with the changes below) update the delivery
   date.

The web UI is intentionally clean and minimal, inspired by Apple's design
language. The Electron wrapper simply points to the same UI and enables access
to local file operations.
