import { CATEGORIES } from "@/lib/categories";
import { getDB } from "@/lib/d1";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDB();
  const depths: Record<string, number> = {};

  for (const cat of CATEGORIES) {
    const row = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM pool_puzzles WHERE category = ? AND status = 'approved'",
      )
      .bind(cat.id)
      .first<{ cnt: number }>();
    depths[cat.id] = row?.cnt ?? 0;
  }

  return NextResponse.json(
    {
      categories: CATEGORIES.map((c) => ({
        ...c,
        pool_count: depths[c.id] ?? 0,
        ready: (depths[c.id] ?? 0) >= 10,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
