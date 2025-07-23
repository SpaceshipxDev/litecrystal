import type { Task } from '@/types';

export function getShortId(task: Task): string {
  return task.id.slice(-4);
}

export function getFolderName(task: Task): string {
  if (task.ynmxId) return task.ynmxId;
  const short = getShortId(task);
  return `${task.customerName} - ${task.representative} #${short}`;
}

export function getDisplayName(task: Task): string {
  return task.ynmxId || `${task.customerName} - ${task.representative} #${getShortId(task)}`;
}
