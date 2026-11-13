# Daily Subtle Lie — Complete Project Explanation

**Daily Subtle Lie** is a fact-spotting game: you get 5–8 sentences about a topic; one has a subtle lie; you find it.

---

## What the product is

Every puzzle is grounded in a Wikipedia article. An LLM writes true sentences from that source, then swaps **one** sentence for a fluent but wrong version (wrong date, name, number, cause, etc.). You pick which sentence is the lie. After you submit, the app reveals the lie index, the true sentence it replaced, your streak/score, and Wikipedia attribution (CC BY-SA 4.0).

Days are keyed in **UTC**. The shared daily puzzle is the same for everyone until midnight UTC.

---

## Four play modes

| Mode | Route | What you play |
|---|---|---|
| **Daily Subtle Lie** | `/daily` | One shared puzzle for today’s UTC date |
| **Categories** | `/categories` → `/play/category/:id` | Pick one of 8 categories; play a **set of 10** for that day |
| **Random Lie** | `/play/random` | Cross-category **set of 10**, same for everyone that day |
| **Choose a topic** | `/play/topic?q=…` | Type any topic; get up to 10 lies biased to that topic |

Also:

- **Archive** (`/archive`) — replay past daily puzzles; past days stay playable even if you already answered
- **Admin** (`/admin`) — token-gated review queue for daily puzzles

Home (`/`) is a mode picker (Daily / Categories / Random + topic search).

---

## High-level architecture

```
generator/     Nightly Python job → Gemini + Jev → Cloudflare D1
web/           Next.js App Router UI + APIs → Cloudflare (OpenNext)
schema.sql     D1 tables: puzzles + pool_puzzles
.github/       Cron workflow + tests + optional Slack on failure
```

### Stack

- **Frontend/API:** Next.js (App Router), React client components, Tailwind, light/dark theme
- **Hosting:** Cloudflare Workers via OpenNext
- **Database:** Cloudflare D1 (SQLite)
- **Generator:** Python 3.12, Gemini (`pydantic-ai`), Jev (`typesafe-sdk`), Wikipedia extracts
- **CI:** GitHub Actions daily at 02:00 UTC

---

## Data model (D1)

Two tables:

### `puzzles` — dated daily puzzles (one row per `date`)

- `date` (PK), `category`, `topic`, `sentences` (JSON), `lie_index`, `truth`, source URL/license, `status` (`review` | `approved` | `rejected`)

### `pool_puzzles` — undated pool for Categories / Random / Topic

- UUID `id`, same puzzle fields + `created_at`, same status enum

Only **`approved`** rows are served to players. With `AUTO_APPROVE=0`, new daily rows land in `review` until you approve them in `/admin` (or via D1 SQL).

### Categories

`science`, `history`, `geography`, `technology`, `arts`, `nature`, `human_body`, `sports`

Topic bank: `generator/topics.json` (~214 Wikipedia titles tagged by category).

---

## How content is generated

Nightly (`generator/generator.py`):

1. **Fill a 14-day daily buffer** — for each missing future date, pick a topic, fetch Wikipedia extract, ask Gemini for 5–8 source-supported sentences + one replacement lie, verify with **Jev**, insert into `puzzles`.
2. **Top up the pool** — aim for ~40 approved pool puzzles per category in `pool_puzzles`.

### Jev checks (roughly)

- Every “true” sentence is supported by the source
- The lie is *not* supported
- The lie actually contradicts the sentence it replaces

Failed topics retry a few times, then skip. Status is `approved` or `review` based on `AUTO_APPROVE`.

---

## How each mode gets puzzles

### Daily

`GET /api/today` → approved `puzzles` row for `utcToday()`.  
`GET /api/puzzle/:date` / `/api/archive` for past days.

### Category / Random

Load approved `pool_puzzles`, then **seeded sample of 10** with FNV hash of `date:modeKey` so everyone gets the same set that UTC day (`web/src/lib/daily-set.ts`).

### Choose a topic

1. Match pool rows whose topic/category fits the query  
2. If not enough, **on-demand Wikipedia generation** on the Worker (`wikipedia.ts` + `generate-topic-puzzle.ts`) — extract sentences and plant a subtle lie via year/number/word swaps  
3. Persist generated ones into the pool when possible so repeats are faster

---

## Frontend game flow

### Single puzzle (Daily + Archive) — `GameShell` + `PuzzleCard` + `RevealView`

1. Load puzzle via `usePuzzle`
2. Select a sentence → “Spot the lie”
3. Client decodes obfuscated `reveal` → show result
4. Stats written to `localStorage` (`useStats`: streak, history, totals)
5. Today auto-shows a saved result if already played; archive always opens in play mode

### 10-run modes — `RunShell` + `useRun`

1. Fetch today’s set from the mode API  
2. Play puzzles one after another with progress  
3. Persist run progress in `localStorage` so refresh resumes  
4. End screen with score + share text  

Theme preference: `localStorage` key `dsl-theme`, toggled in the header.

---

## Reveal security (light obfuscation)

APIs never return plain `lie_index` / `truth`. They return `reveal`: XOR + base64url of that payload, keyed by puzzle id (date for dailies, UUID for pool).

`deobfuscateReveal` runs **only after submit** on the client. This is anti-spoiler for casual inspection, not strong cryptography.

---

## Admin / ops

- `/admin` + `ADMIN_TOKEN` → list `review` dailies, approve/reject  
- Generator secrets live in GitHub Actions; the web app uses the D1 **binding** (no CF API token in the Worker)  
- Local: `npm run db:local` / `db:seed`, `npm run dev`  
- Deploy: `npm run deploy` after remote D1 is wired in `wrangler.toml`

### Main API routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/today` | Today's approved daily puzzle |
| GET | `/api/puzzle/:date` | Approved daily puzzle by date |
| GET | `/api/archive` | Recent approved daily dates |
| GET | `/api/modes/categories` | Category list + pool readiness |
| GET | `/api/modes/category/:category/today` | Today's 10-puzzle category set |
| GET | `/api/modes/random/today` | Today's 10-puzzle random set |
| GET | `/api/modes/topic/today?q=` | 10-puzzle set for a typed topic |
| GET | `/api/admin/review` | Daily puzzles awaiting review (auth) |
| POST | `/api/admin/approve` | Approve a date (auth) |
| POST | `/api/admin/reject` | Reject a date (auth) |

---

## Repo map

| Path | Role |
|---|---|
| `generator/` | Nightly invent + verify + write to D1 |
| `web/src/app/` | Pages + API routes |
| `web/src/components/` | UI (modes, game, archive, admin, theme) |
| `web/src/hooks/` | Puzzle fetch, stats, run resume |
| `web/src/lib/` | D1, reveal, daily-set sampling, Wikipedia, topic gen |
| `schema.sql` | Canonical D1 schema |
| `.github/workflows/generate.yml` | Cron + tests + optional Slack |
| `README.md` | Setup, secrets, deploy instructions |

---

## End-to-end story

1. Cron generates Wikipedia-backed lies into D1 (daily buffer + pool).  
2. You optionally review/approve dailies.  
3. Players open the Next.js app on Cloudflare.  
4. Daily = one shared puzzle; Category/Random = same seeded 10 for everyone; Topic = matched pool + live Wikipedia fill.  
5. Guess → client decode → reveal + local stats/streaks; archive lets you replay past dailies anytime.

That’s the full system: **generate carefully, store in D1, serve the same fair daily sets, let people also roam by category/topic, and keep answers off the wire until they commit.**
