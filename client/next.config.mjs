// In dev, talk to the Express server directly — the rewrite proxy below times out
// long-running requests (discovery/analysis) at 30s. In prod this must be set
// explicitly to the API service's URL; never guess localhost there.
if (!process.env.NEXT_PUBLIC_API_BASE && process.env.NODE_ENV !== 'production') {
  process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:4000';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase = process.env.API_BASE_URL;
    // In production, only proxy /api when an explicit backend URL is provided -
    // never fall back to localhost (that would break the deployed app).
    if (process.env.NODE_ENV === 'production' && !apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local Next.js development can share the repo-root .env. Values stay
// server-side unless they already use Next's NEXT_PUBLIC_ prefix.
const rootEnvPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
try {
  for (const line of readFileSync(rootEnvPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (key === 'PORT' || key === 'NODE_ENV' || process.env[key] !== undefined) continue;
    const value = rawValue.trim().replace(/^(["'])(.*)\1$/, '$2');
    if (value) process.env[key] = value;
  }
} catch {
  // Hosted builds provide variables through their deployment environment.
}
