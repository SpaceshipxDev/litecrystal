// lib/baseColumns.ts

import type { Column } from "@/types";

export const START_COLUMN_ID = "create";
export const ARCHIVE_COLUMN_ID = "archive";

// Updated to use taskIds
export const baseColumns: Column[] = [
  { id: "create",      title: "建单",   taskIds: [], pendingTaskIds: [] },
  { id: "quote",       title: "报价",   taskIds: [], pendingTaskIds: [] },
  { id: "send",        title: "发出",   taskIds: [], pendingTaskIds: [] },
  { id: "archive",     title: "报价归档",   taskIds: [], pendingTaskIds: [] },
  { id: "sheet",       title: "制单",   taskIds: [], pendingTaskIds: [] },
  { id: "approval",    title: "审批",   taskIds: [], pendingTaskIds: [] },
  { id: "outsourcing", title: "外协",   taskIds: [], pendingTaskIds: [] },
  { id: "daohe",      title: "道禾",   taskIds: [], pendingTaskIds: [] },
  { id: "program",     title: "编程",   taskIds: [], pendingTaskIds: [] },
  { id: "operate",     title: "操机",   taskIds: [], pendingTaskIds: [] },
  { id: "manual",      title: "手工",   taskIds: [], pendingTaskIds: [] },
  { id: "batch",       title: "批量",   taskIds: [], pendingTaskIds: [] },
  { id: "surface",     title: "表面处理",   taskIds: [], pendingTaskIds: [] },
  { id: "inspect",     title: "检验",   taskIds: [], pendingTaskIds: [] },
  { id: "ship",        title: "出货",   taskIds: [], pendingTaskIds: [] },
  { id: "archive2",    title: "完成归档",   taskIds: [], pendingTaskIds: [] }
];
