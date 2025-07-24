# Duplicate Local Folder Names Before YNMX Assignment

## Problem
If multiple tasks are created for the same customer and representative before a YNMX ID is assigned, Estara would name each local folder using only `customerName - representative`. Opening more than one such task would map them to the exact same directory on the user's desktop. This risked files from different tasks mixing together or uploads going to the wrong job.

## Solution
`KanbanDrawer` now appends the unique task ID whenever a YNMX ID is not present:

```ts
const folderName =
  task.ynmxId || `${task.customerName} - ${task.representative} - ${task.id}`;
```

Each job therefore downloads to a distinct path even when customer and representative are identical. Bidirectional sync continues per task ID so local and remote files remain separate.
