// Fetch agent: pulls clean Markdown for competitor pricing pages via the
// You.com Contents API and stores a new snapshot when content is returned.

import { fetchContents } from '../services/youcom.js';
import { insertSnapshot, getLatestSnapshot, hashContent } from '../db/index.js';
import {
  isStoreUrl,
  isAppStoreUrl,
  storeSourceType,
  fetchAppStoreIapText,
} from '../services/storePricing.js';

/**
 * Fetch a single competitor's pricing page and store a snapshot.
 * Returns { ok, snapshot, unchanged, error }.
 *  - unchanged=true when the new content hash matches the latest stored snapshot.
 */
export async function fetchCompetitor(competitor) {
  const url = competitor.pricing_url;

  // App Store listings: parse In-App Purchases from Apple's HTML first.
  // Generic scrapers often miss the IAP disclosure even when the URL is correct.
  if (isAppStoreUrl(url)) {
    try {
      const iap = await fetchAppStoreIapText(url);
      if (iap?.text && /\$\s?\d/.test(iap.text)) {
        let markdown = iap.text;
        try {
          const contents = await fetchContents([url]);
          const extra = contents[url]?.markdown;
          if (extra && extra.length > 200) {
            markdown = `${iap.text}\n\n== App Store page ==\n${String(extra).slice(0, 4000)}`;
          }
        } catch {
          /* IAP text alone is enough for pricing */
        }

        const latest = await getLatestSnapshot(competitor.id);
        if (latest && latest.content_hash === hashContent(markdown)) {
          return { ok: true, unchanged: true, snapshot: latest };
        }
        const snapshot = await insertSnapshot(competitor.id, markdown, 'app-store');
        return { ok: true, unchanged: false, snapshot, previous: latest || null };
      }
    } catch {
      /* fall through to generic scrape */
    }
  }

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
  // Reject blocked-page stubs so callers fall through to You.com research.
  // Store listings are shorter; accept IAP / subscription pages more leniently.
  const trimmed = String(markdown).trim();
  const hasMoney = /\$\s?\d/.test(trimmed);
  const store = isStoreUrl(url);
  const hasIap = /\b(in-?app purchases?|subscription)\b/i.test(trimmed);
  const tooThin = store
    ? trimmed.length < 200 || (!hasMoney && !hasIap && trimmed.length < 400)
    : trimmed.length < 400 || (!hasMoney && trimmed.length < 800);
  if (tooThin) {
    return { ok: false, error: 'Content too thin for pricing/feature extraction (site may block scrapers).' };
  }

  const latest = await getLatestSnapshot(competitor.id);
  if (latest && latest.content_hash === hashContent(markdown)) {
    return { ok: true, unchanged: true, snapshot: latest };
  }

  const source = store ? storeSourceType(url) : (result.source || 'youcom');
  const snapshot = await insertSnapshot(competitor.id, markdown, source);
  return { ok: true, unchanged: false, snapshot, previous: latest || null };
}

export const fetchAgent = { fetchCompetitor };
