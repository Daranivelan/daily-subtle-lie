"use client";

import { useState } from "react";
import { formatShareText } from "@/lib/share";

type Props = {
  date: string;
  category: string;
  sentenceCount: number;
  lieIndex: number;
  correct: boolean;
};

export function ShareButton({
  date,
  category,
  sentenceCount,
  lieIndex,
  correct,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const text = formatShareText({
      date,
      category,
      sentenceCount,
      lieIndex,
      correct,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onShare}
        className="rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition hover:brightness-110"
      >
        Share result
      </button>
      {copied ? (
        <span className="animate-rise text-sm text-sage">Copied</span>
      ) : null}
    </div>
  );
}
