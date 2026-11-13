import { obfuscateReveal } from "@/lib/reveal";
import type { WikiArticle } from "@/lib/wikipedia";
import type { PuzzlePublic } from "@/types";

const SYSTEM = [
  "Using only the source text, write 5 to 8 sentences explaining the topic",
  "to a curious adult. Every sentence must be stated in the source. Then pick",
  "one sentence and write a replacement that is fluent, plausible, and",
  "factually wrong in one subtle detail such as a name, date, number, cause,",
  "or direction. Return JSON with keys sentences (array), replace_index (number),",
  "and lie (string).",
].join(" ");

export type LlmKeys = {
  geminiApiKey: string;
  typesafeApiKey: string;
};

type Draft = {
  sentences: string[];
  replace_index: number;
  lie: string;
};

type NoulAnswer = { noul?: number; type?: string };

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

function stableId(title: string, query: string): string {
  const raw = `llm:${query}:${title}`.toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `llm-${(h >>> 0).toString(16)}`;
}

function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const sentences = obj.sentences;
  const lie = obj.lie;
  const replaceIndex = Number(obj.replace_index);
  if (!Array.isArray(sentences) || typeof lie !== "string") return null;
  const cleaned = sentences
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (cleaned.length < 5 || cleaned.length > 8) return null;
  if (!Number.isInteger(replaceIndex) || replaceIndex < 0 || replaceIndex >= cleaned.length) {
    return null;
  }
  if (!lie.trim()) return null;
  return { sentences: cleaned, replace_index: replaceIndex, lie: lie.trim() };
}

async function geminiDraft(
  apiKey: string,
  topic: string,
  source: string,
): Promise<Draft | null> {
  const model = "gemini-3.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `Topic: ${topic}\n\nSource:\n${source.slice(0, 6000)}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          sentences: {
            type: "ARRAY",
            items: { type: "STRING" },
            minItems: 5,
            maxItems: 8,
          },
          replace_index: { type: "INTEGER" },
          lie: { type: "STRING" },
        },
        required: ["sentences", "replace_index", "lie"],
      },
    },
  });

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body,
    });
    // Daily quota — do not retry; let the topic route fall back to heuristics
    if (res.status === 429) break;
    if (res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    const errBody = res ? await res.text().catch(() => "") : "";
    const err = new Error(
      `Gemini ${res?.status ?? "no-response"}: ${errBody.slice(0, 200)}`,
    ) as Error & { status?: number };
    err.status = res?.status;
    throw err;
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return parseDraft(JSON.parse(text));
  } catch {
    return null;
  }
}

async function jevCheck(
  apiKey: string,
  draft: Draft,
  source: string,
): Promise<boolean> {
  const questions: Record<string, unknown> = {};
  for (let i = 0; i < draft.sentences.length; i++) {
    questions[`s${i}`] = {
      type: "noul",
      instructions: {
        sentence: draft.sentences[i],
        question: "Is `sentence` fully supported by `source`?",
      },
    };
  }
  questions.lie_supported = {
    type: "noul",
    instructions: {
      sentence: draft.lie,
      question: "Is `sentence` fully supported by `source`?",
    },
  };
  questions.lie_contradicts = {
    type: "noul",
    instructions: {
      lie: draft.lie,
      truth: draft.sentences[draft.replace_index],
      question: "Does `lie` contradict `truth`?",
    },
  };

  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      state: { source },
      model: "jev-latest",
      questions,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jev ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    answers?: Record<string, NoulAnswer>;
  };
  const a = data.answers ?? {};
  const sentencesOk = draft.sentences.every(
    (_, i) => Number(a[`s${i}`]?.noul ?? 0) > 0.7,
  );
  const lieNotSupported = Number(a.lie_supported?.noul ?? 1) < 0.3;
  const lieContradicts = Number(a.lie_contradicts?.noul ?? 0) > 0.7;
  return sentencesOk && lieNotSupported && lieContradicts;
}

export function hasLlmKeys(env: {
  GEMINI_API_KEY?: string;
  TYPESAFE_API_KEY?: string;
}): LlmKeys | null {
  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  const typesafeApiKey = env.TYPESAFE_API_KEY?.trim();
  if (!geminiApiKey || !typesafeApiKey) return null;
  return { geminiApiKey, typesafeApiKey };
}

/**
 * Build one verified puzzle with Gemini + Jev (same pipeline as the nightly generator).
 * Returns null when drafting/verification fails.
 */
export async function puzzleFromLlm(
  article: WikiArticle,
  query: string,
  keys: LlmKeys,
  maxAttempts = 2,
): Promise<PuzzlePublic | null> {
  if (article.extract.trim().length < 800) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const draft = await geminiDraft(
        keys.geminiApiKey,
        article.title,
        article.extract,
      );
      if (!draft) continue;
      const ok = await jevCheck(keys.typesafeApiKey, draft, article.extract);
      if (!ok) continue;

      const sentences = [...draft.sentences];
      const truth = sentences[draft.replace_index]!;
      sentences[draft.replace_index] = draft.lie;
      const id = stableId(article.title, query);

      return {
        id,
        category: categoryFromQuery(query),
        topic: article.title,
        sentences,
        source_url: article.url,
        source_license: "CC BY-SA 4.0",
        reveal: obfuscateReveal(id, draft.replace_index, truth),
      };
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 429 || /429|quota|resource_exhausted/i.test(msg)) {
        throw err;
      }
      console.warn(
        `llm puzzle failed for ${article.title} attempt ${attempt + 1}:`,
        err,
      );
    }
  }
  return null;
}

/** Generate up to `need` LLM puzzles from articles (low concurrency). */
export async function generateLlmPuzzles(
  articles: WikiArticle[],
  query: string,
  keys: LlmKeys,
  need: number,
  usedTopics: Set<string>,
  concurrency = 2,
): Promise<PuzzlePublic[]> {
  // Cap candidates so a cold topic request cannot fan out forever on Workers.
  const candidates = articles.slice(0, Math.max(need * 3, need));
  const out: PuzzlePublic[] = [];
  let i = 0;
  let quotaExhausted = false;

  async function worker() {
    while (i < candidates.length && out.length < need && !quotaExhausted) {
      const idx = i++;
      const article = candidates[idx];
      if (!article) continue;
      const key = article.title.toLowerCase();
      if (usedTopics.has(key)) continue;
      try {
        const puzzle = await puzzleFromLlm(article, query, keys);
        if (!puzzle) continue;
        if (usedTopics.has(puzzle.topic.toLowerCase())) continue;
        if (out.length >= need) return;
        usedTopics.add(puzzle.topic.toLowerCase());
        out.push(puzzle);
      } catch (err) {
        const status = (err as { status?: number }).status;
        const msg = err instanceof Error ? err.message : String(err);
        if (status === 429 || /429|quota|resource_exhausted/i.test(msg)) {
          quotaExhausted = true;
          console.warn("Gemini quota exhausted — falling back to heuristics");
          return;
        }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, candidates.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}
