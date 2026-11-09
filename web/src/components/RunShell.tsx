"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PuzzleCard } from "@/components/PuzzleCard";
import { RevealView } from "@/components/RevealView";
import { useRun } from "@/hooks/useRun";
import { useStats } from "@/hooks/useStats";
import { deobfuscateReveal } from "@/lib/reveal";
import { formatRunShareText } from "@/lib/share";
import type { DailySetResponse, PuzzlePublic, RevealPayload } from "@/types";

type Props = {
  endpoint: string;
  title: string;
};

export function RunShell({ endpoint, title }: Props) {
  const [setData, setSetData] = useState<DailySetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(
            (body as { error?: string }).error || `HTTP ${res.status}`,
          );
        }
        return body as DailySetResponse;
      })
      .then((data) => {
        if (!cancelled) {
          setSetData(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-rise">
        <p className="font-display text-2xl font-semibold text-ink">{title}</p>
        <p className="text-muted">
          Building your 10-lie set… first visit can take a few seconds; repeats
          are much faster.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
        </div>
      </div>
    );
  }
  if (error || !setData) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="text-muted">{error || "Set unavailable"}</p>
        <Link href="/" className="text-accent hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return <RunSession title={title} setData={setData} />;
}

function RunSession({
  title,
  setData,
}: {
  title: string;
  setData: DailySetResponse;
}) {
  const { state, ready, recordAnswer, advance, complete, markScored } = useRun(
    setData.set_id,
  );
  const { recordSetCompleted } = useStats();

  const index = state?.index ?? 0;
  const puzzles = setData.puzzles;
  const puzzle: PuzzlePublic | undefined = puzzles[index];
  const done = Boolean(state?.completed) || index >= puzzles.length;

  useEffect(() => {
    if (done && state && !state.completed) {
      complete();
    }
  }, [done, state, complete]);

  useEffect(() => {
    if (state?.completed && !state.scored) {
      if (markScored()) recordSetCompleted();
    }
  }, [state?.completed, state?.scored, markScored, recordSetCompleted]);

  const score = useMemo(() => {
    const answers = state?.answers ?? [];
    return answers.filter((a) => a.correct).length;
  }, [state?.answers]);

  if (!ready || !state) {
    return <p className="text-muted">Loading…</p>;
  }

  if (done || state.completed) {
    return (
      <ScoreScreen
        title={title}
        correct={score}
        total={puzzles.length}
        answers={state.answers}
        puzzles={puzzles}
      />
    );
  }

  if (!puzzle) {
    return <p className="text-muted">Missing puzzle.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {title}
            </p>
            <p className="mt-1 font-display text-lg text-ink">
              {index + 1} / {puzzles.length}
            </p>
          </div>
          <p className="text-sm text-muted">{score} correct so far</p>
        </div>
        <div className="progress-bar h-2 overflow-hidden rounded-full bg-line">
          <span
            className="block h-full rounded-full bg-accent"
            style={{
              width: `${((index + 1) / puzzles.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <RunPuzzle
        key={puzzle.id}
        puzzle={puzzle}
        isLast={index === puzzles.length - 1}
        onAnswered={(guessIndex, correct) => {
          recordAnswer({ puzzleId: puzzle.id, guessIndex, correct });
        }}
        onContinue={() => {
          if (index >= puzzles.length - 1) complete();
          else advance();
        }}
      />
    </div>
  );
}

function RunPuzzle({
  puzzle,
  isLast,
  onAnswered,
  onContinue,
}: {
  puzzle: PuzzlePublic;
  isLast: boolean;
  onAnswered: (guessIndex: number, correct: boolean) => void;
  onContinue: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);

  function onSubmit() {
    if (selected === null || reveal) return;
    setError(null);
    const payload = deobfuscateReveal(puzzle.id, puzzle.reveal);
    if (!payload) {
      setError("Could not reveal the answer. Refresh and try again.");
      return;
    }
    setReveal(payload);
    if (!reported.current) {
      reported.current = true;
      onAnswered(selected, selected === payload.lie_index);
    }
  }

  if (reveal && selected !== null) {
    return (
      <RevealView
        puzzle={puzzle}
        reveal={reveal}
        guessIndex={selected}
        streak={0}
        totalCorrect={0}
        totalPlayed={0}
        compact
        onContinue={onContinue}
        continueLabel={isLast ? "See score" : "Next lie"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
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

function ScoreScreen({
  title,
  correct,
  total,
  answers,
  puzzles,
}: {
  title: string;
  correct: number;
  total: number;
  answers: { puzzleId: string; correct: boolean }[];
  puzzles: PuzzlePublic[];
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = formatRunShareText({ title, correct, total });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="flex flex-col gap-6 animate-rise">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Run complete
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink">
          {correct}/{total}
        </h1>
        <p className="mt-2 text-muted">{title}</p>
      </header>

      <ul className="flex flex-col gap-2">
        {puzzles.map((p, i) => {
          const ans = answers.find((a) => a.puzzleId === p.id);
          return (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-line bg-bg-elevated/70 px-4 py-3 text-sm"
            >
              <span className="text-ink">
                {i + 1}. {p.topic}
              </span>
              <span className={ans?.correct ? "text-sage" : "text-brick"}>
                {ans?.correct ? "Found" : "Missed"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={share}
          className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
        >
          {copied ? "Copied" : "Share score"}
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink hover:border-accent"
        >
          Home
        </Link>
      </div>
    </section>
  );
}
