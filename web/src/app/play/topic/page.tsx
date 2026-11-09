import { TopicPlayClient } from "@/components/TopicPlayClient";

export default async function TopicPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <TopicPlayClient query={q ?? ""} />;
}
