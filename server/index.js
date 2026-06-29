import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import pushRouter from './routes/push.js';
import intelligenceRouter from './routes/intelligence.js';
import productsRouter from './routes/products.js';
import reportsRouter from './routes/reports.js';
import { listCompetitors, getSetting } from './db/index.js';
import { refreshAll } from './agents/monitor.js';
import { loadKeysFromDB } from './services/keys.js';
import { reconcileStaleJobs } from './services/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
}));
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRouter);
app.use('/api/auth', authRouter);
app.use('/api/push', pushRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/products', productsRouter);
app.use('/api/reports', reportsRouter);

// Centralized error handler — turns thrown errors into JSON with sensible codes.
app.use((err, req, res, _next) => {
  console.error('[api error]', err.message);
  const status = err.code === 'MISSING_KEY' ? 400 : err.status || 500;
  res.status(status).json({ error: err.message, code: err.code || 'ERROR' });
});

// Serve the built React client in production, if present.
const clientDist = join(__dirname, '..', 'client', '.next', 'static');
if (existsSync(clientDist)) {
  const clientOut = join(__dirname, '..', 'client', 'out');
  if (existsSync(clientOut)) {
    app.use(express.static(clientOut));
    app.get('*', (req, res) => res.sendFile(join(clientOut, 'index.html')));
  }
}

loadKeysFromDB(getSetting).catch((err) => {
  console.warn('[startup] Could not load keys from DB:', err.message);
});

// Any job left 'running' was interrupted by a restart — mark it failed so clients
// get a clear "please re-run" instead of polling forever / hitting JOB_NOT_FOUND.
reconcileStaleJobs().catch(() => {});

app.listen(PORT, () => {
  console.log(`\n  Competitor Intelligence Agent (Enterprise)`);
  console.log(`  API listening on http://localhost:${PORT}`);
  console.log(`  Auth: Insforge | DB: PostgreSQL | AI: Grok-4\n`);
});

// Scheduled auto-refresh every 24h at 03:00
if ((process.env.AUTO_REFRESH_ENABLED ?? 'true') !== 'false') {
  cron.schedule('0 3 * * *', async () => {
    const competitors = await listCompetitors('approved');
    if (!competitors.length) return;
    console.log(`[cron] auto-refreshing ${competitors.length} competitors`);
    try {
      const results = await refreshAll(competitors);
      const changed = results.filter((r) => r.status === 'changed').length;
      console.log(`[cron] done — ${changed} change(s) detected`);
    } catch (err) {
      console.error('[cron] refresh failed:', err.message);
    }
  });
}
