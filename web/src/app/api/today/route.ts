import { getDB } from "@/lib/d1";
import { rowToPublic, utcToday } from "@/lib/puzzle";
import type { PuzzleRow } from "@/types";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDB();
  const today = utcToday();

  const puzzle = await db
    .prepare(
      "SELECT * FROM puzzles WHERE date = ? AND status = 'approved' LIMIT 1",
    )
    .bind(today)
    .first<PuzzleRow>();

  if (!puzzle) {
    return NextResponse.json(
      { error: "No puzzle today" },
      { status: 404 },
    );
  }

  return NextResponse.json(rowToPublic(puzzle), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
