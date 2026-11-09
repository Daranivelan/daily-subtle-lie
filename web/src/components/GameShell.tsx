"use client";

import { useEffect, useState } from "react";
import { PuzzleCard } from "@/components/PuzzleCard";
import { RevealView } from "@/components/RevealView";
import { useStats } from "@/hooks/useStats";
import { deobfuscateReveal } from "@/lib/reveal";
import { utcToday } from "@/lib/puzzle";
import type { PuzzlePublic, RevealPayload } from "@/types";

type Props = {
  puzzle: PuzzlePublic;
  compact?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  /**
   * When true (default for today's daily), jump straight to the saved reveal
   * if this date was already answered. Archive passes false so past days stay playable.
   */
  autoShowResult?: boolean;
};

export function GameShell({
  puzzle,
  compact = false,
  onContinue,
  continueLabel = "Next",
  autoShowResult,
}: Props) {
  const { stats, ready, recordResult, clearResult, getResult } = useStats();
  const today = utcToday();
  const isToday = puzzle.date === today;
  // Archive / past days: always allow answering. Today: restore result by default.
  const shouldAutoShow = autoShowResult ?? isToday;

  const prior =
    ready && puzzle.date ? getResult(puzzle.date) : null;

  const [phase, setPhase] = useState<"play" | "results">("play");
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the puzzle changes.
  useEffect(() => {
    setSelected(null);
    setReveal(null);
    setError(null);
    setPhase("play");
  }, [puzzle.id]);

  // Optionally restore today's saved result once stats are ready.
  useEffect(() => {
    if (!ready || !shouldAutoShow || !puzzle.date) return;
    const saved = getResult(puzzle.date);
    if (!saved) return;
    const payload = deobfuscateReveal(puzzle.id, puzzle.reveal);
    if (!payload) return;
    setSelected(Number(saved.guessIndex));
    setReveal(payload);
    setPhase("results");
  }, [ready, shouldAutoShow, puzzle.date, puzzle.id, puzzle.reveal, getResult]);

  function startPlayAgain() {
    if (puzzle.date) clearResult(puzzle.date);
    setSelected(null);
    setReveal(null);
    setError(null);
    setPhase("play");
  }

  function onSubmit() {
    if (selected === null) return;
    setError(null);

    const payload = deobfuscateReveal(puzzle.id, puzzle.reveal);
    if (!payload) {
      setError("Could not reveal the answer. Refresh and try again.");
      return;
    }

    setReveal(payload);
    setPhase("results");
    if (puzzle.date) {
      recordResult(puzzle.date, selected === payload.lie_index, selected);
    }
  }

  if (!ready) {
    return <p className="text-muted">Loading…</p>;
  }

  if (phase === "results" && reveal && selected !== null) {
    return (
      <div className="flex flex-col gap-4">
        <RevealView
          puzzle={puzzle}
          reveal={reveal}
          guessIndex={selected}
          streak={stats.streak}
          totalCorrect={stats.totalCorrect}
          totalPlayed={stats.totalPlayed}
          compact={compact}
          onContinue={onContinue}
          continueLabel={continueLabel}
        />
        {!compact ? (
          <button
            type="button"
            onClick={startPlayAgain}
            className="self-start rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent"
          >
            Play again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {prior && !shouldAutoShow ? (
        <p className="text-sm text-muted">
          You played this one before — pick a sentence to try again.
        </p>
      ) : null}
      <PuzzleCard
        puzzle={puzzle}
        selected={selected}
        onSelect={setSelected}
        onSubmit={onSubmit}
      />
      {error ? <p className="text-sm text-brick">{error}</p> : null}
    </div>
  );
}
