import {
  SET_SIZE,
  matchPoolRows,
  normalizeTopicQuery,
  sampleMatchedOnly,
  setIdFor,
} from "@/lib/daily-set";
import { getDB, getEnv } from "@/lib/d1";
import { puzzleFromWikipedia } from "@/lib/generate-topic-puzzle";
import { generateLlmPuzzles, hasLlmKeys } from "@/lib/llm-puzzle";
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

function tryHeuristicAdd(
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
  const env = await getEnv();
  const llmKeys = hasLlmKeys(env);
  const today = utcToday();
  const { results } = await db
    .prepare("SELECT * FROM pool_puzzles WHERE status = 'approved'")
    .all<PoolPuzzleRow>();

  const matched = matchPoolRows(results ?? [], q);
  const puzzles: PuzzlePublic[] = sampleMatchedOnly(matched, today, q);
  const usedTopics = new Set(puzzles.map((p) => p.topic.toLowerCase()));

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
  let llmError: string | null = null;
  let llmBuilt = 0;
  let heuristicBuilt = 0;
  const collectedArticles: WikiArticle[] = [];

  try {
    const titles = await relatedWikipediaTitles(raw.trim() || q);
    if (!titles.length) {
      wikiError =
        "Wikipedia is busy or returned no articles. Try again in a moment.";
    }

    const waveSize = 3;
    for (
      let i = 0;
      i < Math.min(titles.length, 12) && collectedArticles.length < 12;
      i += waveSize
    ) {
      const articles = await fetchWikipediaExtracts(
        titles.slice(i, i + waveSize),
        waveSize,
      );
      collectedArticles.push(...articles);
    }

    // Prefer Gemini + Jev for missing slots (same quality as nightly generator).
    if (llmKeys && puzzles.length < SET_SIZE && collectedArticles.length) {
      try {
        const need = SET_SIZE - puzzles.length;
        const llmPuzzles = await generateLlmPuzzles(
          collectedArticles,
          q,
          llmKeys,
          need,
          usedTopics,
          2,
        );
        llmBuilt = llmPuzzles.length;
        puzzles.push(...llmPuzzles);
        if (llmPuzzles.length) void persistGenerated(llmPuzzles);
      } catch (err) {
        llmError = err instanceof Error ? err.message : "LLM generation failed";
        console.error("topic llm generation failed", err);
      }
    } else if (!llmKeys && puzzles.length < SET_SIZE) {
      llmError = "GEMINI_API_KEY / TYPESAFE_API_KEY not configured on the worker";
    }

    // Heuristic Wikipedia fill only if still short (fallback).
    if (puzzles.length < SET_SIZE) {
      for (const article of collectedArticles) {
        tryHeuristicAdd(article, q, 0, usedTopics, puzzles);
        if (puzzles.length >= SET_SIZE) break;
      }
      for (const variant of [1, 2, 3]) {
        if (puzzles.length >= SET_SIZE) break;
        for (const article of collectedArticles) {
          tryHeuristicAdd(article, q, variant, usedTopics, puzzles);
          if (puzzles.length >= SET_SIZE) break;
        }
      }
      heuristicBuilt = puzzles.length - matched.length - llmBuilt;
      const freshHeuristic = puzzles.filter((p) => p.id.startsWith("gen-"));
      if (freshHeuristic.length) void persistGenerated(freshHeuristic);
    }
  } catch (err) {
    wikiError = err instanceof Error ? err.message : "Wikipedia fetch failed";
    console.error("topic wikipedia generation failed", err);
  }

  if (puzzles.length < SET_SIZE) {
    return NextResponse.json(
      {
        error:
          puzzles.length > 0
            ? `Only found ${puzzles.length}/10 on-topic puzzles for “${raw.trim()}”. Wait a few seconds and try again.`
            : `Could not build puzzles for “${raw.trim()}” yet. Wait a moment and retry.`,
        needed: SET_SIZE,
        available: puzzles.length,
        matched: matched.length,
        llmBuilt,
        wikiError,
        llmError,
        ms: Date.now() - started,
      },
      { status: 503 },
    );
  }

  const source =
    llmBuilt > 0 && heuristicBuilt <= 0 && matched.length === 0
      ? "gemini+jev"
      : llmBuilt > 0
        ? "mixed"
        : matched.length >= SET_SIZE
          ? "pool"
          : "wikipedia";

  return NextResponse.json(
    {
      set_id: setIdFor(today, `topic:${q}`),
      date: today,
      mode: `topic:${q}`,
      query: q,
      matched: matched.length,
      llmBuilt,
      source,
      ms: Date.now() - started,
      puzzles: puzzles.slice(0, SET_SIZE),
    },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
}
