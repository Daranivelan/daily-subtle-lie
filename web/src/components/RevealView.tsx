"use client";

import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { categoryLabel } from "@/lib/categories";
import type { PuzzlePublic, RevealPayload } from "@/types";

type Props = {
  puzzle: PuzzlePublic;
  reveal: RevealPayload;
  guessIndex: number;
  streak: number;
  totalCorrect: number;
  totalPlayed: number;
  compact?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
};

export function RevealView({
  puzzle,
  reveal,
  guessIndex,
  streak,
  totalCorrect,
  totalPlayed,
  compact = false,
  onContinue,
  continueLabel = "Next",
}: Props) {
  const correct = guessIndex === reveal.lie_index;

  return (
    <section className="flex w-full flex-col gap-6 animate-rise">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {categoryLabel(puzzle.category)}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
          {puzzle.topic}
        </h2>
        <p
          className={[
            "font-display text-2xl font-semibold",
            correct ? "text-sage" : "text-brick",
          ].join(" ")}
        >
          {correct ? "Caught it." : "So close."}
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {puzzle.sentences.map((sentence, index) => {
          const isLie = index === reveal.lie_index;
          const isGuess = index === guessIndex;
          return (
            <li
              key={index}
              className={[
                "rounded-2xl border px-4 py-3.5",
                isLie
                  ? "border-brick bg-brick-soft"
                  : isGuess
                    ? "border-accent/50 bg-accent/10"
                    : "border-line bg-bg-elevated/60",
              ].join(" ")}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-block w-6 font-display text-sm text-muted">
                  {index + 1}.
                </span>
                {isGuess ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Your pick
                  </span>
                ) : null}
                {isLie ? (
                  <span className="rounded-full bg-brick/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brick">
                    The lie
                  </span>
                ) : null}
              </div>
              <span
                className={[
                  "text-[1rem] leading-relaxed",
                  isLie ? "text-brick line-through" : "text-ink",
                ].join(" ")}
              >
                {sentence}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-sage/30 bg-sage-soft px-4 py-3">
        <p className="text-sm font-semibold text-sage">Actually</p>
        <p className="mt-1 text-[1rem] leading-relaxed text-ink">
          {reveal.truth}
        </p>
      </div>

      <p className="text-sm text-muted">
        Source:{" "}
        <a
          href={puzzle.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Wikipedia — {puzzle.topic}
        </a>{" "}
        ({puzzle.source_license || "CC BY-SA 4.0"})
      </p>

      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted">Streak</dt>
              <dd className="font-display text-lg font-semibold">{streak}</dd>
            </div>
            <div>
              <dt className="text-muted">Correct</dt>
              <dd className="font-display text-lg font-semibold">
                {totalCorrect}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Played</dt>
              <dd className="font-display text-lg font-semibold">
                {totalPlayed}
              </dd>
            </div>
          </dl>
          <ShareButton
            date={puzzle.date || puzzle.id}
            category={puzzle.category}
            sentenceCount={puzzle.sentences.length}
            lieIndex={reveal.lie_index}
            correct={correct}
          />
        </div>
      ) : null}

      {onContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-ink hover:brightness-110"
        >
          {continueLabel}
        </button>
      ) : !compact ? (
        <Link
          href="/archive"
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          See past dailies
        </Link>
      ) : null}
    </section>
  );
}
