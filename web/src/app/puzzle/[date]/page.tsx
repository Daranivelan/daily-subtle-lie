import { PuzzleDateClient } from "@/components/PuzzleDateClient";

export default async function PuzzleDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return <PuzzleDateClient date={date} />;
}
