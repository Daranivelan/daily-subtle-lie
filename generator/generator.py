"""Daily Subtle Lie — Nightly puzzle generator.

Runs on GitHub Actions cron. Keeps a 14-day buffer of puzzles in
Cloudflare D1. Uses Gemini (via pydantic-ai) for generation and
Jev (via typesafe-sdk) for verification.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import random
import sys
import time
import uuid
from pathlib import Path

import httpx
from pydantic import BaseModel, Field, model_validator
from pydantic_ai import Agent
from typesafe_sdk import Noul, TypeSafeClient

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BUFFER = 14
POOL_TARGET = int(os.environ.get("POOL_TARGET", "40"))  # approved pool puzzles desired per category
STATUS = "approved" if os.environ.get("AUTO_APPROVE") == "1" else "review"
DAILY_ONLY = "--daily-only" in sys.argv
MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds

CATEGORIES = (
    "science",
    "history",
    "geography",
    "technology",
    "arts",
    "nature",
    "human_body",
    "sports",
)

D1_URL = (
    f"https://api.cloudflare.com/client/v4/accounts/{os.environ.get('CF_ACCOUNT_ID', '')}"
    f"/d1/database/{os.environ.get('CF_D1_ID', '')}/query"
)

SYSTEM = (
    "Using only the source text, write 5 to 8 sentences explaining the topic "
    "to a curious adult. Every sentence must be stated in the source. Then pick "
    "one sentence and write a replacement that is fluent, plausible, and "
    "factually wrong in one subtle detail such as a name, date, number, cause, "
    "or direction. Return the replacement as lie and the picked position as "
    "replace_index."
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logger = logging.getLogger("generator")


def _setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        json.dumps(
            {"time": "%(asctime)s", "level": "%(levelname)s", "msg": "%(message)s"}
        )
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Draft model
# ---------------------------------------------------------------------------


class Draft(BaseModel):
    """Structured output from the LLM."""

    sentences: list[str] = Field(min_length=5, max_length=8)
    replace_index: int = Field(ge=0)
    lie: str

    @model_validator(mode="after")
    def in_range(self) -> "Draft":
        if self.replace_index >= len(self.sentences):
            raise ValueError(
                f"replace_index {self.replace_index} out of range "
                f"for {len(self.sentences)} sentences"
            )
        return self


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

# pydantic-ai Google provider reads GOOGLE_API_KEY; accept GEMINI_API_KEY too.
if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

# gemini-2.0-flash is retired. Prefer a currently available flash model.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

agent = Agent(
    f"google:{GEMINI_MODEL}",
    output_type=Draft,
    system_prompt=SYSTEM,
    retries=2,
)

# ---------------------------------------------------------------------------
# D1 helper
# ---------------------------------------------------------------------------


def d1(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a SQL query against Cloudflare D1 via REST API."""
    for attempt in range(MAX_RETRIES):
        try:
            r = httpx.post(
                D1_URL,
                headers={"Authorization": f"Bearer {os.environ['CF_API_TOKEN']}"},
                json={"sql": sql, "params": list(params)},
                timeout=30,
            )
            if r.status_code >= 400:
                detail = r.text[:400]
                raise httpx.HTTPStatusError(
                    f"{r.status_code} {detail}",
                    request=r.request,
                    response=r,
                )
            payload = r.json()
            if not payload.get("success", True):
                raise RuntimeError(f"D1 error: {payload.get('errors')}")
            return payload["result"][0]["results"]
        except (httpx.HTTPStatusError, httpx.RequestError, KeyError, RuntimeError) as exc:
            if attempt < MAX_RETRIES - 1:
                wait = BACKOFF_BASE ** (attempt + 1)
                logger.warning("D1 request failed (attempt %d): %s — retrying in %ds", attempt + 1, exc, wait)
                time.sleep(wait)
            else:
                logger.error("D1 request failed after %d attempts: %s", MAX_RETRIES, exc)
                logger.error(
                    "If this is a permission error, grant the CF_API_TOKEN "
                    "Account → D1 → Edit, or apply SQL via `wrangler d1 execute --remote`."
                )
                raise


# ---------------------------------------------------------------------------
# Wikipedia source fetching
# ---------------------------------------------------------------------------


def fetch_source(title: str) -> tuple[str, str]:
    """Fetch the plain-text extract of a Wikipedia article.

    Returns (text, url).  Retries with exponential backoff on transient errors.
    """
    url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
    for attempt in range(MAX_RETRIES):
        try:
            r = httpx.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "prop": "extracts",
                    "explaintext": 1,
                    "redirects": 1,
                    "titles": title,
                    "format": "json",
                },
                headers={
                    # Wikimedia requires a descriptive UA with contact info
                    "User-Agent": (
                        "DailySubtleLieBot/1.0 "
                        "(https://github.com/daily-subtle-lie; puzzle-generator; "
                        "contact: daily-subtle-lie@example.com)"
                    ),
                    "Accept": "application/json",
                },
                timeout=20,
            )
            r.raise_for_status()
            page = next(iter(r.json()["query"]["pages"].values()))
            # Gentle pacing to stay under Wikimedia bot limits
            time.sleep(0.4)
            return page.get("extract", "")[:6000], url
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            if attempt < MAX_RETRIES - 1:
                wait = BACKOFF_BASE ** (attempt + 1)
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 403:
                    wait = max(wait, 8)
                logger.warning(
                    "Wikipedia fetch failed for '%s' (attempt %d): %s — retrying in %ds",
                    title, attempt + 1, exc, wait,
                )
                time.sleep(wait)
            else:
                logger.error("Wikipedia fetch failed for '%s' after %d attempts: %s", title, MAX_RETRIES, exc)
                raise


# ---------------------------------------------------------------------------
# Jev verification
# ---------------------------------------------------------------------------


def check(draft: Draft, source: str) -> bool:
    """Verify draft via Jev — one request, many questions."""
    supported = "Is `sentence` fully supported by `source`?"
    questions = {
        f"s{i}": Noul(instructions={"sentence": s, "question": supported})
        for i, s in enumerate(draft.sentences)
    }
    questions["lie_supported"] = Noul(
        instructions={"sentence": draft.lie, "question": supported}
    )
    questions["lie_contradicts"] = Noul(
        instructions={
            "lie": draft.lie,
            "truth": draft.sentences[draft.replace_index],
            "question": "Does `lie` contradict `truth`?",
        }
    )

    with TypeSafeClient() as client:
        r = client.system_one(
            model="jev-latest", state={"source": source}, questions=questions
        )

    a = r.answers
    sentences_ok = all(a[f"s{i}"].noul > 0.7 for i in range(len(draft.sentences)))
    lie_not_supported = a["lie_supported"].noul < 0.3
    lie_contradicts = a["lie_contradicts"].noul > 0.7

    if not sentences_ok:
        logger.info("Jev: one or more sentences unsupported")
    if not lie_not_supported:
        logger.info("Jev: lie appears supported by source (noul=%.2f)", a["lie_supported"].noul)
    if not lie_contradicts:
        logger.info("Jev: lie doesn't contradict truth (noul=%.2f)", a["lie_contradicts"].noul)

    return sentences_ok and lie_not_supported and lie_contradicts


# ---------------------------------------------------------------------------
# Puzzle builder
# ---------------------------------------------------------------------------


def build(topic: dict) -> dict | None:
    """Generate and verify a puzzle for a topic. Returns None on failure."""
    try:
        source, url = fetch_source(topic["title"])
    except Exception:
        logger.warning("Skipping topic '%s' — source fetch failed", topic["title"])
        return None

    if len(source) < 800:
        logger.info("Skipping topic '%s' — source too short (%d chars)", topic["title"], len(source))
        return None

    for attempt in range(MAX_RETRIES):
        try:
            draft = agent.run_sync(
                f"Topic: {topic['title']}\n\nSource:\n{source}"
            ).output

            if check(draft, source):
                shown = list(draft.sentences)
                truth = shown[draft.replace_index]
                shown[draft.replace_index] = draft.lie
                logger.info(
                    "Puzzle built for '%s' on attempt %d", topic["title"], attempt + 1
                )
                return {
                    "category": topic["category"],
                    "topic": topic["title"],
                    "sentences": shown,
                    "lie_index": draft.replace_index,
                    "truth": truth,
                    "source_url": url,
                }
            logger.info(
                "Verification failed for '%s' (attempt %d/%d)",
                topic["title"], attempt + 1, MAX_RETRIES,
            )
        except Exception as exc:
            logger.warning(
                "Generation error for '%s' (attempt %d/%d): %s",
                topic["title"], attempt + 1, MAX_RETRIES, exc,
            )
            msg = str(exc).lower()
            # Free-tier daily quota — further retries waste hours
            if "429" in msg or "resource_exhausted" in msg or "quota" in msg:
                logger.error(
                    "Gemini quota exhausted — stop this run and retry after reset "
                    "or with a billed key (GEMINI_API_KEY)."
                )
                raise SystemExit(2) from exc
            if attempt < MAX_RETRIES - 1:
                wait = BACKOFF_BASE ** (attempt + 1)
                if "503" in msg or "unavailable" in msg or "high demand" in msg:
                    wait = max(wait, 10 * (attempt + 1))
                time.sleep(wait)

    logger.warning("All %d attempts failed for topic '%s'", MAX_RETRIES, topic["title"])
    return None


# ---------------------------------------------------------------------------
# D1 insert
# ---------------------------------------------------------------------------


def insert(day: str, p: dict) -> None:
    """Insert a dated daily puzzle row into D1."""
    d1(
        "INSERT INTO puzzles "
        "(date, category, topic, sentences, lie_index, truth, source_url, source_license, status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            day,
            p["category"],
            p["topic"],
            json.dumps(p["sentences"]),
            p["lie_index"],
            p["truth"],
            p["source_url"],
            "CC BY-SA 4.0",
            STATUS,
        ),
    )
    logger.info("Inserted puzzle for %s — topic: %s (status=%s)", day, p["topic"], STATUS)


def insert_pool(p: dict) -> None:
    """Insert a pool puzzle for Categories / Random modes."""
    puzzle_id = str(uuid.uuid4())
    created_at = dt.datetime.now(dt.timezone.utc).isoformat()
    d1(
        "INSERT INTO pool_puzzles "
        "(id, category, topic, sentences, lie_index, truth, source_url, source_license, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            puzzle_id,
            p["category"],
            p["topic"],
            json.dumps(p["sentences"]),
            p["lie_index"],
            p["truth"],
            p["source_url"],
            "CC BY-SA 4.0",
            STATUS,
            created_at,
        ),
    )
    logger.info(
        "Inserted pool puzzle %s — %s / %s (status=%s)",
        puzzle_id,
        p["category"],
        p["topic"],
        STATUS,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def reset_daily_buffer(today: dt.date) -> int:
    """Delete dated dailies from today through today+BUFFER-1 so they can be rebuilt."""
    end = (today + dt.timedelta(days=BUFFER - 1)).isoformat()
    start = today.isoformat()
    existing = d1(
        "SELECT date, topic FROM puzzles WHERE date >= ? AND date <= ?",
        (start, end),
    )
    d1(
        "DELETE FROM puzzles WHERE date >= ? AND date <= ?",
        (start, end),
    )
    logger.info(
        "Reset daily buffer — deleted %d puzzles from %s to %s",
        len(existing),
        start,
        end,
    )
    return len(existing)


def main() -> None:
    _setup_logging()
    reset_daily = "--reset-daily" in sys.argv
    logger.info(
        "Generator started — buffer=%d, status=%s, reset_daily=%s",
        BUFFER,
        STATUS,
        reset_daily,
    )

    today = dt.datetime.now(dt.timezone.utc).date()
    if reset_daily:
        try:
            reset_daily_buffer(today)
        except Exception as exc:
            logger.error("Failed to reset daily buffer: %s", exc)
            sys.exit(1)

    # Fetch existing rows
    try:
        rows = d1("SELECT date, topic FROM puzzles")
    except Exception as exc:
        logger.error("Failed to query existing puzzles: %s", exc)
        sys.exit(1)

    try:
        pool_rows = d1("SELECT topic, category, status FROM pool_puzzles")
    except Exception as exc:
        logger.warning("pool_puzzles query failed (table may be new): %s", exc)
        pool_rows = []

    taken = {r["date"] for r in rows}
    used = {r["topic"] for r in rows} | {r["topic"] for r in pool_rows}

    # Load and filter topic pool
    topics_path = Path(__file__).parent / "topics.json"
    all_topics = json.load(open(topics_path))
    pool = [t for t in all_topics if t["title"] not in used]
    random.shuffle(pool)
    logger.info("Topic pool: %d available (%d used)", len(pool), len(used))

    if len(pool) < 30:
        logger.warning("Topic pool running low — only %d topics remaining!", len(pool))

    # Fill daily buffer
    filled = 0
    for offset in range(BUFFER):
        day = (today + dt.timedelta(days=offset)).isoformat()
        if day in taken:
            continue
        while pool:
            topic = pool.pop()
            puzzle = build(topic)
            if puzzle:
                try:
                    insert(day, puzzle)
                    filled += 1
                    used.add(puzzle["topic"])
                except Exception as exc:
                    logger.error("Failed to insert puzzle for %s: %s", day, exc)
                break
        else:
            logger.warning("Topic pool exhausted — cannot fill %s", day)
            break

    # Top up hybrid pool per category
    approved_by_cat: dict[str, int] = {c: 0 for c in CATEGORIES}
    for r in pool_rows:
        if r.get("status") == "approved" and r.get("category") in approved_by_cat:
            approved_by_cat[r["category"]] += 1

    pool_filled = 0
    if DAILY_ONLY:
        logger.info("Skipping pool top-up (--daily-only)")
        for category in CATEGORIES:
            count = approved_by_cat[category]
            if count < 10:
                logger.warning(
                    "LOW POOL: category %s has only %d approved puzzles (< 10)",
                    category,
                    count,
                )
        logger.info(
            "Generator finished — filled %d daily slots, %d pool puzzles",
            filled,
            pool_filled,
        )
        return

    for category in CATEGORIES:
        need = max(0, POOL_TARGET - approved_by_cat[category])
        if need == 0:
            continue
        logger.info("Pool top-up: %s needs %d more", category, need)
        cat_topics = [t for t in pool if t.get("category") == category]
        # Fall back to any remaining topics tagged with this category from full list
        if len(cat_topics) < need:
            extra = [
                t
                for t in all_topics
                if t.get("category") == category and t["title"] not in used
            ]
            random.shuffle(extra)
            cat_topics = cat_topics + [t for t in extra if t not in cat_topics]

        for _ in range(need):
            if not cat_topics:
                logger.warning("No topics left for category %s", category)
                break
            topic = cat_topics.pop()
            if topic in pool:
                pool.remove(topic)
            puzzle = build(topic)
            if not puzzle:
                continue
            try:
                insert_pool(puzzle)
                pool_filled += 1
                used.add(puzzle["topic"])
                approved_by_cat[category] += 1 if STATUS == "approved" else 0
            except Exception as exc:
                logger.error("Failed to insert pool puzzle: %s", exc)

    for category in CATEGORIES:
        count = approved_by_cat[category]
        if count < 10:
            logger.warning(
                "LOW POOL: category %s has only %d approved puzzles (< 10)",
                category,
                count,
            )

    # Check buffer depth
    try:
        future_rows = d1(
            "SELECT COUNT(*) as cnt FROM puzzles "
            "WHERE date >= ? AND status = 'approved'",
            (today.isoformat(),),
        )
        future_count = future_rows[0]["cnt"] if future_rows else 0
        logger.info("Buffer depth: %d approved days ahead", future_count)
        if future_count < 3:
            logger.warning(
                "LOW BUFFER: only %d approved days remaining! "
                "Review and approve pending puzzles.",
                future_count,
            )
    except Exception as exc:
        logger.warning("Could not check buffer depth: %s", exc)

    logger.info(
        "Generator finished — filled %d daily slots, %d pool puzzles",
        filled,
        pool_filled,
    )


if __name__ == "__main__":
    main()

