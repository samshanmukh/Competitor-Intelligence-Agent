# Deployment

This app is **two services** that deploy separately:

- **`client/`** — Next.js frontend → deploy to **Vercel**
- **`server/`** — Express API with long-running (2–3 min) background jobs → deploy to a
  **persistent Node host** (Render, Railway, Fly.io). It **cannot** run on Vercel
  (serverless functions can't host a long-lived server or 3-minute jobs).

---

## 1. Deploy the backend (`server/`) first

Pick any Node host. Example with **Render**:

- New **Web Service** → connect this repo
- **Root Directory:** `.` (repo root — the root `package.json` is the server)
- **Build Command:** `npm install`
- **Start Command:** `npm run start:server`  (runs `node server/index.js`)
- **Environment variables** (from your local `.env`):
  - `YOUCOM_API_KEY`
  - `XAI_API_KEY`
  - `XAI_MODEL` (e.g. `grok-4`)
  - `INSFORGE_BASE_URL`
  - `INSFORGE_ANON_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `PORT` (Render sets this automatically)

Note the deployed URL, e.g. `https://cia-api.onrender.com`.

## 2. Deploy the frontend (`client/`) to Vercel

In the Vercel project settings:

- **Root Directory:** `client`   ← fixes the "No Next.js version detected" build error
- **Framework Preset:** Next.js (auto-detected once Root Directory is `client`)
- **Environment variable:**
  - `NEXT_PUBLIC_API_BASE` = the backend URL from step 1 (e.g. `https://cia-api.onrender.com`)

The browser calls the backend directly via `NEXT_PUBLIC_API_BASE`, so CORS on the
server (already enabled) must allow the Vercel domain — it reflects the request
origin by default, so no change needed.

## 3. Insforge dashboard

- Add your Vercel domain to **Allowed Redirect URLs** (only needed if you re-enable OAuth).

---

## Local development

- Backend: `npm run dev:server` (port 4000)
- Frontend: `npm run dev:client` (port 3000)
- `client/.env.local` sets `NEXT_PUBLIC_API_BASE=http://localhost:4000` for local dev.
  This file is git-ignored — **do not commit it** (it would bake localhost into prod builds).
