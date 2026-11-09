const UA = "DailySubtleLie/1.0 (custom-topic; https://github.com/daily-subtle-lie)";

export type WikiArticle = {
  title: string;
  extract: string;
  url: string;
};

async function wikiFetch(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (res.status !== 429) return res;
    last = res;
    // Honor Retry-After when present; otherwise backoff
    const retryAfter = Number(res.headers.get("retry-after") || "0");
    const waitMs = Math.max(retryAfter * 1000, 400 * (attempt + 1));
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return last!;
}

/** Search English Wikipedia for articles related to a free-text topic. */
export async function searchWikipediaTitles(
  query: string,
  limit = 20,
): Promise<string[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", String(limit));
  url.searchParams.set("srnamespace", "0");
  url.searchParams.set("format", "json");

  const res = await wikiFetch(url.toString());
  if (!res.ok) throw new Error(`Wikipedia search failed (${res.status})`);
  const data = (await res.json()) as {
    query?: { search?: { title: string }[] };
  };
  return (data.query?.search ?? []).map((s) => s.title);
}

export async function fetchWikipediaExtract(
  title: string,
): Promise<WikiArticle | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "3000");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");

  try {
    const res = await wikiFetch(url.toString());
    if (!res.ok) return null;

    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; extract?: string; missing?: string }
        >;
      };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    if (!page || page.missing !== undefined) return null;
    const extract = (page.extract ?? "").trim();
    if (extract.length < 280) return null;

    const resolved = page.title || title;
    return {
      title: resolved,
      extract: extract.slice(0, 3000),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(resolved.replace(/ /g, "_"))}`,
    };
  } catch {
    return null;
  }
}

/** Fetch extracts with low concurrency to avoid Wikipedia 429s. */
export async function fetchWikipediaExtracts(
  titles: string[],
  concurrency = 3,
): Promise<WikiArticle[]> {
  const articles: WikiArticle[] = [];
  for (let i = 0; i < titles.length; i += concurrency) {
    const chunk = titles.slice(i, i + concurrency);
    const batch = await Promise.all(chunk.map((t) => fetchWikipediaExtract(t)));
    for (const article of batch) {
      if (article) articles.push(article);
    }
  }
  return articles;
}

/**
 * One search only (plus optional history) to stay under rate limits.
 */
export async function relatedWikipediaTitles(query: string): Promise<string[]> {
  const primary = query.trim();
  const titles: string[] = [];
  const seen = new Set<string>();

  function addAll(batch: string[]) {
    for (const t of batch) {
      if (/\(disambiguation\)$/i.test(t)) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      titles.push(t);
    }
  }

  addAll(await searchWikipediaTitles(primary, 15));

  // Only add history search if we still have few titles
  if (titles.length < 8 && !/history of /i.test(primary)) {
    try {
      addAll(await searchWikipediaTitles(`history of ${primary}`, 8));
    } catch {
      /* ignore */
    }
  }

  return titles;
}
