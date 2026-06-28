// Fetch agent: pulls clean Markdown for competitor pricing pages via the
// You.com Contents API and stores a new snapshot when content is returned.

import { fetchContents } from '../services/youcom.js';
import { insertSnapshot, getLatestSnapshot, hashContent } from '../db/index.js';

/**
 * Fetch a single competitor's pricing page and store a snapshot.
 * Returns { ok, snapshot, unchanged, error }.
 *  - unchanged=true when the new content hash matches the latest stored snapshot.
 */
export async function fetchCompetitor(competitor) {
  const url = competitor.pricing_url;
  let contents;
  try {
    contents = await fetchContents([url]);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const result = contents[url];
  const markdown = result?.markdown;
  if (!markdown) {
    return { ok: false, error: result?.error || 'No content returned (site may block scrapers).' };
  }

  const latest = getLatestSnapshot(competitor.id);
  if (latest && latest.content_hash === hashContent(markdown)) {
    return { ok: true, unchanged: true, snapshot: latest };
  }

  const snapshot = insertSnapshot(competitor.id, markdown);
  return { ok: true, unchanged: false, snapshot, previous: latest || null };
}

export const fetchAgent = { fetchCompetitor };
