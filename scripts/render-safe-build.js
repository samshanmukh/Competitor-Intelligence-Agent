#!/usr/bin/env node
// Root `npm run build` is used by hosts that auto-detect Node apps (e.g. Render).
// The API service only needs root dependencies. Skip the Next.js client build
// unless client deps are installed (local/CI full builds use `npm run build:client`).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = join(root, 'client', 'node_modules', 'next', 'dist', 'bin', 'next');

if (!existsSync(nextBin)) {
  console.log('Skipping Next.js build (client dependencies not installed). API-only deploy.');
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'build', '--prefix', 'client'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
