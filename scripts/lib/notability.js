/**
 * Notability scoring library
 *
 * Per Blueprint Ch 6 (DB architecture):
 *   notability_score = 0.5*log1p(sitelinks) + 0.3*log1p(avg_daily_views) + 0.2*log1p(inbound_links)
 *
 * Pre-computed at ingest time, NEVER at read time.
 * Scaled to 0-100 range.
 *
 * Tiers:
 *   notable: 60+ (default publish)
 *   famous: 80+ (top tier)
 *   legendary: 95+ (Apollo 11, Einstein, etc.)
 *
 * Source: Blueprint Ch 6 (notability formula) + Insight #7 (multi-source dedup cost)
 */

/**
 * Compute notability score (0-100) from signals.
 * @param {object} signals - {sitelinks, pageviews, inbound_links}
 * @returns {number} 0-100
 */
function score(signals) {
  const sitelinks = Math.max(0, signals.sitelinks || 0);
  const pageviews = Math.max(0, signals.pageviews || signals.avg_daily_views || 0);
  const inbound = Math.max(0, signals.inbound_links || 0);

  // Log1p to compress the long tail (1 → ~0.69, 100 → ~4.6, 10000 → ~9.2)
  const s = 0.5 * Math.log1p(sitelinks);
  const p = 0.3 * Math.log1p(pageviews);
  const i = 0.2 * Math.log1p(inbound);

  // Raw max for top entity (Wikipedia: 1.5M sitelinks, 50K daily views, 50K inbound):
  //   s = 0.5 * log1p(1500000) ≈ 7.24
  //   p = 0.3 * log1p(50000) ≈ 3.25
  //   i = 0.2 * log1p(50000) ≈ 2.17
  //   total ≈ 12.66
  // Scale to 0-100 (× 7.9 = 100)
  const raw = s + p + i;
  return Math.min(100, Math.round(raw * 7.9));
}

/**
 * Map a 0-100 score to a tier.
 * @param {number} s
 * @returns {string} 'legendary' | 'famous' | 'notable' | 'minor' | 'unranked'
 */
function tier(s) {
  if (s >= 95) return 'legendary';
  if (s >= 80) return 'famous';
  if (s >= 60) return 'notable';
  if (s >= 40) return 'minor';
  if (s > 0) return 'unranked';
  return 'unranked';
}

/**
 * Compute scores for an array of entities.
 * @param {object[]} entities - each with {wikidata_id, sitelinks, pageviews, inbound_links}
 * @returns {object[]} same entities with .notability_score, .notability_tier added
 */
function scoreAll(entities) {
  return entities.map(e => {
    const notability_score = score(e);
    return {
      ...e,
      notability_score,
      notability_tier: tier(notability_score)
    };
  });
}

/**
 * Determine which notability signals are available.
 * @param {object} signals
 * @returns {string} 'composite' | 'wikidata' | 'pageviews' | 'pending'
 */
function sourceLabel(signals) {
  const hasSitelinks = (signals.sitelinks || 0) > 0;
  const hasPageviews = (signals.pageviews || 0) > 0;
  const hasInbound = (signals.inbound_links || 0) > 0;

  if (hasSitelinks && hasPageviews && hasInbound) return 'composite';
  if (hasSitelinks && hasPageviews) return 'wikidata+pageviews';
  if (hasSitelinks && hasInbound) return 'wikidata+dbpedia';
  if (hasSitelinks) return 'wikidata';
  if (hasPageviews) return 'pageviews';
  if (hasInbound) return 'dbpedia';
  return 'pending';
}

module.exports = {
  score,
  tier,
  scoreAll,
  sourceLabel
};
