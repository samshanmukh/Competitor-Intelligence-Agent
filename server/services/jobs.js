// Tiny in-memory background-job manager for slow operations (e.g. deep finance
// research). Jobs live in process memory; completed jobs are kept for a TTL so a
// client that navigated away can still pick up the result when it returns.
import { randomBytes } from 'node:crypto';

const jobs = new Map();
const DONE_TTL_MS = 30 * 60 * 1000; // keep finished jobs for 30 min

export function createJob(meta = {}) {
  const id = randomBytes(8).toString('hex');
  jobs.set(id, { id, status: 'running', result: null, error: null, createdAt: Date.now(), finishedAt: null, ...meta });
  return id;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function completeJob(id, result) {
  const job = jobs.get(id);
  if (job) { job.status = 'done'; job.result = result; job.finishedAt = Date.now(); }
}

export function failJob(id, error) {
  const job = jobs.get(id);
  if (job) { job.status = 'error'; job.error = String(error || 'failed'); job.finishedAt = Date.now(); }
}

// Periodic cleanup of finished jobs past their TTL.
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > DONE_TTL_MS) jobs.delete(id);
  }
}, 5 * 60 * 1000).unref?.();
