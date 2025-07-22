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
  taskFolderPath: string;
  files: string[];
  ynmxId?: string; // ID assigned when moving to approval
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