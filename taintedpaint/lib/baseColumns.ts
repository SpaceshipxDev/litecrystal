// lib/baseColumns.ts

import type { Column } from "@/types";

export const START_COLUMN_ID = "create";
export const ARCHIVE_COLUMN_ID = "archive";

// Updated to use taskIds
export const baseColumns: Column[] = [
  { id: "create",      title: "建单",   taskIds: [] },
  { id: "quote",       title: "报价",   taskIds: [] },
  { id: "send",        title: "发出",   taskIds: [] },
  { id: "archive",     title: "报价归档",   taskIds: [] },
  { id: "sheet",       title: "制单",   taskIds: [] },
  { id: "approval",    title: "审批",   taskIds: [] },
  { id: "outsourcing", title: "外协",   taskIds: [] },
  { id: "daohe",      title: "道禾",   taskIds: [] },
  { id: "program",     title: "编程",   taskIds: [] },
  { id: "operate",     title: "操机",   taskIds: [] },
  { id: "manual",      title: "手工",   taskIds: [] },
  { id: "batch",       title: "批量",   taskIds: [] },
  { id: "surface",     title: "表面处理",   taskIds: [] },
  { id: "inspect",     title: "检验",   taskIds: [] },
  { id: "ship",        title: "出货",   taskIds: [] },
  { id: "archive2",    title: "完成归档",   taskIds: [] }
];
