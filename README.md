# Competitor Pricing Intelligence Agent

An agent that **automatically discovers, monitors, and analyzes competitor pricing**. Describe your
market (or paste competitor URLs), and the agent finds competitors, snapshots their pricing pages,
diffs every change, and uses an LLM to explain exactly what moved — plan names, price points, and
features added or removed.

Built with **You.com** (Research + Contents APIs) for discovery & fetching and **xAI Grok** for
extraction & change analysis.

---

## What it does

1. **Flexible market input** — four ways to start (see below).
2. **Competitor discovery** — uses the You.com Research API to find competitors and their pricing
   pages, then Grok structures the results. You approve/reject before monitoring begins.
3. **Pricing page fetching** — the You.com Contents API returns clean Markdown for each pricing
   page; snapshots are stored in SQLite with timestamps.
4. **Change detection + analysis** — each refresh diffs the current snapshot against the last one;
   the diff goes to Grok, which returns a structured summary (price changes, plans/features
   added or removed, impact level) stored alongside the raw diff.
5. **Dashboard** — overview table (last checked / last change), per-competitor detail with the
   current snapshot and a change-history timeline, a manual **Refresh all** button, and a
   24-hour scheduled auto-refresh.
6. **Alerts** — in-app notification badge when new changes appear, plus an optional webhook
   (Slack/Discord-compatible) that receives change summaries.

---

## The 4 input modes

| Mode | What you provide | What the agent does |
|------|------------------|---------------------|
| **Describe your market** | `"I build AI running coaching apps"` | Searches You.com for competitors with pricing pages and structures them. |
| **Your product URL** | `https://yourproduct.com` | Reads your site, infers your market, then discovers competitors. |
| **Direct competitor URLs** | `https://competitor.com/pricing` (one per line) | Skips discovery — monitors these pages directly. |
| **Combination** | Product URL **+** known competitor URLs **+** a description | Adds your known competitors and discovers more on top. |

Examples:

- *Describe:* “Project management tools for design agencies.”
- *Product URL:* `https://runcoach.com` → agent infers “AI running coaching” and finds competitors.
- *Direct:* paste `https://linear.app/pricing` and `https://height.app/pricing`.
- *Combination:* product URL `https://runcoach.com` + `https://strava.com/pricing` + “endurance training apps”.

---

## Tech stack

- **Frontend:** React + Tailwind CSS (Vite)
- **Backend:** Node.js + Express
- **Storage:** SQLite (`better-sqlite3`) — snapshots + change history
- **APIs:** You.com (Research + Contents), xAI Grok (OpenAI-compatible chat completions)

```
/client                 React frontend
/server                 Express API
  /db                   SQLite schema + queries
  /agents               discovery, fetch, diff + analysis, monitor orchestrator
  /services             You.com client, Grok client, webhook alerts
  /routes               REST API
.env.example
README.md
```

---

## Getting API keys

### You.com (Research + Contents)
1. Go to **[you.com/platform](https://you.com/platform)**.
2. Sign up — new accounts start with **$100 in free credits**.
3. Create an API key and copy it into `YOUCOM_API_KEY`.

### xAI (Grok)
1. Go to **[console.x.ai](https://console.x.ai)**.
2. Create an API key and copy it into `XAI_API_KEY`.
3. Default model is `grok-4` (override with `XAI_MODEL`).

> The app degrades gracefully without keys — the UI loads and the Settings page shows which keys
> are missing — but discovery, fetching, and analysis require both keys.

---

## Run locally

Requires **Node 18+** (Node 22 recommended; the backend uses the native `fetch`).

```bash
# 1. Install dependencies (root + client)
npm run install:all

# 2. Configure your keys
cp .env.example .env
#   then edit .env and fill in YOUCOM_API_KEY and XAI_API_KEY

# 3. Start both the API (port 4000) and the React dev server (port 5173)
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the Express server.

### Production-style run (single server)

```bash
npm run build      # builds the client into client/dist
npm start          # Express serves the API + the built client on PORT (default 4000)
```

Then open **http://localhost:4000**.

---

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `YOUCOM_API_KEY` | — | You.com API key (required for discovery + fetching). |
| `XAI_API_KEY` | — | xAI Grok API key (required for analysis). |
| `XAI_MODEL` | `grok-4` | Grok model used for extraction + analysis. |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | Override the xAI endpoint if needed. |
| `PORT` | `4000` | Express server port. |
| `AUTO_REFRESH_ENABLED` | `true` | Set to `false` to disable the 24h scheduled refresh. |
| `YOUCOM_MIN_INTERVAL_MS` | `1200` | Min spacing between You.com calls (rate-limit safety). |

---

## How it works under the hood

- **Discovery** → `POST https://api.you.com/v1/research` with a query like
  *“Top competitors for [market]… list names, websites, and pricing page URLs.”* Grok then extracts
  a clean `{ name, website, pricing_url, notes }[]` from the research text (never inventing URLs).
- **Fetching** → `POST https://api.you.com/v1/contents` with the pricing URLs; the returned Markdown
  is hashed and stored as a snapshot only when it differs from the previous one.
- **Analysis** → a unified diff (`diff` package) of the two latest snapshots is sent to Grok with the
  prompt *“Summarize what changed in this competitor's pricing. Be specific about plan names, price
  points, features added/removed.”* The structured JSON is stored with the change.

### Rate limits & resilience
- You.com calls are **serialized and spaced** (`YOUCOM_MIN_INTERVAL_MS`) with exponential-backoff
  retries on `429`/`5xx`.
- Failed fetches (sites that block scrapers) are caught per-competitor, surfaced in the UI with a
  clear error, and never block the rest of a refresh.

---

## API reference (selected)

| Method & path | Purpose |
|---------------|---------|
| `POST /api/discover` | Run discovery (`{ mode, description, productUrl, competitorUrls }`). |
| `GET /api/competitors` | List monitored competitors. |
| `POST /api/competitors` | Approve/add competitors in bulk. |
| `GET /api/competitors/:id` | Detail: latest snapshot + change history. |
| `POST /api/competitors/:id/refresh` | Refresh one competitor. |
| `POST /api/refresh` | Refresh all approved competitors. |
| `GET /api/changes` | Recent changes + unseen count. |
| `POST /api/changes/mark-seen` | Clear the “new” badge. |
| `GET` / `PUT /api/settings` | Read/update webhook URL + market. |

---

## Notes

- SQLite lives at `server/db/data/app.sqlite` (gitignored) and is created on first run.
- The scheduled refresh runs daily at 03:00 server time via `node-cron`.
- This is a self-contained demo app — keys are read from `.env`; there’s no multi-user auth.
