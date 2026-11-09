import { getDB } from "@/lib/d1";
import { rowToArchive, utcToday } from "@/lib/puzzle";
import type { PuzzleRow } from "@/types";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDB();
  const today = utcToday();

  // Include today and past approved dailies (playable from archive anytime).
  const { results } = await db
    .prepare(
      "SELECT date, category, topic FROM puzzles " +
        "WHERE status = 'approved' AND date <= ? " +
        "ORDER BY date DESC LIMIT 60",
    )
    .bind(today)
    .all<Pick<PuzzleRow, "date" | "category" | "topic">>();

  return NextResponse.json((results ?? []).map(rowToArchive), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
