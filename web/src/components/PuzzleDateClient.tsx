"use client";

import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { usePuzzle } from "@/hooks/usePuzzle";

type Props = {
  date: string;
};

export function PuzzleDateClient({ date }: Props) {
  const { puzzle, loading, error } = usePuzzle(date);

  if (loading) {
    return <p className="text-muted">Loading puzzle…</p>;
  }

  if (error || !puzzle) {
    return (
      <div className="flex flex-col gap-3 animate-rise">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Puzzle not found
        </h1>
        <p className="text-muted">
          {error || "No approved puzzle for this date."}
        </p>
        <Link
          href="/archive"
          className="text-accent underline-offset-2 hover:underline"
        >
          Back to archive
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-rise">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Archive puzzle
        </p>
        <p className="mt-1 text-sm text-muted">{puzzle.date}</p>
      </div>
      {/* autoShowResult=false → always allow answering past days */}
      <GameShell key={puzzle.id} puzzle={puzzle} autoShowResult={false} />
      <Link
        href="/archive"
        className="text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        ← Back to archive
      </Link>
    </div>
  );
}
