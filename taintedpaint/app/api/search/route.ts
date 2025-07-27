// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { BoardData, Task } from "@/types";
import { readBoardData } from "@/lib/boardDataStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim().toLowerCase();
  if (!query) return NextResponse.json([]);

  try {
    const data: BoardData = await readBoardData();
    if (!data.tasks || !data.columns) return NextResponse.json([]);

    const colMap = new Map(data.columns.map((c) => [c.id, c.title]));
    const results = Object.values(data.tasks as Record<string, Task>)
      .filter((task) => {
        const text = `${task.customerName} ${task.representative} ${task.ynmxId ?? ''} ${task.notes ?? ''}`.toLowerCase();
        return text.includes(query);
      })
      .slice(0, 3)
      .map((task) => ({
        task,
        columnTitle: colMap.get(task.columnId) ?? "Unknown Column",
      }));

    return NextResponse.json(results);
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json([]);
  }
}