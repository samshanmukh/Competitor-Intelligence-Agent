// Applies server/db/schema.sql to the database in DATABASE_URL.
//
// The schema is idempotent (CREATE TABLE/INDEX IF NOT EXISTS wrapped in a
// transaction), so this is safe to run on every deploy.
//
//   npm run db:migrate
import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../server/db/schema.sql', import.meta.url));

function sslFor(url) {
  if (/[?&]sslmode=disable\b/.test(url)) return false;
  const { hostname } = new URL(url);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  return isLocal || !hostname.includes('.') ? false : { rejectUnauthorized: false };
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — nothing to migrate.');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
const schema = await readFile(schemaPath, 'utf8');

try {
  await client.connect();
  await client.query(schema);
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(`Migration applied. ${rows.length} tables:`);
  for (const row of rows) console.log(`  - ${row.table_name}`);
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
