"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

function HeaderInner() {
  const pathname = usePathname();
  const { theme, toggle, ready } = useTheme();
  const isHome = pathname === "/";

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-8 sm:px-6">
      <Link href="/" className="group block min-w-0">
        <span
          className={[
            "font-display font-semibold tracking-tight text-ink transition group-hover:text-accent",
            isHome ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
          ].join(" ")}
        >
          Daily Subtle Lie
        </span>
      </Link>
      <nav className="flex shrink-0 items-center gap-3 text-sm font-medium text-muted">
        <Link href="/archive" className="hover:text-accent">
          Archive
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          className="rounded-full border border-line bg-bg-elevated px-3 py-1.5 text-ink transition hover:border-accent"
        >
          {ready ? (theme === "dark" ? "Light" : "Dark") : "…"}
        </button>
      </nav>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense
      fallback={
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-8 sm:px-6">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Daily Subtle Lie
          </span>
        </header>
      }
    >
      <HeaderInner />
    </Suspense>
  );
}
