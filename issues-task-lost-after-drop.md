# Task Disappears After Dragging Near Column Edges

## Architecture Overview
- **taintedpaint** is the Next.js web app. Board state lives in `storage/board.sqlite` and is accessed via `lib/boardDataStore.ts`.
- **blackpaint** is the Electron client but is unrelated to this bug.

## Problem
Dragging a task and releasing it on the narrow gap between columns sometimes removed it from the board. The record still existed in SQLite and was returned by `/api/search`, but no column contained the task ID, so the board could not render it.

## Root Cause
`handleDrop` blindly updated the task's `columnId` with the ID passed from the drop target. When the drop occurred on an element outside any column, the handler received an invalid ID (`""`). The task was removed from its original column but never inserted into a new one, leaving it orphaned in the database.

## Solution
- `handleDrop` now verifies the target column exists before applying changes.
- `readBoardData` and the board fetch logic normalise existing data: any task whose `columnId` does not match a known column is moved to the start column.

As a result lost tasks automatically reappear in 建单 and future drags outside a column are ignored instead of corrupting the board state.
