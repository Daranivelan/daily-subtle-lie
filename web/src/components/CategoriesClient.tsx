"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/categories";

type CatRow = {
  id: CategoryId;
  label: string;
  blurb: string;
  pool_count: number;
  ready: boolean;
};

export function CategoriesClient() {
  const [rows, setRows] = useState<CatRow[] | null>(null);

  useEffect(() => {
    fetch("/api/modes/categories")
      .then((r) => r.json())
      .then((data) => {
        const body = data as { categories: CatRow[] };
        setRows(body.categories);
      })
      .catch(() =>
        setRows(
          CATEGORIES.map((c) => ({
            ...c,
            pool_count: 0,
            ready: false,
          })),
        ),
      );
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Categories
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
          Pick a world
        </h1>
        <p className="max-w-lg text-muted">
          Ten lies, one category, refreshed every UTC day. Finish the run for a
          score.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(rows ?? CATEGORIES.map((c) => ({ ...c, pool_count: 0, ready: true }))).map(
          (cat, i) => (
            <Link
              key={cat.id}
              href={cat.ready === false ? "#" : `/play/category/${cat.id}`}
              aria-disabled={cat.ready === false}
              onClick={(e) => {
                if (cat.ready === false) e.preventDefault();
              }}
              className={`mode-tile rounded-[1.4rem] border border-line bg-bg-elevated/80 p-5 animate-rise ${
                cat.ready === false ? "opacity-50 pointer-events-none" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <h2 className="font-display text-2xl font-semibold text-ink">
                {cat.label}
              </h2>
              <p className="mt-2 text-sm text-muted">{cat.blurb}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">
                {cat.ready === false
                  ? `Pool ${cat.pool_count}/10`
                  : "Start 10-run →"}
              </p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
