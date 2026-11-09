import { obfuscateReveal } from "@/lib/reveal";
import type { ArchiveItem, PuzzlePublic, PuzzleRow } from "@/types";

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function rowToPublic(row: PuzzleRow): PuzzlePublic {
  let sentences: string[];
  try {
    sentences = JSON.parse(row.sentences) as string[];
  } catch {
    sentences = [];
  }

  return {
    id: row.date,
    date: row.date,
    category: row.category,
    topic: row.topic,
    sentences,
    source_url: row.source_url,
    source_license: row.source_license || "CC BY-SA 4.0",
    reveal: obfuscateReveal(row.date, Number(row.lie_index), row.truth),
  };
}

export function rowToArchive(
  row: Pick<PuzzleRow, "date" | "category" | "topic">,
): ArchiveItem {
  return {
    date: row.date,
    category: row.category,
    topic: row.topic,
  };
}
