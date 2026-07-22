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
3. Fill the env vars marked `sync: false` in the Render dashboard:
   - `cia-api`: `YOUCOM_API_KEY`, `XAI_API_KEY`, `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`,
     `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`.
   - `cia-web`: `NEXT_PUBLIC_API_BASE` = the live `cia-api` URL; set both the public
     (`NEXT_PUBLIC_INSFORGE_*`) and server-side (`INSFORGE_*`) Insforge URL/key pairs.
     Render generates `FEATURE_REQUEST_SIGNING_SECRET` automatically.
4. Redeploy `cia-web` after setting public variables because Next.js bakes them into the build.

That's it — one dashboard, both services, all features, scales with the plan.

> Free-tier note: Render's free web services sleep after inactivity and cold-start on the
> next request. Fine for testing; use a paid instance (or Railway/Fly) for always-on.

---

## Alternative: frontend on Vercel, API on Render

If you prefer Vercel for the frontend:

- **Vercel** → import repo → **Root Directory: `client`** (this fixes "No Next.js version
  detected"). Add `NEXT_PUBLIC_API_BASE`, both `NEXT_PUBLIC_INSFORGE_*` values, both
  server-side `INSFORGE_*` values, a random 32+ character
  `FEATURE_REQUEST_SIGNING_SECRET`, and `APP_URL=https://www.joinmira.ai`.
  For Google/GitHub sign-in (first-party, no InsForge browser hop), also add:
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`.
  Redirect URIs to register with Google/GitHub:
  - `https://www.joinmira.ai/api/auth/oauth/callback/google`
  - `https://www.joinmira.ai/api/auth/oauth/callback/github`
- **Render** → deploy only the API as a Web Service:
  - **Root Directory:** (repo root)
  - **Build Command:** `npm install`
  - **Start Command:** `npm start` (runs `node server/index.js`)
  - **Health Check Path:** `/api/health`
  - Env vars: `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`, `YOUCOM_API_KEY`, `XAI_API_KEY`,
    plus optional `VAPID_*`, and for digests:
    `RESEND_API_KEY`, `DIGEST_FROM_EMAIL=Mira <noreply@joinmira.ai>`,
    `APP_URL=https://www.joinmira.ai`

### Zendesk (in-app help / AI agent)

1. In Zendesk Admin → **Channels → Messaging → Web Widget**, copy the snippet **key**.
2. On **Vercel**, set `NEXT_PUBLIC_ZENDESK_KEY` (Production + Preview) and redeploy.
3. Optional email channel: set `SUPPORT_TO_EMAIL=support@miraai.zendesk.com` so the
   fallback Help form (used only if the widget key is unset) opens Zendesk tickets.
4. Test: open a signed-in app page — the Zendesk launcher appears bottom-right.
   Or email `support@miraai.zendesk.com` from an external address.
5. **Styling:** Mira applies theme colors via `messenger:set` → `customization` and
   uses a **round** Mira launcher (default Zendesk square launcher is hidden in CSS).
   Optional: in Zendesk Admin → Messaging → Web Widget → Style → Launcher → Shape,
   choose **Custom launcher** or **Circle** so Zendesk doesn’t also draw its own button.
   Title/logo still come from that Style tab (display name **Mira AI**).

### Resend (digest email)

1. In [Resend Domains](https://resend.com/domains), add **`joinmira.ai`**.
2. Copy the DNS records Resend shows (DKIM TXT, SPF/MX as listed) into GoDaddy DNS.
3. Click **Verify** in Resend until status is **Verified**.
4. On **Render → cia-api** (not only Vercel), set:
   - `RESEND_API_KEY` = your Resend API key
   - `DIGEST_FROM_EMAIL` = `Mira <noreply@joinmira.ai>`
   - `APP_URL` = `https://www.joinmira.ai`
5. Redeploy the API. In Mira Settings → Notifications, use **Send test**.

Note: signup/login verification codes are sent by **InsForge**, not Resend.
To brand those, configure InsForge SMTP to Resend (`smtp.resend.com`, user `resend`, password = API key, from `noreply@joinmira.ai`).
  - Then set Vercel `NEXT_PUBLIC_API_BASE` to the Render URL (e.g.
    `https://competitor-intelligence-agent-rgxy.onrender.com`) and redeploy Vercel.

---

## Local development

- Backend: `npm run dev:server` (port 4000)
- Frontend: `npm run dev:client` (port 3000)
- `client/.env.local` sets `NEXT_PUBLIC_API_BASE=http://localhost:4000`.
  It is git-ignored — **never commit it** (it would bake localhost into a prod build).

## Required tenant-isolation migration

Competitor URLs are unique within a workspace, not across the whole application.
Run this once against the Insforge PostgreSQL database before deploying:

```sql
ALTER TABLE competitors
  DROP CONSTRAINT IF EXISTS competitors_pricing_url_key;

CREATE UNIQUE INDEX IF NOT EXISTS competitors_workspace_pricing_url_key
  ON competitors (workspace_id, pricing_url);
```

Before enabling multi-tenant traffic, assign or remove any legacy competitors whose
`workspace_id` is null. The server intentionally does not auto-claim those rows. The
same migration, including a safety check for unassigned rows, is available at
`server/db/20260716_workspace_competitor_uniqueness.sql`.

## Scaling later

- Heavier load → bump the `cia-api` instance, or run multiple instances.
- More/longer background work → the persistent server handles it directly today; if it
  grows large, add a job queue (e.g. BullMQ + Redis) without changing the architecture.
- The DB scales independently on Insforge.
