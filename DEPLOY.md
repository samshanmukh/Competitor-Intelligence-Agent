# Deployment

Mira has two independently deployable parts:

```text
Browser -> Next.js frontend -> Express API -> PostgreSQL
                              -> You.com
```

The public website and account-free UI live in `client/`. The Express service in
`server/` runs long research jobs, scheduled refreshes, notifications, and provider
calls. Deploy that API to any persistent Node.js host when those live features are
needed; the repository does not contain vendor-specific deployment configuration.

## Frontend

Deploy `client/` as a Next.js application. Set:

- `NEXT_PUBLIC_API_BASE` to the public Express API origin, or leave it empty when
  `/api` is reverse-proxied to the Express service on the same origin.
- `APP_URL=https://www.joinmira.ai`.
- Email, SMS, and Zendesk variables only when those integrations are enabled.

The feature-request route reads and writes `client/data/feature-requests.json`. Set
`FEATURE_REQUESTS_JSON_PATH` to a writable persistent path if the application bundle
is read-only. On an ephemeral serverless filesystem, writes are process-local and can
reset when the instance is recycled.

## API and database

The API requires Node.js 18+ and `DATABASE_URL`. Install root dependencies, apply the
schema, then start the service:

```bash
npm install
npm run db:migrate
npm start
```

Set `YOUCOM_API_KEY` for research and analysis. Optional variables
cover Tavily, VAPID push, Resend digests, and support integrations; see `.env.example`.

## Local development

```bash
npm run install:all
cp .env.example .env
npm run db:migrate
npm run dev
```

The frontend runs on port 3000 and the Express API on port 4000 by default.
