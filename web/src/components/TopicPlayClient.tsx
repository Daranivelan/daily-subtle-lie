"use client";

import Link from "next/link";
import { RunShell } from "@/components/RunShell";

type Props = {
  query: string;
};

export function TopicPlayClient({ query }: Props) {
  const q = query.trim();

  if (q.length < 2) {
    return (
      <div className="flex flex-col gap-3 animate-rise">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Choose a topic
        </h1>
        <p className="text-muted">Enter a topic of at least 2 characters.</p>
        <Link href="/" className="text-accent hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  const title =
    q.charAt(0).toUpperCase() + q.slice(1);
  const endpoint = `/api/modes/topic/today?q=${encodeURIComponent(q)}`;

  return <RunShell endpoint={endpoint} title={title} />;
}
