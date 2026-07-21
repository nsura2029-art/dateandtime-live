/**
 * Multi-source dedup library
 *
 * Per Blueprint Insight #7: "Multi-source dedupe is the hidden engineering cost"
 * Per Risk #1: CC BY-SA share-alike → per-row source provenance
 *
 * Two strategies:
 *   1. STRICT: key on (month, day, year, type, wikidata_id) — exact match
 *   2. FUZZY: title Jaccard similarity > 0.7 — catches minor variations
 *
 * Field merging: keep higher quality (longer description, image, more sources)
 *
 * Source: Blueprint Insight #7 + Risk #1
 */

/**
 * Compute Jaccard similarity between two strings (word-level).
 * @param {string} a
 * @param {string} b
 * @returns {number} 0-1
 */
function jaccard(a, b) {
  if (!a || !b) return 0;
  const tokenize = s => new Set(
    s.toLowerCase()
     .replace(/[^\w\s]/g, ' ')
     .split(/\s+/)
     .filter(t => t.length > 2)
  );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Compute Levenshtein distance (for fuzzy matching titles).
 */
function levenshtein(a, b) {
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 5) return Math.max(m, n);
  const dp = Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Strict key for exact match.
 * @param {object} entry
 * @returns {string}
 */
function strictKey(entry) {
  return [
    entry.month || '',
    entry.day || '',
    entry.year || 'null',
    entry.type || 'event',
    entry.wikidata_id || entry.title || ''
  ].join('|');
}

/**
 * Build a strict-keyed map of entries.
 * @param {object[]} entries
 * @returns {Map<string, object[]>}
 */
function groupByStrictKey(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = strictKey(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

/**
 * Merge multiple entries for the same entity (strict match).
 * Keep higher quality: longer description, has image, more sources.
 * @param {object[]} duplicates
 * @returns {object} merged entry
 */
function mergeDuplicates(duplicates) {
  if (duplicates.length === 1) {
    return coerceNumericFields(duplicates[0]);
  }

  // Score each entry by quality signals
  const scored = duplicates.map(d => ({
    entry: d,
    score: qualityScore(d)
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0].entry;
  const merged = { ...best };

  // Collect all sources
  const allSources = new Set();
  const allDataSources = [];
  for (const { entry } of scored) {
    if (entry.verified_in) {
      try {
        const sources = JSON.parse(entry.verified_in);
        sources.forEach(s => allSources.add(s));
      } catch (e) { /* skip */ }
    }
    if (entry.data_sources) {
      try {
        allDataSources.push(...JSON.parse(entry.data_sources));
      } catch (e) { /* skip */ }
    }
  }

  // Merge fields: keep best from each entry
  for (const { entry } of scored) {
    // Longer description wins
    if ((entry.description || '').length > (merged.description || '').length) {
      merged.description = entry.description;
    }
    if ((entry.long_description || '').length > (merged.long_description || '').length) {
      merged.long_description = entry.long_description;
    }
    // Has image wins
    if (!merged.image_url && entry.image_url) {
      merged.image_url = entry.image_url;
      merged.image_status = entry.image_status;
      merged.image_license = entry.image_license;
      merged.image_credit = entry.image_credit;
    }
    // More keywords wins
    if ((entry.search_keywords || '').length > (merged.search_keywords || '').length) {
      merged.search_keywords = entry.search_keywords;
    }
    // More tags wins
    if ((entry.tags || '').length > (merged.tags || '').length) {
      merged.tags = entry.tags;
    }
    // More people mentioned wins
    if ((entry.people_mentioned || '[]').length > (merged.people_mentioned || '[]').length) {
      merged.people_mentioned = entry.people_mentioned;
    }
  }

  merged.verified_in = JSON.stringify([...allSources]);
  merged.verified = allSources.size >= 2 ? 1 : 0;
  merged.data_sources = JSON.stringify(allDataSources);

  return coerceNumericFields(merged);
}

/**
 * Coerce numeric fields from string (some sources return year as string).
 */
function coerceNumericFields(entry) {
  const coerced = { ...entry };
  if (typeof coerced.year === 'string') coerced.year = parseInt(coerced.year, 10);
  if (typeof coerced.month === 'string') coerced.month = parseInt(coerced.month, 10);
  if (typeof coerced.day === 'string') coerced.day = parseInt(coerced.day, 10);
  if (typeof coerced.importance === 'string') coerced.importance = parseInt(coerced.importance, 10);
  return coerced;
}

/**
 * Internal quality score for choosing the best entry during merge.
 * Higher = better.
 */
function qualityScore(entry) {
  let s = 0;
  s += (entry.description || '').length;
  s += (entry.long_description || '').length * 2;
  if (entry.image_url) s += 100;
  if (entry.wikipedia_url) s += 50;
  if (entry.wikidata_id) s += 30;
  if (entry.wikipedia_title) s += 20;
  s += (entry.search_keywords || '').length / 2;
  s += (entry.tags || '').length;
  s += (entry.faq_questions || '[]').length / 2;
  s += (entry.key_facts || '[]').length;
  s += (entry.rank_score || 0);
  s += (entry.sitelinks || 0);
  s += (entry.pageviews_30d_avg || 0) / 10;
  return s;
}

/**
 * Dedupe an array of entries using strict + fuzzy matching.
 * @param {object[]} entries
 * @param {object} opts - {fuzzyThreshold, enableFuzzy}
 * @returns {{deduped: object[], stats: {total, exact, fuzzy, kept}}}
 */
function dedupe(entries, opts = {}) {
  const fuzzyThreshold = opts.fuzzyThreshold ?? 0.7;
  const enableFuzzy = opts.enableFuzzy ?? true;

  // Phase 1: strict key grouping
  const groups = groupByStrictKey(entries);
  const exact = [...groups.values()].map(g => mergeDuplicates(g));
  let deduped = exact;
  let exactCount = groups.size;
  let fuzzyCount = 0;

  // Phase 2: fuzzy grouping (only if multiple entries remain)
  if (enableFuzzy && deduped.length > 1) {
    const fuzzyGroups = [];
    const used = new Set();

    for (let i = 0; i < deduped.length; i++) {
      if (used.has(i)) continue;
      const group = [deduped[i]];
      used.add(i);

      for (let j = i + 1; j < deduped.length; j++) {
        if (used.has(j)) continue;
        const a = deduped[i];
        const b = deduped[j];

        // Only fuzzy-match if same type + same date (year may differ slightly)
        if (a.type !== b.type) continue;
        if (a.month !== b.month || a.day !== b.day) continue;

        // Title Jaccard
        const sim = jaccard(a.title || '', b.title || '');
        if (sim >= fuzzyThreshold) {
          group.push(b);
          used.add(j);
          fuzzyCount++;
        }
      }

      fuzzyGroups.push(group);
    }

    deduped = fuzzyGroups.map(g => mergeDuplicates(g));
  }

  return {
    deduped,
    stats: {
      total: entries.length,
      exactGroups: exactCount,
      fuzzyMerges: fuzzyCount,
      kept: deduped.length,
      removed: entries.length - deduped.length
    }
  };
}

/**
 * Mark entries as verified (cross-source) based on data_sources length.
 * @param {object[]} entries
 * @returns {object[]} entries with verified + verified_in updated
 */
function markVerified(entries) {
  return entries.map(e => {
    let sources = [];
    try {
      sources = JSON.parse(e.verified_in || '[]');
    } catch (err) {
      sources = [];
    }
    return {
      ...e,
      verified: sources.length >= 2 ? 1 : 0,
      verified_in: JSON.stringify(sources)
    };
  });
}

module.exports = {
  jaccard,
  levenshtein,
  strictKey,
  groupByStrictKey,
  mergeDuplicates,
  dedupe,
  markVerified,
  qualityScore
};
