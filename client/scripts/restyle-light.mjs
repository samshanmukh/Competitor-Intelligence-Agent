#!/usr/bin/env node
/**
 * Visual-only class remaps for Sauna-inspired light theme.
 * Skips lines that intentionally use white text on solid accent/emerald fills.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = ['components', 'app'];

const KEEP_WHITE = /(btn-primary|bg-accent(?!\/)|bg-emerald-600|bg-rose-600)/;

const REPLACEMENTS = [
  [/hover:text-white/g, 'hover:text-ink'],
  [/text-slate-100/g, 'text-ink'],
  [/text-slate-200/g, 'text-ink'],
  [/text-slate-300/g, 'text-ink-soft'],
  [/text-slate-400/g, 'text-ink-soft'],
  [/text-slate-500/g, 'text-ink-soft'],
  [/text-slate-600/g, 'text-ink-faint'],
  [/hover:text-slate-300/g, 'hover:text-ink'],
  [/hover:text-slate-200/g, 'hover:text-ink'],
  [/text-accent-soft/g, 'text-accent'],
  [/text-rose-300/g, 'text-rose-700'],
  [/text-amber-300/g, 'text-amber-800'],
  [/text-emerald-300/g, 'text-emerald-700'],
  [/text-emerald-400/g, 'text-emerald-700'],
  [/border-rose-900\/60/g, 'border-rose-200'],
  [/border-rose-800\/60/g, 'border-rose-200'],
  [/bg-rose-950\/40/g, 'bg-rose-50'],
  [/bg-rose-950\/70/g, 'bg-rose-100'],
  [/border-amber-800\/60/g, 'border-amber-200'],
  [/bg-amber-950\/40/g, 'bg-amber-50'],
  [/border-emerald-500\/30/g, 'border-emerald-200'],
  [/bg-emerald-500\/10/g, 'bg-emerald-50'],
  [/border-rose-500\/30/g, 'border-rose-200'],
  [/bg-rose-500\/10/g, 'bg-rose-50'],
  [/border-amber-500\/30/g, 'border-amber-200'],
  [/bg-amber-500\/10/g, 'bg-amber-50'],
  [/shadow-\[0_20px_50px_-20px_rgba\(0,0,0,0\.8\)\]/g, 'shadow-lift'],
  [/shadow-\[0_10px_30px_-12px_rgba\(0,0,0,0\.8\)\]/g, 'shadow-soft'],
  [/shadow-\[0_10px_30px_-12px_rgba\(0,0,0,0\.85\)\]/g, 'shadow-soft'],
  [/shadow-\[0_8px_28px_-6px_rgba\(99,102,241,0\.7\)\]/g, 'shadow-lift'],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, out);
    } else if (/\.(jsx|js|tsx|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

let changedFiles = 0;
for (const root of TARGETS) {
  const files = walk(path.join(ROOT, root));
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const next = original
      .split('\n')
      .map((line) => {
        let out = line;
        for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
        if (!KEEP_WHITE.test(out)) {
          out = out.replace(/\btext-white\b/g, 'text-ink');
        }
        return out;
      })
      .join('\n');
    if (next !== original) {
      fs.writeFileSync(file, next);
      changedFiles += 1;
    }
  }
}

console.log(`Updated ${changedFiles} files`);
