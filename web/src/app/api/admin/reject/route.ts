import { requireAdmin } from "@/lib/admin-auth";
import { getDB } from "@/lib/d1";
import { isValidDate } from "@/lib/puzzle";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let body: { date?: string };
  try {
    body = (await request.json()) as { date?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.date || !isValidDate(body.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db = await getDB();
  const result = await db
    .prepare(
      "UPDATE puzzles SET status = 'rejected' WHERE date = ? AND status = 'review'",
    )
    .bind(body.date)
    .run();

  if (!result.meta.changes) {
    return NextResponse.json(
      { error: "No review puzzle for that date" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, date: body.date, status: "rejected" });
}
