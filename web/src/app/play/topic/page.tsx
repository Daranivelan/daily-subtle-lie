import { Suspense } from "react";
import { TopicPlayClient } from "@/components/TopicPlayClient";

export default function TopicPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TopicPlay searchParams={searchParams} />
    </Suspense>
  );
}

async function TopicPlay({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <TopicPlayClient query={q ?? ""} />;
}
