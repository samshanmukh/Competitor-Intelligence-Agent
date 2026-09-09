# Mira project notes

- The site is account-free. Do not add login, signup, OAuth, or session gates.
- The frontend is Next.js 15, React 18, and Tailwind CSS 3.4 in `client/`.
- The application API is Express in `server/` and uses a standard PostgreSQL connection through `DATABASE_URL`.
- Public feature requests are stored in `client/data/feature-requests.json`; keep that route dependency-free.
- Never hardcode or commit credentials. Local secrets belong in `.env` or `client/.env.local`.
- Database inserts use the repository query client in `server/db/`.
- Run `npm run check` after changes that affect application behavior.
