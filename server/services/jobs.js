// Durable background-job manager. Jobs are persisted in the `jobs` table so a
// long-running task's status survives a server restart. (The in-flight work
// itself is still lost on restart — startup reconciliation marks such jobs as
// 'error' with a clear message so clients can simply re-run instead of polling
// a job that will never finish.)
import { randomBytes } from 'node:crypto';
import insforge from '../db/index.js';

export async function createJob(meta = {}) {
  const id = randomBytes(8).toString('hex');
  await insforge.database.from('jobs').insert({
    id,
    workspace_id: meta.workspaceId ?? null,
    user_id: meta.userId ?? null,
    type: meta.type ?? 'job',
    status: 'running',
  });
  return id;
}

export async function getJob(id) {
  const { data } = await insforge.database.from('jobs').select().eq('id', id).maybeSingle();
  if (!data) return null;
  let result = null;
  try { result = data.result ? JSON.parse(data.result) : null; } catch { result = null; }
  return { ...data, result };
}

export async function completeJob(id, result) {
  await insforge.database.from('jobs')
    .update({ status: 'done', result: JSON.stringify(result ?? null), updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function failJob(id, error) {
  await insforge.database.from('jobs')
    .update({ status: 'error', error: String(error || 'failed'), updated_at: new Date().toISOString() })
    .eq('id', id);
}

// On startup, any job still marked 'running' was interrupted by a restart — its
// in-flight work is gone, so flip it to a clear error state.
export async function reconcileStaleJobs() {
  try {
    await insforge.database.from('jobs')
      .update({ status: 'error', error: 'Interrupted by a server restart — please run it again.', updated_at: new Date().toISOString() })
      .eq('status', 'running');
  } catch (err) {
    console.warn('[jobs] reconcile failed:', err.message);
  }
}
