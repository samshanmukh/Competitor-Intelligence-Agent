/** Map review summaries from the analysis report onto company names. */
export function reviewSignalsFromSummaries(reviews, companies) {
  const byName = {};
  if (!Array.isArray(reviews) || !reviews.length) return byName;

  const companyKeys = (companies || []).map((c) => c.name?.toLowerCase()).filter(Boolean);

  for (const r of reviews) {
    const key = r.name?.toLowerCase();
    if (!key) continue;
    const rating = typeof r.rating === 'number' ? r.rating : null;
    const sentimentBoost = r.sentiment === 'positive' ? 1.2 : r.sentiment === 'negative' ? 0.6 : 1;
    const count =
      rating != null
        ? Math.round(rating * 40 * sentimentBoost)
        : r.pros?.length
          ? r.pros.length * 15
          : null;
    if (count) byName[key] = { count, rating };
  }

  for (const ck of companyKeys) {
    if (byName[ck]) continue;
    const hit = reviews.find((r) => {
      const rn = (r.name || '').toLowerCase();
      return rn.includes(ck) || ck.includes(rn);
    });
    if (hit) {
      const rating = typeof hit.rating === 'number' ? hit.rating : null;
      const count =
        rating != null ? Math.round(rating * 40) : hit.pros?.length ? hit.pros.length * 15 : null;
      if (count) byName[ck] = { count, rating };
    }
  }

  return byName;
}
