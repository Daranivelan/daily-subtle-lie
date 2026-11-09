"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopicPicker() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = topic.trim();
    if (q.length < 2) {
      setError("Type at least 2 characters.");
      return;
    }
    setError(null);
    router.push(`/play/topic?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="mode-tile animate-rise relative overflow-hidden rounded-[1.6rem] border border-line bg-bg-elevated/80 p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
        Custom · 10 mix
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Choose a topic
      </h2>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
        Type anything you feel like hunting — we’ll pull related Wikipedia
        topics and build a fresh ten-lie run around them.
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="topic-input">
          Topic
        </label>
        <input
          id="topic-input"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. volcano, Apollo, sleep…"
          maxLength={80}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          Play 10
        </button>
      </form>
      {error ? <p className="text-sm text-brick">{error}</p> : null}
    </section>
  );
}
