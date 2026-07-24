# Mira AI

AI-powered competitive and market intelligence for founders. Discover competitors, track pricing, size TAM/SAM/SOM, estimate market distribution, and get prioritized next moves.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 + React 18 + Tailwind 3.4 (`/client`) |
| Backend | Express (Node 18+, ESM) (`/server`) |
| Database + Auth | Insforge (PostgreSQL + email/OAuth) |
| AI / Research | You.com, xAI Grok, optional Tavily + Apify |
| Alerts | Web push (VAPID), Slack/Discord webhooks, Resend digests |

## Features

- **Analysis** — full competitive report (pricing, feature matrix, SWOT, reviews, analyst take)
- **Market model** — TAM → SAM → SOM with editable levers, fact-check, AI bull/base/bear scenarios
- **Distribution** — triangulated presence, CR4, syndicated share, pulse shifts
- **Competitors** — discovery, snapshots, change diffs, tags, watchlist alert thresholds, battlecards
- **Deep dive** — company dossiers + implications + multi-company compare
- **Labs** — next moves, positioning lab, pricing simulator, feature gaps, evidence locker, war room, win/loss, market entry, investor one-pager
- **History** — saved reports with shareable public links + distribution diffs
- **Alerts** — in-app notification center, web push, Slack Block Kit webhooks, personalized weekly digest

## Run locally

```bash
npm run install:all
cp .env.example .env
# Fill: YOUCOM_API_KEY, XAI_API_KEY, INSFORGE_BASE_URL, INSFORGE_ANON_KEY
# Optional: TAVILY_API_KEY, VAPID_*, RESEND_API_KEY, APP_URL

# Client (dev): set NEXT_PUBLIC_API_BASE=http://localhost:4000 in client/.env.local

npm run dev          # API :4000 + Next.js :3000
```

Open http://localhost:3000

## Scripts

```bash
npm run dev:server
npm run dev:client
npm run build
node scripts/test-market-phases.js   # distribution smoke tests
```

## Deploy

See [DEPLOY.md](./DEPLOY.md) (Render blueprint: `cia-api` + `cia-web`).
