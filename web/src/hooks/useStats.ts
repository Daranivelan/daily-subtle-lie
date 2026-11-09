"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameStats } from "@/types";

const STORAGE_KEY = "dsl-stats-v1";

const EMPTY: GameStats = {
  streak: 0,
  totalCorrect: 0,
  totalPlayed: 0,
  lastPlayedDate: null,
  history: {},
  setsCompleted: 0,
};

function load(): GameStats {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as GameStats) };
  } catch {
    return EMPTY;
  }
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function useStats() {
  const [stats, setStats] = useState<GameStats>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStats(load());
    setReady(true);
  }, []);

  const persist = useCallback((next: GameStats) => {
    setStats(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const recordResult = useCallback(
    (date: string, correct: boolean, guessIndex: number) => {
      setStats((prev) => {
        const already = Boolean(prev.history[date]);
        const consecutive =
          prev.lastPlayedDate === dayBefore(date) ? prev.streak : 0;
        const next: GameStats = {
          ...prev,
          streak: correct ? (already ? prev.streak : consecutive + 1) : 0,
          totalCorrect: already
            ? prev.totalCorrect -
              (prev.history[date]?.correct ? 1 : 0) +
              (correct ? 1 : 0)
            : prev.totalCorrect + (correct ? 1 : 0),
          totalPlayed: already ? prev.totalPlayed : prev.totalPlayed + 1,
          lastPlayedDate: date,
          history: {
            ...prev.history,
            [date]: { correct, guessIndex },
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const clearResult = useCallback((date: string) => {
    setStats((prev) => {
      if (!prev.history[date]) return prev;
      const { [date]: removed, ...history } = prev.history;
      const next: GameStats = {
        ...prev,
        totalCorrect: prev.totalCorrect - (removed.correct ? 1 : 0),
        totalPlayed: Math.max(0, prev.totalPlayed - 1),
        history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const recordSetCompleted = useCallback(() => {
    setStats((prev) => {
      const next = { ...prev, setsCompleted: (prev.setsCompleted || 0) + 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getResult = useCallback(
    (date: string) => stats.history[date] ?? null,
    [stats.history],
  );

  return {
    stats,
    ready,
    recordResult,
    clearResult,
    recordSetCompleted,
    getResult,
    persist,
  };
}
