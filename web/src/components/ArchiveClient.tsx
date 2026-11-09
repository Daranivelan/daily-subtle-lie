"use client";

import { useEffect, useState } from "react";
import { ArchiveList } from "@/components/ArchiveList";
import { useStats } from "@/hooks/useStats";
import type { ArchiveItem } from "@/types";

export function ArchiveClient() {
  const { stats, ready } = useStats();
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/archive")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load archive");
        return res.json() as Promise<ArchiveItem[]>;
      })
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Archive
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
          Past dailies
        </h1>
        <p className="text-muted">Replay previous Daily Subtle Lie puzzles.</p>
      </header>
      {error ? <p className="text-brick">{error}</p> : null}
      {!items ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <ArchiveList items={items} history={ready ? stats.history : {}} />
      )}
    </div>
  );
}
