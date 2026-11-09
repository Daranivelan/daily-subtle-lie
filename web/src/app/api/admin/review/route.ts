import { requireAdmin } from "@/lib/admin-auth";
import { getDB } from "@/lib/d1";
import type { PuzzleRow } from "@/types";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT date, category, topic, sentences, lie_index, truth, source_url, status " +
        "FROM puzzles WHERE status = 'review' ORDER BY date ASC",
    )
    .all<PuzzleRow>();

  const items = (results ?? []).map((row) => {
    let sentences: string[] = [];
    try {
      sentences = JSON.parse(row.sentences) as string[];
    } catch {
      /* ignore */
    }
    return {
      date: row.date,
      category: row.category,
      topic: row.topic,
      sentences,
      lie_index: row.lie_index,
      truth: row.truth,
      source_url: row.source_url,
      status: row.status,
    };
  });

  return NextResponse.json(items);
}
