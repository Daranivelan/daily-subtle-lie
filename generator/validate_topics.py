#!/usr/bin/env python3
"""Validate that each topic in topics.json has a substantial Wikipedia extract."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

MIN_CHARS = 800
EXTRACT_CHARS = 6000
TOPICS_PATH = Path(__file__).with_name("topics.json")


def fetch_extract(client: httpx.Client, title: str) -> str:
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "prop": "extracts",
        "explaintext": 1,
        "exchars": EXTRACT_CHARS,
        "titles": title,
        "format": "json",
        "redirects": 1,
    }
    resp = client.get(url, params=params, timeout=30.0)
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("missing") is not None:
            return ""
        return (page.get("extract") or "").strip()
    return ""


def main() -> int:
    topics = json.loads(TOPICS_PATH.read_text(encoding="utf-8"))
    failures: list[str] = []
    ok = 0

    with httpx.Client(
        headers={"User-Agent": "DailySubtleLieTopicValidator/1.0"}
    ) as client:
        for i, topic in enumerate(topics, start=1):
            title = topic["title"]
            try:
                extract = fetch_extract(client, title)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{title}: request error ({exc})")
                continue

            if len(extract) < MIN_CHARS:
                failures.append(
                    f"{title}: extract {len(extract)} chars (< {MIN_CHARS})"
                )
            else:
                ok += 1

            if i % 20 == 0:
                print(f"Checked {i}/{len(topics)}…", flush=True)
            time.sleep(0.05)

    print(f"OK: {ok}/{len(topics)}")
    if failures:
        print(f"FAILED: {len(failures)}")
        for line in failures:
            print(f"  - {line}")
        return 1
    print("All topics passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
