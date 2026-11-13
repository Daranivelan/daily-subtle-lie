import { Suspense } from "react";
import Link from "next/link";
import { RunShell } from "@/components/RunShell";
import { categoryLabel, isCategoryId } from "@/lib/categories";

export default function CategoryPlayPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CategoryPlay params={params} />
    </Suspense>
  );
}

async function CategoryPlay({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategoryId(category)) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold">Unknown category</h1>
        <Link href="/categories" className="text-accent hover:underline">
          Back to categories
        </Link>
      </div>
    );
  }

  return (
    <RunShell
      endpoint={`/api/modes/category/${category}/today`}
      title={categoryLabel(category)}
    />
  );
}
