/** Launch epoch for puzzle numbering (puzzle #1). */
export const LAUNCH_EPOCH = "2026-11-07";
export const SHARE_URL = "https://dailysubtlelie.com";

export function puzzleNumber(date: string): number {
  const epoch = Date.parse(`${LAUNCH_EPOCH}T00:00:00Z`);
  const day = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(epoch) || Number.isNaN(day)) return 0;
  return Math.floor((day - epoch) / 86_400_000) + 1;
}

export function formatShareText(opts: {
  date: string;
  category: string;
  sentenceCount: number;
  lieIndex: number;
  correct: boolean;
}): string {
  const n = puzzleNumber(opts.date);
  const cat =
    opts.category.charAt(0).toUpperCase() +
    opts.category.slice(1).replace(/_/g, " ");
  const grid = Array.from({ length: opts.sentenceCount }, (_, i) =>
    i === opts.lieIndex ? "🔴" : "🟩",
  ).join("");
  const outcome = opts.correct ? "✓" : "✗";
  return `Daily Subtle Lie #${n} — ${cat} ${outcome}\n${grid}\n${SHARE_URL}`;
}

export function formatRunShareText(opts: {
  title: string;
  correct: number;
  total: number;
}): string {
  const filled = "🟠".repeat(opts.correct);
  const empty = "⬜".repeat(Math.max(0, opts.total - opts.correct));
  return `${opts.title}\n${opts.correct}/${opts.total} ${filled}${empty}\n${SHARE_URL}`;
}
