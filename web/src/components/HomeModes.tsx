"use client";

import Link from "next/link";
import { TopicPicker } from "@/components/TopicPicker";

const MODES = [
  {
    href: "/daily",
    title: "Daily Subtle Lie",
    kicker: "One puzzle · UTC day",
    body: "Today’s single challenge. Same lie for everyone until midnight UTC.",
    delay: "animate-rise-delay-1",
  },
  {
    href: "/categories",
    title: "Categories",
    kicker: "8 worlds · 10 each",
    body: "Pick a lane. Ten fresh lies from that category, refreshed every day.",
    delay: "animate-rise-delay-2",
  },
  {
    href: "/play/random",
    title: "Random Lie",
    kicker: "Cross-cut · 10 mix",
    body: "A shuffled stack from the whole pool. No theme. Pure instinct.",
    delay: "animate-rise-delay-3",
  },
] as const;

export function HomeModes() {
  return (
    <div className="flex flex-col gap-10">
      <div className="animate-rise max-w-xl">
        <p className="mt-2 text-lg leading-relaxed text-muted sm:text-xl">
          Facts with one soft fracture. Choose how you want to hunt it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {MODES.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className={`mode-tile group relative overflow-hidden rounded-[1.6rem] border border-line bg-bg-elevated/80 p-6 ${mode.delay}`}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/15 blur-2xl transition group-hover:bg-accent/25" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              {mode.kicker}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {mode.title}
            </h2>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
              {mode.body}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Enter
              <span aria-hidden className="transition group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        ))}

        <TopicPicker />
      </div>
    </div>
  );
}
