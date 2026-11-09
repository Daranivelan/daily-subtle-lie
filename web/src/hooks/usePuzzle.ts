"use client";

import { useEffect, useState } from "react";
import type { PuzzlePublic } from "@/types";

type State = {
  puzzle: PuzzlePublic | null;
  loading: boolean;
  error: string | null;
};

export function usePuzzle(date?: string) {
  const [state, setState] = useState<State>({
    puzzle: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const url = date ? `/api/puzzle/${date}` : "/api/today";

    setState({ puzzle: null, loading: true, error: null });

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<PuzzlePublic>;
      })
      .then((puzzle) => {
        if (!cancelled) {
          setState({ puzzle, loading: false, error: null });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setState({
            puzzle: null,
            loading: false,
            error: err.message || "Failed to load puzzle",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return state;
}
