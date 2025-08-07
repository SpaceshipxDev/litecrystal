// types.ts

export interface Task {
  id: string;
  columnId: string; // <-- NEW
  customerName: string;
  representative: string;
  inquiryDate: string;
  /** Required delivery date, editable in the Kanban drawer */
  deliveryDate?: string;
  notes: string;
  taskFolderPath?: string;
  files?: string[];
  ynmxId?: string; // ID assigned when moving to approval
  deliveryNoteGenerated?: boolean;
  awaitingAcceptance?: boolean;
  previousColumnId?: string;
}

// A lightweight version used for the Kanban overview
export interface TaskSummary {
  id: string;
  columnId: string;
  customerName: string;
  representative: string;
  inquiryDate: string;
  deliveryDate?: string;
  notes: string;
  ynmxId?: string;
  deliveryNoteGenerated?: boolean;
  awaitingAcceptance?: boolean;
  previousColumnId?: string;
}

export interface Column {
  id: string;
  title: string;
  taskIds: string[]; // <-- CHANGED from tasks: Task[]
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