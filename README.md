# Daily Subtle Lie

A puzzle game: read 5–8 factual sentences and spot the one subtle lie.

**Modes**

- **Daily Subtle Lie** — one shared puzzle per UTC day (`/daily`)
- **Categories** — hard-coded topics; each day a seeded set of **10** puzzles per category (`/categories`)
- **Random Lie** — 10 cross-category puzzles refreshed daily (`/play/random`)
- **Choose a topic** — type any topic; get a 10-lie run biased toward matches (`/play/topic?q=…`)

Content is generated nightly by a Python script on GitHub Actions, verified by Jev, stored in Cloudflare D1 (`puzzles` + `pool_puzzles`), and served by a Next.js app on Cloudflare (OpenNext). Category/Random sets are sampled from the approved pool with a date-based seed so everyone sees the same 10 that day.

## Architecture

```
generator/          Nightly generator (daily buffer + pool top-up)
web/                Next.js App Router (UI + API) → Cloudflare
schema.sql          D1 migration (puzzles + pool_puzzles)
.github/workflows/  Cron + tests
```

## Prerequisites

- Node 20+
- Python 3.12+
- Cloudflare account + Wrangler login (`npx wrangler login`)
- API keys: Gemini, TypeSafe (Jev)

## Secrets & environment

| Variable | Where | Purpose |
|---|---|---|
| `CF_ACCOUNT_ID` | GH Actions secret | Cloudflare account |
| `CF_D1_ID` | GH Actions secret | D1 database id |
| `CF_API_TOKEN` | GH Actions secret | D1 write via REST (generator only) |
| `GEMINI_API_KEY` | GH Actions secret | Gemini access |
| `TYPESAFE_API_KEY` | GH Actions secret | Jev access |
| `AUTO_APPROVE` | GH Actions var | `"0"` during review; `"1"` to auto-approve |
| `ADMIN_TOKEN` | Cloudflare Worker secret + `web/.dev.vars` | Protects `/admin` |
| `GEMINI_API_KEY` | Worker secret + `web/.dev.vars` (also GH/generator) | Choose-a-topic Gemini drafts |
| `TYPESAFE_API_KEY` | Worker secret + `web/.dev.vars` (also GH/generator) | Choose-a-topic Jev checks |
| `SLACK_WEBHOOK_URL` | GH Actions secret (optional) | Failure notifications |

The Next.js app talks to D1 via the Workers binding — it does **not** need `CF_API_TOKEN`.  
`CF_API_TOKEN` for the generator must include **Account → D1 → Edit** (read-only tokens cannot insert puzzles).

Rebuild the 14-day daily buffer after wiping previous rows:

```bash
cd generator
set -a && source .env && set +a
export AUTO_APPROVE=1 GEMINI_MODEL=gemini-3.5-flash
python generator.py --reset-daily --daily-only
```

If the API token cannot write, emit SQL and apply with Wrangler OAuth instead.

## Setup

### 1. Install

```bash
cd web && npm install
cd ../generator && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
```

### 2. Create D1 and apply schema

Local D1 (works without Cloudflare login):

```bash
cd web
npm run db:local
npm run db:seed
```

Remote D1 (requires `npx wrangler login`):

```bash
cd web
npx wrangler d1 create daily-subtle-lie
# Paste the returned database_id into wrangler.toml → [[d1_databases]].database_id

npx wrangler d1 execute daily-subtle-lie --remote --file=../schema.sql
npx wrangler d1 execute daily-subtle-lie --remote --file=./seed.sql
npx wrangler d1 execute daily-subtle-lie --remote --file=./seed-pool.sql
```

Until remote create succeeds, `wrangler.toml` keeps a placeholder `database_id`; local preview still works against `.wrangler/state`.

### 3. Local secrets for the web app

```bash
cp web/.dev.vars.example web/.dev.vars
# set ADMIN_TOKEN
```

### 4. Run locally

```bash
cd web
npm run dev          # Next.js + local D1 bindings via OpenNext
# or
npm run preview      # Workers runtime preview
```

Generator (fills a 14-day buffer):

```bash
cd generator
python generator.py
```

Validate topic Wikipedia extracts:

```bash
cd generator
python validate_topics.py
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/today` | Today's approved daily puzzle |
| GET | `/api/puzzle/:date` | Approved daily puzzle by date |
| GET | `/api/archive` | Last 30 approved daily dates |
| GET | `/api/modes/categories` | Category list + pool readiness |
| GET | `/api/modes/category/:category/today` | Today's 10-puzzle category set |
| GET | `/api/modes/random/today` | Today's 10-puzzle random set |
| GET | `/api/modes/topic/today?q=` | 10-puzzle set for a typed topic |
| GET | `/api/admin/review` | Daily puzzles awaiting review (auth) |
| POST | `/api/admin/approve` | `{ "date": "YYYY-MM-DD" }` (auth) |
| POST | `/api/admin/reject` | `{ "date": "YYYY-MM-DD" }` (auth) |

Puzzle responses include an obfuscated `reveal` field. The client decodes it after the player submits — raw `lie_index` / `truth` are never returned plainly.

Theme preference is stored in `localStorage` (`dsl-theme`). Toggle Light/Dark from the header.

## Review workflow

With `AUTO_APPROVE=0`, new puzzles land as `status='review'`.

**Admin UI:** open `/admin`, enter `ADMIN_TOKEN`, approve or reject.

**CLI fallback:**

```bash
cd web
npx wrangler d1 execute daily-subtle-lie --remote \
  --command "SELECT date, topic, status FROM puzzles WHERE status='review'"

npx wrangler d1 execute daily-subtle-lie --remote \
  --command "UPDATE puzzles SET status='approved' WHERE date='2026-11-10'"
```

## Deploy

```bash
cd web
npx wrangler login   # once
# create remote D1 and update database_id in wrangler.toml first
npm run deploy
```

Or connect the GitHub repo to Cloudflare for automatic deploys on push.

After deploy, set the Worker/Pages secret `ADMIN_TOKEN` (same value you use locally in `web/.dev.vars`).

CI failure notifications: GitHub emails watchers by default. Optionally set `SLACK_WEBHOOK_URL` as a repo secret to also post to Slack when generate/test fails.

## License / attribution

Puzzle source text is derived from Wikipedia under **CC BY-SA 4.0**. The reveal screen always shows a source link and license notice.
