# Deployment

## Architecture (and why)

```
Browser ──> Frontend (Next.js) ──> Node API (Express) ──> Insforge (DB + auth)
                                            │                You.com (research)
                                            └──────────────> xAI Grok (analysis)
```

- **Insforge** is the data backend — Postgres, auth, storage. Always remote, already set up.
- **The Node API (`server/`)** is the orchestration layer: it holds the You.com/xAI keys,
  runs discovery/analysis, the 2–3 min background market jobs, push notifications, and cron.

**This Node API needs a *persistent* host — not serverless.** Background jobs, long AI
calls, and cron can't run on Vercel/edge-function time limits. A managed Node host
(Render/Railway/Fly) keeps every feature and scales as you add more. Serverless would
force you to drop or cripple long-running features — the opposite of scaling.

So: **Insforge = data backend, Render = your Node API, Vercel or Render = frontend.**

---

## Recommended: one platform (Render) via `render.yaml`

The repo ships a `render.yaml` blueprint that defines **both** services.

1. Push this repo to GitHub.
2. Render → **New +** → **Blueprint** → select this repo. Render reads `render.yaml`
   and creates `cia-api` (Node server) and `cia-web` (Next.js).
3. Fill the secret env vars (marked `sync: false`) in the Render dashboard, from your local `.env`:
   - `cia-api`: `YOUCOM_API_KEY`, `XAI_API_KEY`, `INSFORGE_ANON_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   - `cia-web`: `NEXT_PUBLIC_API_BASE` = the live `cia-api` URL (e.g. `https://cia-api.onrender.com`)
4. Redeploy `cia-web` after setting `NEXT_PUBLIC_API_BASE` so it's baked into the build.

That's it — one dashboard, both services, all features, scales with the plan.

> Free-tier note: Render's free web services sleep after inactivity and cold-start on the
> next request. Fine for testing; use a paid instance (or Railway/Fly) for always-on.

---

## Alternative: frontend on Vercel, API on Render

If you prefer Vercel for the frontend:

- **Vercel** → import repo → **Root Directory: `client`** (this fixes "No Next.js version
  detected"). Add env var `NEXT_PUBLIC_API_BASE` = your `cia-api` URL.
- **Render** → deploy only the `cia-api` service (from `render.yaml` or manually:
  root `.`, start `npm run start:server`).

---

## Local development

- Backend: `npm run dev:server` (port 4000)
- Frontend: `npm run dev:client` (port 3000)
- `client/.env.local` sets `NEXT_PUBLIC_API_BASE=http://localhost:4000`.
  It is git-ignored — **never commit it** (it would bake localhost into a prod build).

## Scaling later

- Heavier load → bump the `cia-api` instance, or run multiple instances.
- More/longer background work → the persistent server handles it directly today; if it
  grows large, add a job queue (e.g. BullMQ + Redis) without changing the architecture.
- The DB scales independently on Insforge.
