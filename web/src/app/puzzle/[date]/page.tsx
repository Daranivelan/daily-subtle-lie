import { Suspense } from "react";
import { PuzzleDateClient } from "@/components/PuzzleDateClient";

export default function PuzzleDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading puzzle…</p>}>
      <PuzzleDate params={params} />
    </Suspense>
  );
}

async function PuzzleDate({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return <PuzzleDateClient date={date} />;
}
