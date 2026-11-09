"use client";

import type { PuzzlePublic } from "@/types";
import { categoryLabel } from "@/lib/categories";

type Props = {
  puzzle: PuzzlePublic;
  selected: number | null;
  onSelect: (index: number) => void;
  onSubmit: () => void;
};

export function PuzzleCard({ puzzle, selected, onSelect, onSubmit }: Props) {
  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {categoryLabel(puzzle.category)}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
          {puzzle.topic}
        </h2>
        <p className="text-base text-muted">Which sentence is the lie?</p>
      </header>

      <ol className="flex flex-col gap-3">
        {puzzle.sentences.map((sentence, index) => {
          const isSelected = selected === index;
          return (
            <li key={index} className="animate-rise">
              <button
                type="button"
                onClick={() => onSelect(index)}
                className={[
                  "w-full rounded-2xl border px-4 py-3.5 text-left transition",
                  isSelected
                    ? "border-accent bg-accent/10 shadow-[inset_4px_0_0_0_var(--accent)]"
                    : "border-line bg-bg-elevated/70 hover:border-accent/50",
                ].join(" ")}
              >
                <span className="mr-3 inline-block w-6 font-display text-sm text-muted">
                  {index + 1}.
                </span>
                <span className="text-[1rem] leading-relaxed text-ink">
                  {sentence}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={selected === null}
        onClick={onSubmit}
        className="rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold tracking-wide text-accent-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Spot the lie
      </button>
    </section>
  );
}
