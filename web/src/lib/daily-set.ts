import { obfuscateReveal } from "@/lib/reveal";
import type { PoolPuzzleRow, PuzzlePublic } from "@/types";

const SET_SIZE = 10;

/** FNV-1a 32-bit hash for stable daily seeds. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function setIdFor(date: string, key: string): string {
  return `${date}:${key}`;
}

export function poolRowToPublic(row: PoolPuzzleRow): PuzzlePublic {
  let sentences: string[];
  try {
    sentences = JSON.parse(row.sentences) as string[];
  } catch {
    sentences = [];
  }

  return {
    id: row.id,
    category: row.category,
    topic: row.topic,
    sentences,
    source_url: row.source_url,
    source_license: row.source_license || "CC BY-SA 4.0",
    reveal: obfuscateReveal(row.id, Number(row.lie_index), row.truth),
  };
}

export function sampleDailySet(
  rows: PoolPuzzleRow[],
  date: string,
  key: string,
): { setId: string; puzzles: PuzzlePublic[] } | null {
  if (rows.length < SET_SIZE) return null;
  const seed = hashSeed(`${date}:${key}`);
  const picked = seededShuffle(rows, seed).slice(0, SET_SIZE);
  return {
    setId: setIdFor(date, key),
    puzzles: picked.map(poolRowToPublic),
  };
}

export function normalizeTopicQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export function matchPoolRows(
  rows: PoolPuzzleRow[],
  query: string,
): PoolPuzzleRow[] {
  const q = normalizeTopicQuery(query);
  if (!q) return [];
  return rows.filter((row) => {
    const topic = row.topic.toLowerCase();
    const category = row.category.toLowerCase().replace(/_/g, " ");
    // Strict: full phrase in topic, or exact category label match
    if (topic.includes(q)) return true;
    if (category === q) return true;
    if (q.includes(topic) && topic.length >= 6) return true;
    return false;
  });
}

/**
 * Sample only from already-matched pool rows (no unrelated padding).
 * Returns fewer than 10 when the pool lacks coverage — caller should generate.
 */
export function sampleMatchedOnly(
  matched: PoolPuzzleRow[],
  date: string,
  query: string,
): PuzzlePublic[] {
  const q = normalizeTopicQuery(query);
  const seed = hashSeed(`${date}:topic:${q}`);
  return seededShuffle(matched, seed)
    .slice(0, SET_SIZE)
    .map(poolRowToPublic);
}

export { SET_SIZE };
