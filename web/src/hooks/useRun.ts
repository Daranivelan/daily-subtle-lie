"use client";

import { useCallback, useEffect, useState } from "react";
import type { RunAnswer, RunState } from "@/types";

const STORAGE_KEY = "dsl-runs-v1";

type Store = Record<string, RunState>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function readRun(setId: string): RunState {
  const store = loadStore();
  return (
    store[setId] ?? {
      setId,
      index: 0,
      answers: [],
      completed: false,
    }
  );
}

export function useRun(setId: string | null) {
  const [state, setState] = useState<RunState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!setId) {
      setState(null);
      setReady(true);
      return;
    }
    setState(readRun(setId));
    setReady(true);
  }, [setId]);

  const persist = useCallback((next: RunState) => {
    setState(next);
    const store = loadStore();
    store[next.setId] = next;
    saveStore(store);
  }, []);

  const recordAnswer = useCallback(
    (answer: RunAnswer) => {
      if (!setId) return;
      const current = readRun(setId);
      if (current.answers.some((a) => a.puzzleId === answer.puzzleId)) {
        setState(current);
        return;
      }
      persist({
        ...current,
        answers: [...current.answers, answer],
      });
    },
    [setId, persist],
  );

  const advance = useCallback(() => {
    if (!setId) return;
    const current = readRun(setId);
    persist({ ...current, index: current.index + 1 });
  }, [setId, persist]);

  const complete = useCallback(() => {
    if (!setId) return;
    const current = readRun(setId);
    if (current.completed) {
      setState(current);
      return;
    }
    persist({ ...current, completed: true });
  }, [setId, persist]);

  const markScored = useCallback(() => {
    if (!setId) return false;
    const current = readRun(setId);
    if (current.scored) return false;
    persist({ ...current, scored: true });
    return true;
  }, [setId, persist]);

  return { state, ready, recordAnswer, advance, complete, markScored, persist };
}
