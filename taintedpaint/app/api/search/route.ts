// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BoardData, Task } from "@/types";

// Read metadata from the new root-level storage directory
const META_FILE = path.join(process.cwd(), "..", "storage", "metadata.json");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim().toLowerCase();
  if (!query) return NextResponse.json([]);

  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const data: BoardData = JSON.parse(raw);
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