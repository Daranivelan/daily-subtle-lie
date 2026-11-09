import { getDB } from "@/lib/d1";
import { isValidDate, rowToPublic } from "@/lib/puzzle";
import type { PuzzleRow } from "@/types";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;

  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db = await getDB();
  const puzzle = await db
    .prepare(
      "SELECT * FROM puzzles WHERE date = ? AND status = 'approved' LIMIT 1",
    )
    .bind(date)
    .first<PuzzleRow>();

  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
  }

  return NextResponse.json(rowToPublic(puzzle), {
    // Short cache so local/dev seed updates show up quickly
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
