# Task Moves Revert to Previous Column

## Architecture Overview
- **taintedpaint** – Next.js app providing the Kanban board and REST API. Board state is stored in `storage/metadata.json` and polled by the UI every 10 seconds.
- **blackpaint** – not involved in this bug but synchronises files when tasks are opened.

## Problem
Users reported that after dragging a task to another column it sometimes snapped back to its original position. Reloading the page a few seconds later would show the task in the correct column. The behaviour was inconsistent and hard to reproduce.

## Root Cause
`KanbanBoard` saves drag‑and‑drop changes with a `PUT /api/jobs` request. At the same time a `setInterval` call polls `/api/jobs` every 10 s to refresh the board. If a poll occurs while the save request is still in flight, the UI receives the outdated board data from the server and overwrites the local state. A moment later the save completes, so the next poll shows the task in the new column—making the flicker appear random.

## Solution
Introduce an `isSavingRef` flag to pause polling while a save is in progress and to re-fetch the board once the update succeeds. `fetchBoard()` now exits early when `isSavingRef.current` is true. The drop handler awaits `saveBoard()` and then calls `fetchBoard()` to synchronise state.

## Result
Dragging tasks between columns now updates immediately and no longer reverts even when the periodic poll triggers during the operation.
