/**
 * Quality Scorer Library
 *
 * Calculates a 0-100 quality score for an on-this-day entry based on
 * field population, image presence, source attribution, and freshness.
 *
 * Score tiers:
 *   - 90-100: gold  (publish as-is)
 *   - 70-89:  silver (publish, auto-improve)
 *   - 50-69:  bronze (publish, flag for review)
 *   - <50:    blocked (auto-improve or manual review)
 *
 * The scorer also tracks which fields are missing and returns a list
 * of improvement suggestions that the auto-improve pipeline can act on.
 */

const SCORE_RULES = {
  // Core content (50 pts)
  has_main_image: 15,           // Image URL present and valid
  has_long_description: 15,     // long_description OR description > 200 chars
  has_short_description: 10,    // description present, 50+ chars
  
  // Sources (15 pts)
  has_wikipedia_url: 10,        // Wikipedia URL
  has_2_data_sources: 5,        // 2+ sources in data_sources array
  
  // Classification (15 pts)
  has_country_code: 10,         // country_code set
  has_category: 5,              // category set and valid
  
  // People (10 pts)
  has_3_key_people: 10,         // 3+ people in people_mentioned
  
  // SEO (10 pts)
  has_5_search_keywords: 5,     // 5+ search keywords
  has_3_tags: 5,                // 3+ tags
  
  // Freshness (5 pts)
  updated_within_30_days: 5     // updated_at recent
};

const MAX_POSSIBLE_SCORE = Object.values(SCORE_RULES).reduce((sum, v) => sum + v, 0);

/**
 * Calculate the quality score for an entry.
 * @param {object} entry
 * @returns {{score: number, tier: string, breakdown: object, missing: string[], suggestions: object[]}}
 */
function scoreEntry(entry) {
  if (!entry) return { score: 0, tier: 'blocked', breakdown: {}, missing: [], suggestions: [] };
  
  const breakdown = {};
  const missing = [];
  const suggestions = [];
  
  // has_main_image (15)
  const hasImage = !!(entry.image_url || entry.media?.image_url);
  if (hasImage) {
    breakdown.has_main_image = SCORE_RULES.has_main_image;
  } else {
    breakdown.has_main_image = 0;
    missing.push('image_url');
    suggestions.push({
      field: 'image_url',
      action: 'fetch_image',
      reason: 'No image — run 5-tier image fallback'
    });
  }
  
  // has_long_description (15)
  const longDesc = entry.long_description || entry.description;
  const hasLongDesc = longDesc && longDesc.length >= 200;
  if (hasLongDesc) {
    breakdown.has_long_description = SCORE_RULES.has_long_description;
  } else if (longDesc && longDesc.length >= 50) {
    breakdown.has_long_description = 7;  // partial credit
    missing.push('long_description');
    suggestions.push({
      field: 'long_description',
      action: 'enrich_description',
      reason: 'Description is too short for detail page (need 200+ chars)'
    });
  } else {
    breakdown.has_long_description = 0;
    missing.push('description');
    suggestions.push({
      field: 'description',
      action: 'fetch_description',
      reason: 'No description — fetch from Wikipedia API'
    });
  }
  
  // has_short_description (10)
  const hasShortDesc = entry.description && entry.description.length >= 50;
  if (hasShortDesc) {
    breakdown.has_short_description = SCORE_RULES.has_short_description;
  } else {
    breakdown.has_short_description = 0;
  }
  
  // has_wikipedia_url (10)
  const hasWiki = !!entry.wikipedia_url;
  if (hasWiki) {
    breakdown.has_wikipedia_url = SCORE_RULES.has_wikipedia_url;
  } else {
    breakdown.has_wikipedia_url = 0;
    missing.push('wikipedia_url');
    suggestions.push({
      field: 'wikipedia_url',
      action: 'lookup_wikipedia',
      reason: 'No Wikipedia URL — search for the entry title'
    });
  }
  
  // has_2_data_sources (5)
  let sources = 0;
  if (entry.data_sources) {
    try {
      sources = typeof entry.data_sources === 'string' 
        ? JSON.parse(entry.data_sources).length 
        : entry.data_sources.length;
    } catch {}
  }
  if (sources >= 2) {
    breakdown.has_2_data_sources = SCORE_RULES.has_2_data_sources;
  } else if (sources === 1) {
    breakdown.has_2_data_sources = 2;  // partial credit
  } else {
    breakdown.has_2_data_sources = 0;
    suggestions.push({
      field: 'data_sources',
      action: 'add_sources',
      reason: 'Need 2+ data sources for credibility'
    });
  }
  
  // has_country_code (10)
  const hasCountry = !!(entry.country_code || (entry.country_codes && entry.country_codes.length));
  if (hasCountry) {
    breakdown.has_country_code = SCORE_RULES.has_country_code;
  } else {
    breakdown.has_country_code = 0;
    missing.push('country_code');
    suggestions.push({
      field: 'country_code',
      action: 'lookup_country',
      reason: 'No country — derive from Wikidata or Wikipedia'
    });
  }
  
  // has_category (5)
  const validCategories = ['events', 'births', 'deaths', 'politics', 'science', 'sports', 'music', 'film', 'tech', 'finance', 'currency', 'health'];
  const hasCategory = entry.category && validCategories.includes(entry.category);
  if (hasCategory) {
    breakdown.has_category = SCORE_RULES.has_category;
  } else {
    breakdown.has_category = 0;
    missing.push('category');
  }
  
  // has_3_key_people (10)
  let peopleCount = 0;
  if (entry.people_mentioned) {
    try {
      peopleCount = typeof entry.people_mentioned === 'string'
        ? JSON.parse(entry.people_mentioned).length
        : entry.people_mentioned.length;
    } catch {}
  } else if (entry.key_people) {
    try {
      peopleCount = typeof entry.key_people === 'string'
        ? JSON.parse(entry.key_people).length
        : entry.key_people.length;
    } catch {}
  }
  if (peopleCount >= 3) {
    breakdown.has_3_key_people = SCORE_RULES.has_3_key_people;
  } else if (peopleCount >= 1) {
    breakdown.has_3_key_people = Math.floor(peopleCount * (SCORE_RULES.has_3_key_people / 3));
  } else {
    breakdown.has_3_key_people = 0;
    missing.push('key_people');
    suggestions.push({
      field: 'key_people',
      action: 'extract_people',
      reason: 'No key people — extract from Wikipedia article'
    });
  }
  
  // has_5_search_keywords (5)
  let keywordCount = 0;
  if (entry.search_keywords) {
    try {
      const kw = typeof entry.search_keywords === 'string'
        ? JSON.parse(entry.search_keywords)
        : entry.search_keywords;
      keywordCount = Array.isArray(kw) ? kw.length : 0;
    } catch {}
  }
  if (keywordCount >= 5) {
    breakdown.has_5_search_keywords = SCORE_RULES.has_5_search_keywords;
  } else if (keywordCount >= 1) {
    breakdown.has_5_search_keywords = Math.floor(keywordCount * (SCORE_RULES.has_5_search_keywords / 5));
  } else {
    breakdown.has_5_search_keywords = 0;
    suggestions.push({
      field: 'search_keywords',
      action: 'generate_keywords',
      reason: 'No search keywords — generate from title + description'
    });
  }
  
  // has_3_tags (5)
  let tagCount = 0;
  if (entry.tags) {
    try {
      const t = typeof entry.tags === 'string' ? JSON.parse(entry.tags) : entry.tags;
      tagCount = Array.isArray(t) ? t.length : 0;
    } catch {}
  }
  if (tagCount >= 3) {
    breakdown.has_3_tags = SCORE_RULES.has_3_tags;
  } else if (tagCount >= 1) {
    breakdown.has_3_tags = Math.floor(tagCount * (SCORE_RULES.has_3_tags / 3));
  } else {
    breakdown.has_3_tags = 0;
  }
  
  // updated_within_30_days (5)
  let isFresh = false;
  if (entry.updated_at) {
    const updated = new Date(entry.updated_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    isFresh = updated > thirtyDaysAgo;
  }
  if (isFresh) {
    breakdown.updated_within_30_days = SCORE_RULES.updated_within_30_days;
  } else {
    breakdown.updated_within_30_days = 0;
  }
  
  // Calculate total
  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const tier = score >= 90 ? 'gold' : score >= 70 ? 'silver' : score >= 50 ? 'bronze' : 'blocked';
  
  return {
    score,
    tier,
    breakdown,
    missing,
    suggestions,
    max_possible: MAX_POSSIBLE_SCORE
  };
}

/**
 * Determine if an entry needs auto-improvement.
 * @param {object} scoreResult
 * @param {object} opts - { autoImproveThreshold: 70 }
 * @returns {boolean}
 */
function needsAutoImprovement(scoreResult, opts = {}) {
  const threshold = opts.autoImproveThreshold ?? 70;
  return scoreResult.score < threshold && scoreResult.suggestions.length > 0;
}

/**
 * Generate a quality report for a list of entries.
 * @param {object[]} entries
 * @returns {object}
 */
function generateReport(entries) {
  if (!entries || entries.length === 0) {
    return {
      total: 0,
      by_tier: { gold: 0, silver: 0, bronze: 0, blocked: 0 },
      avg_score: 0,
      by_category: {},
      by_month: {},
      missing_images: 0,
      missing_descriptions: 0,
      missing_wikipedia: 0,
      top_missing_fields: {}
    };
  }
  
  const report = {
    total: entries.length,
    by_tier: { gold: 0, silver: 0, bronze: 0, blocked: 0 },
    avg_score: 0,
    by_category: {},
    by_month: {},
    missing_images: 0,
    missing_descriptions: 0,
    missing_wikipedia: 0,
    top_missing_fields: {}
  };
  
  let totalScore = 0;
  const missingFieldsCount = {};
  
  for (const entry of entries) {
    const result = scoreEntry(entry);
    totalScore += result.score;
    report.by_tier[result.tier]++;
    
    // By category
    const cat = entry.category || 'unknown';
    if (!report.by_category[cat]) {
      report.by_category[cat] = { count: 0, avg_score: 0, total_score: 0 };
    }
    report.by_category[cat].count++;
    report.by_category[cat].total_score += result.score;
    
    // By month
    const month = entry.month || 0;
    if (!report.by_month[month]) {
      report.by_month[month] = { count: 0, avg_score: 0, total_score: 0 };
    }
    report.by_month[month].count++;
    report.by_month[month].total_score += result.score;
    
    // Missing fields
    if (result.missing.includes('image_url')) report.missing_images++;
    if (result.missing.includes('description')) report.missing_descriptions++;
    if (result.missing.includes('wikipedia_url')) report.missing_wikipedia++;
    
    for (const field of result.missing) {
      missingFieldsCount[field] = (missingFieldsCount[field] || 0) + 1;
    }
  }
  
  report.avg_score = Math.round(totalScore / entries.length);
  
  // Calculate avg scores
  for (const cat in report.by_category) {
    report.by_category[cat].avg_score = Math.round(
      report.by_category[cat].total_score / report.by_category[cat].count
    );
    delete report.by_category[cat].total_score;
  }
  for (const month in report.by_month) {
    report.by_month[month].avg_score = Math.round(
      report.by_month[month].total_score / report.by_month[month].count
    );
    delete report.by_month[month].total_score;
  }
  
  // Top missing fields
  report.top_missing_fields = Object.entries(missingFieldsCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});
  
  return report;
}

/**
 * Print a human-readable quality report.
 * @param {object} report
 */
function printReport(report) {
  console.log('\n========================================');
  console.log('📊 ON-THIS-DAY DATA QUALITY REPORT');
  console.log('========================================');
  console.log(`Total entries: ${report.total}`);
  console.log(`Average score: ${report.avg_score}/100`);
  console.log('');
  console.log('Tier breakdown:');
  console.log(`  🥇 Gold (90-100):   ${report.by_tier.gold} (${pct(report.by_tier.gold, report.total)}%)`);
  console.log(`  🥈 Silver (70-89):  ${report.by_tier.silver} (${pct(report.by_tier.silver, report.total)}%)`);
  console.log(`  🥉 Bronze (50-69):  ${report.by_tier.bronze} (${pct(report.by_tier.bronze, report.total)}%)`);
  console.log(`  🚫 Blocked (<50):   ${report.by_tier.blocked} (${pct(report.by_tier.blocked, report.total)}%)`);
  console.log('');
  console.log('Missing fields:');
  console.log(`  Images:         ${report.missing_images}`);
  console.log(`  Descriptions:   ${report.missing_descriptions}`);
  console.log(`  Wikipedia URLs: ${report.missing_wikipedia}`);
  
  if (Object.keys(report.top_missing_fields).length > 0) {
    console.log('');
    console.log('Top missing fields:');
    for (const [field, count] of Object.entries(report.top_missing_fields)) {
      console.log(`  ${field}: ${count} entries`);
    }
  }
  
  console.log('========================================\n');
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

module.exports = {
  scoreEntry,
  generateReport,
  printReport,
  needsAutoImprovement,
  SCORE_RULES,
  MAX_POSSIBLE_SCORE
};
