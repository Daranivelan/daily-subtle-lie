"use client";

import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { usePuzzle } from "@/hooks/usePuzzle";

export function HomeClient() {
  const { puzzle, loading, error } = usePuzzle();

  if (loading) {
    return <p className="text-muted">Loading today’s puzzle…</p>;
  }

  if (error || !puzzle) {
    return (
      <div className="flex flex-col gap-4 animate-rise">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Daily Subtle Lie
        </h1>
        <p className="text-muted">
          {error === "No puzzle today" || !puzzle
            ? "No approved puzzle for today yet. Try Categories or Random while you wait."
            : error}
        </p>
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          Back to modes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-rise">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Daily
        </p>
        <p className="mt-1 text-sm text-muted">{puzzle.date}</p>
      </div>
      <GameShell key={puzzle.id} puzzle={puzzle} autoShowResult />
    </div>
  );
}
