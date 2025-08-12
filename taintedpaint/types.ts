// types.ts

export interface Task {
  id: string;
  columnId: string; // <-- NEW
  /** Previous column when awaiting acceptance */
  previousColumnId?: string;
  customerName?: string;
  representative?: string;
  inquiryDate?: string;
  /** Required delivery date, editable in the Kanban drawer */
  deliveryDate?: string;
  notes?: string;
  taskFolderPath?: string;
  files?: string[];
  ynmxId?: string; // Order ID provided by users
  deliveryNoteGenerated?: boolean;
  /** Whether this task is waiting for acceptance in the target column */
  awaitingAcceptance?: boolean;
  /** ISO timestamp when the task was created */
  createdAt?: string;
  /** ISO timestamp of the last modification */
  updatedAt?: string;
  /** Name of the user who made the last modification */
  updatedBy?: string;
  /** Activity history entries */
  history?: TaskHistoryEntry[];
}

export interface TaskHistoryEntry {
  user: string;
  timestamp: string;
  description: string;
}

// A lightweight version used for the Kanban overview
export interface TaskSummary {
  id: string;
  columnId: string;
  previousColumnId?: string;
  customerName?: string;
  representative?: string;
  inquiryDate?: string;
  deliveryDate?: string;
  notes?: string;
  ynmxId?: string;
  deliveryNoteGenerated?: boolean;
  awaitingAcceptance?: boolean;
  /** ISO timestamp when the task was created */
  createdAt?: string;
  /** ISO timestamp of the last modification */
  updatedAt?: string;
  /** Name of the user who made the last modification */
  updatedBy?: string;
}

export interface Column {
  id: string;
  title: string;
  taskIds: string[]; // <-- CHANGED from tasks: Task[]
  /** Tasks waiting to be accepted for this column */
  pendingTaskIds: string[];
}

// NEW: A type for the entire board data
export interface BoardData {
  tasks: Record<string, Task>;
  columns: Column[];
}

// Returned by the /api/jobs?summary=1 endpoint
export interface BoardSummaryData {
  tasks: Record<string, TaskSummary>;
  columns: Column[];
}

export interface User {
  name: string;
  department: string;
  passwordHash: string;
}
