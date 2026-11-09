import {
  SET_SIZE,
  matchPoolRows,
  normalizeTopicQuery,
  sampleMatchedOnly,
  setIdFor,
} from "@/lib/daily-set";
import { getDB } from "@/lib/d1";
import { puzzleFromWikipedia } from "@/lib/generate-topic-puzzle";
import { utcToday } from "@/lib/puzzle";
import { deobfuscateReveal } from "@/lib/reveal";
import type { WikiArticle } from "@/lib/wikipedia";
import {
  fetchWikipediaExtracts,
  relatedWikipediaTitles,
} from "@/lib/wikipedia";
import type { PoolPuzzleRow, PuzzlePublic } from "@/types";
import { NextResponse } from "next/server";

async function persistGenerated(puzzles: PuzzlePublic[]) {
  try {
    const db = await getDB();
    const now = new Date().toISOString();
    for (const p of puzzles) {
      const decoded = deobfuscateReveal(p.id, p.reveal);
      if (!decoded) continue;
      await db
        .prepare(
          "INSERT OR IGNORE INTO pool_puzzles " +
            "(id, category, topic, sentences, lie_index, truth, source_url, source_license, status, created_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)",
        )
        .bind(
          p.id,
          p.category,
          p.topic,
          JSON.stringify(p.sentences),
          decoded.lie_index,
          decoded.truth,
          p.source_url,
          p.source_license || "CC BY-SA 4.0",
          now,
        )
        .run();
    }
  } catch {
    // Best-effort cache — makes the next visit near-instant
  }
}

function tryAdd(
  article: WikiArticle,
  query: string,
  variant: number,
  usedTopics: Set<string>,
  bucket: PuzzlePublic[],
) {
  if (bucket.length >= SET_SIZE) return;
  const puzzle = puzzleFromWikipedia(article, query, variant);
  if (!puzzle) return;
  const key = puzzle.topic.toLowerCase();
  if (usedTopics.has(key)) return;
  usedTopics.add(key);
  bucket.push(puzzle);
}

export async function GET(request: Request) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  const q = normalizeTopicQuery(raw);

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Enter at least 2 characters for a topic" },
      { status: 400 },
    );
  }

  const db = await getDB();
  const today = utcToday();
  const { results } = await db
    .prepare("SELECT * FROM pool_puzzles WHERE status = 'approved'")
    .all<PoolPuzzleRow>();

  const matched = matchPoolRows(results ?? [], q);
  const puzzles: PuzzlePublic[] = sampleMatchedOnly(matched, today, q);
  const usedTopics = new Set(puzzles.map((p) => p.topic.toLowerCase()));

  // Cached pool hit — fastest path
  if (puzzles.length >= SET_SIZE) {
    return NextResponse.json(
      {
        set_id: setIdFor(today, `topic:${q}`),
        date: today,
        mode: `topic:${q}`,
        query: q,
        matched: matched.length,
        source: "pool",
        ms: Date.now() - started,
        puzzles: puzzles.slice(0, SET_SIZE),
      },
      { headers: { "Cache-Control": "public, max-age=600" } },
    );
  }

  let wikiError: string | null = null;
  const collectedArticles: WikiArticle[] = [];

  try {
    const titles = await relatedWikipediaTitles(raw.trim() || q);
    const generated: PuzzlePublic[] = [...puzzles];
    // rebuild used from generated which starts as pool matches
    // (puzzles already in usedTopics)

    if (!titles.length) {
      wikiError =
        "Wikipedia is busy or returned no articles. Try again in a moment.";
    }

    // Few small waves, then pad from variants (no extra network)
    const waveSize = 3;
    for (
      let i = 0;
      i < Math.min(titles.length, 12) && generated.length < SET_SIZE;
      i += waveSize
    ) {
      const articles = await fetchWikipediaExtracts(
        titles.slice(i, i + waveSize),
        waveSize,
      );
      collectedArticles.push(...articles);
      for (const article of articles) {
        tryAdd(article, q, 0, usedTopics, generated);
        if (generated.length >= SET_SIZE) break;
      }
    }

    for (const variant of [1, 2, 3]) {
      if (generated.length >= SET_SIZE) break;
      for (const article of collectedArticles) {
        tryAdd(article, q, variant, usedTopics, generated);
        if (generated.length >= SET_SIZE) break;
      }
    }

    puzzles.length = 0;
    puzzles.push(...generated);

    const fresh = generated.filter((p) => p.id.startsWith("gen-"));
    if (fresh.length) void persistGenerated(fresh);
  } catch (err) {
    wikiError = err instanceof Error ? err.message : "Wikipedia fetch failed";
    console.error("topic wikipedia generation failed", err);
  }

  if (puzzles.length < SET_SIZE) {
    return NextResponse.json(
      {
        error:
          puzzles.length > 0
            ? `Only found ${puzzles.length}/10 on-topic puzzles for “${raw.trim()}”. Wait a few seconds and try again (Wikipedia rate limits).`
            : `Could not build puzzles for “${raw.trim()}” yet. Wait a moment and retry — first-time topics hit Wikipedia live.`,
        needed: SET_SIZE,
        available: puzzles.length,
        matched: matched.length,
        wikiError,
        ms: Date.now() - started,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      set_id: setIdFor(today, `topic:${q}`),
      date: today,
      mode: `topic:${q}`,
      query: q,
      matched: matched.length,
      source: matched.length >= SET_SIZE ? "pool" : "wikipedia",
      ms: Date.now() - started,
      puzzles: puzzles.slice(0, SET_SIZE),
    },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
}
