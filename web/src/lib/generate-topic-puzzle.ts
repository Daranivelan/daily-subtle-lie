import { obfuscateReveal } from "@/lib/reveal";
import type { WikiArticle } from "@/lib/wikipedia";
import type { PuzzlePublic } from "@/types";

const SWAP_PAIRS: [RegExp, string][] = [
  [/\bfirst\b/i, "last"],
  [/\blast\b/i, "first"],
  [/\blargest\b/i, "smallest"],
  [/\bsmallest\b/i, "largest"],
  [/\bnorth\b/i, "south"],
  [/\bsouth\b/i, "north"],
  [/\bbefore\b/i, "after"],
  [/\bafter\b/i, "before"],
  [/\binvented\b/i, "banned"],
  [/\bcreated\b/i, "destroyed"],
  [/\breleased\b/i, "cancelled"],
  [/\bpublished\b/i, "rejected"],
  [/\bwon\b/i, "lost"],
  [/\bincreased\b/i, "decreased"],
  [/\bpopular\b/i, "obscure"],
  [/\bdigital\b/i, "analog"],
  [/\belectronic\b/i, "mechanical"],
  [/\bcomputer\b/i, "radio"],
  [/\bJapan\b/, "Brazil"],
  [/\bUnited States\b/, "Belgium"],
  [/\bAmerica\b/, "Australia"],
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^"+|"+$/g, ""))
    .filter((s) => s.length >= 35 && s.length <= 280)
    .filter((s) => !s.startsWith("="))
    .filter((s) => /[A-Za-z]/.test(s))
    .filter((s) => (s.match(/[.!?]$/) ? true : s.length > 40));
}

function mutateSentence(sentence: string, salt: number): string {
  const yearMatch = sentence.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const delta = (salt % 17) + 3;
    const wrong = year + (salt % 2 === 0 ? delta : -delta);
    return sentence.replace(yearMatch[1]!, String(Math.max(1000, wrong)));
  }

  const numMatch = sentence.match(/\b([2-9]\d{0,3})(\.\d+)?\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    const wrong = n + ((salt % 7) + 2);
    return sentence.replace(numMatch[0]!, String(wrong) + (numMatch[2] ?? ""));
  }

  for (const [pattern, replacement] of SWAP_PAIRS) {
    if (pattern.test(sentence)) {
      pattern.lastIndex = 0;
      return sentence.replace(pattern, replacement);
    }
  }

  if (/\bis\b/i.test(sentence)) {
    return sentence.replace(/\bis\b/i, "is not");
  }
  if (/\bwas\b/i.test(sentence)) {
    return sentence.replace(/\bwas\b/i, "was never");
  }
  if (/\bwere\b/i.test(sentence)) {
    return sentence.replace(/\bwere\b/i, "were never");
  }

  // Guaranteed subtle-ish corruption: nudge a mid-sentence word.
  const words = sentence.split(" ");
  if (words.length > 6) {
    const idx = 3 + (salt % Math.min(5, words.length - 4));
    const decoys = ["rarely", "never", "falsely", "supposedly", "unofficially"];
    words.splice(idx, 0, decoys[salt % decoys.length]!);
    return words.join(" ");
  }

  return `Contrary to records, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}

function categoryFromQuery(query: string): string {
  const q = query.toLowerCase();
  if (/game|gaming|console|nintendo|playstation|xbox|esport/.test(q)) {
    return "technology";
  }
  if (/body|brain|sleep|heart|blood/.test(q)) return "human_body";
  if (/war|empire|king|ancient|revolution/.test(q)) return "history";
  if (/river|mountain|ocean|desert|city/.test(q)) return "geography";
  if (/animal|plant|forest|climate/.test(q)) return "nature";
  if (/sport|football|cricket|olympi/.test(q)) return "sports";
  if (/art|music|paint|film|theatre|theater/.test(q)) return "arts";
  if (/computer|software|internet|chip|ai\b/.test(q)) return "technology";
  return "science";
}

function stableId(title: string, query: string, variant = 0): string {
  const raw = `topic:${query}:${title}:v${variant}`.toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `gen-${(h >>> 0).toString(16)}`;
}

/** Build one spot-the-lie puzzle from a Wikipedia extract (no LLM required). */
export function puzzleFromWikipedia(
  article: WikiArticle,
  query: string,
  variant = 0,
): PuzzlePublic | null {
  const candidates = splitSentences(article.extract);
  if (candidates.length < 5) return null;

  const id = stableId(article.title, query, variant);
  let salt = 0;
  for (let i = 0; i < id.length; i++) salt = (salt + id.charCodeAt(i) * (i + 1)) % 997;

  const window = Math.max(1, candidates.length - 4);
  const start = (salt + variant * 3) % window;
  let truths = candidates.slice(start, start + 6);
  if (truths.length < 5) truths = candidates.slice(0, 6);
  if (truths.length < 5) return null;

  // Prefer a distinct sentence window for higher variants
  if (variant > 0 && candidates.length >= 8) {
    const offset = Math.min(variant * 3, Math.max(0, candidates.length - 6));
    const alt = candidates.slice(offset, offset + 6);
    if (alt.length >= 5) truths = alt;
  }

  const lieIndex = (salt + variant) % truths.length;
  const truth = truths[lieIndex]!;
  const lie = mutateSentence(truth, salt + 13 + variant * 7);
  if (!lie || lie === truth) return null;

  const sentences = [...truths];
  sentences[lieIndex] = lie;

  const topic =
    variant > 0 ? `${article.title} · part ${variant + 1}` : article.title;

  return {
    id,
    category: categoryFromQuery(query),
    topic,
    sentences,
    source_url: article.url,
    source_license: "CC BY-SA 4.0",
    reveal: obfuscateReveal(id, lieIndex, truth),
  };
}

