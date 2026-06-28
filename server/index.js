import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import apiRouter from './routes/api.js';
import { listCompetitors } from './db/index.js';
import { refreshAll } from './agents/monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRouter);

// Centralized error handler — turns thrown errors into JSON with sensible codes.
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[api error]', err.message);
  const status = err.code === 'MISSING_KEY' ? 400 : err.status || 500;
  res.status(status).json({ error: err.message, code: err.code || 'ERROR' });
});

// Serve the built React client in production, if present.
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  Competitor Pricing Intelligence Agent`);
  console.log(`  API listening on http://localhost:${PORT}`);
  console.log(`  You.com key: ${process.env.YOUCOM_API_KEY ? 'set' : 'MISSING'}  |  xAI key: ${process.env.XAI_API_KEY ? 'set' : 'MISSING'}\n`);
});

// ---- Scheduled auto-refresh every 24h (at 03:00 server time) ----
if ((process.env.AUTO_REFRESH_ENABLED ?? 'true') !== 'false') {
  cron.schedule('0 3 * * *', async () => {
    const competitors = listCompetitors('approved');
    if (!competitors.length) return;
    // eslint-disable-next-line no-console
    console.log(`[cron] auto-refreshing ${competitors.length} competitors`);
    try {
      const results = await refreshAll(competitors);
      const changed = results.filter((r) => r.status === 'changed').length;
      // eslint-disable-next-line no-console
      console.log(`[cron] done — ${changed} change(s) detected`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cron] refresh failed:', err.message);
    }
  });
}
