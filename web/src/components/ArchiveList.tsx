"use client";

import Link from "next/link";
import type { ArchiveItem } from "@/types";
import { categoryLabel } from "@/lib/categories";

type Props = {
  items: ArchiveItem[];
  history?: Record<string, { correct: boolean }>;
};

export function ArchiveList({ items, history = {} }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-muted">No past puzzles yet. Check back tomorrow.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const result = history[item.date];
        return (
          <li key={item.date}>
            <Link
              href={`/puzzle/${item.date}`}
              className="flex items-baseline justify-between gap-4 rounded-2xl border border-line bg-bg-elevated/70 px-4 py-3 transition hover:border-accent/50"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-ink">
                  {item.topic}
                </p>
                <p className="text-sm text-muted">
                  {categoryLabel(item.category)} · {item.date}
                </p>
              </div>
              {result ? (
                <span className="shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  <span className={result.correct ? "text-sage" : "text-brick"}>
                    {result.correct ? "Found" : "Missed"}
                  </span>
                  <span className="mt-0.5 block text-accent normal-case tracking-normal">
                    Play again
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-accent">
                  Play
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
