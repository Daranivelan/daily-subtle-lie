"use client";

import { useCallback, useEffect, useState } from "react";

type ReviewItem = {
  date: string;
  category: string;
  topic: string;
  sentences: string[];
  lie_index: number;
  truth: string;
  source_url: string;
  status: string;
};

const TOKEN_KEY = "dsl-admin-token";

export function AdminClient() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async (authToken: string) => {
    setError(null);
    const res = await fetch("/api/admin/review", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 401) {
      setAuthed(false);
      setError("Invalid token");
      return;
    }
    if (!res.ok) {
      setError("Failed to load review queue");
      return;
    }
    const data = (await res.json()) as ReviewItem[];
    setItems(data);
    setAuthed(true);
    localStorage.setItem(TOKEN_KEY, authToken);
  }, []);

  useEffect(() => {
    if (authed && token) {
      void load(token);
    }
  }, [authed, token, load]);

  async function act(date: string, action: "approve" | "reject") {
    setBusy(date);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || `Failed to ${action}`);
      }
      setItems((prev) => prev.filter((item) => item.date !== date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  function onLogin(e: React.FormEvent) {
    e.preventDefault();
    void load(token.trim());
  }

  function onLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setAuthed(false);
    setToken("");
    setItems([]);
  }

  if (!authed) {
    return (
      <div className="flex max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Review
          </h1>
          <p className="text-muted">
            Enter the admin token to approve or reject pending puzzles.
          </p>
        </header>
        <form onSubmit={onLogin} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Admin token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="rounded-md border border-line bg-bg-elevated px-3 py-2 text-ink outline-none focus:border-accent"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm text-brick">{error}</p> : null}
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-paper hover:bg-accent-soft"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Review queue
          </h1>
          <p className="mt-1 text-muted">
            {items.length} puzzle{items.length === 1 ? "" : "s"} awaiting review
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-sm text-muted hover:text-accent"
        >
          Sign out
        </button>
      </header>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-muted">Queue is empty.</p>
      ) : (
        <ul className="flex flex-col gap-8">
          {items.map((item) => (
            <li
              key={item.date}
              className="rounded-md border border-line bg-bg-elevated/80 p-4"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    {item.category.replace(/_/g, " ")} · {item.date}
                  </p>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {item.topic}
                  </h2>
                </div>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent underline-offset-2 hover:underline"
                >
                  Source
                </a>
              </div>
              <ol className="mb-3 flex flex-col gap-2">
                {item.sentences.map((sentence, index) => (
                  <li
                    key={index}
                    className={[
                      "rounded px-3 py-2 text-sm leading-relaxed",
                      index === item.lie_index
                        ? "bg-brick-bg text-brick line-through"
                        : "bg-bg-elevated text-ink",
                    ].join(" ")}
                  >
                    <span className="mr-2 text-muted">{index + 1}.</span>
                    {sentence}
                  </li>
                ))}
              </ol>
              <p className="mb-4 text-sm text-sage">
                <span className="font-semibold">Truth:</span> {item.truth}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy === item.date}
                  onClick={() => void act(item.date, "approve")}
                  className="rounded-md bg-sage px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === item.date}
                  onClick={() => void act(item.date, "reject")}
                  className="rounded-md bg-brick px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
