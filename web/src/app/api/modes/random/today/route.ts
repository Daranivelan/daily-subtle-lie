import { sampleDailySet } from "@/lib/daily-set";
import { getDB } from "@/lib/d1";
import { utcToday } from "@/lib/puzzle";
import type { PoolPuzzleRow } from "@/types";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDB();
  const today = utcToday();
  const { results } = await db
    .prepare("SELECT * FROM pool_puzzles WHERE status = 'approved'")
    .all<PoolPuzzleRow>();

  const sampled = sampleDailySet(results ?? [], today, "random");
  if (!sampled) {
    return NextResponse.json(
      {
        error: "Not enough approved pool puzzles yet",
        needed: 10,
        available: results?.length ?? 0,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      set_id: sampled.setId,
      date: today,
      mode: "random",
      puzzles: sampled.puzzles,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
