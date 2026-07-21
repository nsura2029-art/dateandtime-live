/**
 * Validation Library
 *
 * Schema validation, deduplication, and data integrity checks for
 * on-this-day entries. Returns structured errors that the orchestrator
 * can act on (block, fix, flag, or accept).
 */

const VALID_CATEGORIES = ['events', 'births', 'deaths', 'politics', 'science', 'sports', 'music', 'film', 'tech', 'finance', 'currency', 'health'];
const VALID_TYPES = ['event', 'birth', 'death', 'wedding', 'divorce', 'bizarre'];
const VALID_SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed', 'tragic', 'celebratory'];
const VALID_REGIONS = ['global', 'north_america', 'south_america', 'europe', 'asia', 'africa', 'oceania', 'middle_east', 'caribbean'];
const ISO_3166_REGEX = /^[A-Z]{2}$/;
const CURRENT_YEAR = new Date().getFullYear() + 1;

/**
 * Validation rules. Each field has a list of constraints.
 * Errors are arrays of { field, rule, message, severity } where severity is 'error' or 'warning'.
 */
const VALIDATION_RULES = {
  // Required fields
  title: {
    required: true,
    type: 'string',
    minLength: 5,
    maxLength: 200,
    noProfanity: true,
    severity: 'error'
  },
  description: {
    required: true,
    type: 'string',
    minLength: 50,
    maxLength: 1500,
    severity: 'error'
  },
  month: {
    required: true,
    type: 'number',
    min: 1,
    max: 12,
    severity: 'error'
  },
  day: {
    required: true,
    type: 'number',
    min: 1,
    max: 31,
    severity: 'error'
  },
  year: {
    required: true,
    type: 'number',
    min: -3000,
    max: CURRENT_YEAR,
    severity: 'error'
  },
  category: {
    required: true,
    type: 'string',
    oneOf: VALID_CATEGORIES,
    severity: 'error'
  },
  type: {
    required: true,
    type: 'string',
    oneOf: VALID_TYPES,
    severity: 'error'
  },
  importance: {
    required: true,
    type: 'number',
    min: 1,
    max: 5,
    severity: 'error'
  },
  
  // Recommended fields
  long_description: {
    required: false,
    type: 'string',
    minLength: 200,
    maxLength: 3000,
    severity: 'warning'
  },
  wikipedia_url: {
    required: false,
    type: 'string',
    url: true,
    severity: 'warning'
  },
  image_url: {
    required: false,
    type: 'string',
    url: true,
    severity: 'warning'
  },
  image_alt: {
    requiredIf: { field: 'image_url', exists: true },
    type: 'string',
    minLength: 10,
    maxLength: 200,
    severity: 'error'
  },
  country_code: {
    required: false,
    type: 'string',
    pattern: ISO_3166_REGEX,
    severity: 'warning'
  },
  region: {
    required: false,
    type: 'string',
    oneOf: VALID_REGIONS,
    severity: 'warning'
  },
  sentiment: {
    required: false,
    type: 'string',
    oneOf: VALID_SENTIMENTS,
    severity: 'warning'
  }
};

/**
 * Simple profanity check (very basic — just common words). Real implementation
 * would use a proper library.
 */
const PROFANITY_WORDS = ['fuck', 'shit', 'asshole', 'cunt', 'bitch', 'bastard', 'dick', 'piss'];
function containsProfanity(str) {
  if (!str) return false;
  const lower = str.toLowerCase();
  return PROFANITY_WORDS.some(w => lower.includes(w));
}

/**
 * Validate an entry against the schema.
 * @param {object} entry
 * @returns {{valid: boolean, errors: Array, warnings: Array}}
 */
function validateEntry(entry) {
  const errors = [];
  const warnings = [];
  
  if (!entry || typeof entry !== 'object') {
    errors.push({ field: '_root', rule: 'type', message: 'Entry must be an object', severity: 'error' });
    return { valid: false, errors, warnings };
  }
  
  for (const [field, rules] of Object.entries(VALIDATION_RULES)) {
    const value = entry[field];
    
    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      const issue = { field, rule: 'required', message: `${field} is required`, severity: 'error' };
      if (rules.severity === 'error') errors.push(issue);
      else warnings.push(issue);
      continue;
    }
    
    // If not present and not required, skip
    if (value === undefined || value === null) continue;
    
    // Check requiredIf
    if (rules.requiredIf && rules.requiredIf.exists) {
      const depField = rules.requiredIf.field;
      if (entry[depField] && !value) {
        errors.push({ field, rule: 'requiredIf', message: `${field} is required when ${depField} is present`, severity: 'error' });
        continue;
      }
    }
    
    // Check type
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({ field, rule: 'type', message: `${field} must be a string`, severity: 'error' });
      continue;
    }
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push({ field, rule: 'type', message: `${field} must be a number`, severity: 'error' });
      continue;
    }
    
    // Check min/max for numbers
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, rule: 'min', message: `${field} must be >= ${rules.min}`, severity: 'error' });
        continue;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, rule: 'max', message: `${field} must be <= ${rules.max}`, severity: 'error' });
        continue;
      }
    }
    
    // Check string constraints
    if (rules.type === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({ field, rule: 'minLength', message: `${field} must be at least ${rules.minLength} chars (got ${value.length})`, severity: 'error' });
        continue;
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({ field, rule: 'maxLength', message: `${field} must be at most ${rules.maxLength} chars (got ${value.length})`, severity: 'error' });
        continue;
      }
      if (rules.noProfanity && containsProfanity(value)) {
        errors.push({ field, rule: 'noProfanity', message: `${field} contains profanity`, severity: 'error' });
        continue;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, rule: 'pattern', message: `${field} does not match pattern ${rules.pattern}`, severity: 'error' });
        continue;
      }
      if (rules.url && !isValidUrl(value)) {
        errors.push({ field, rule: 'url', message: `${field} is not a valid URL`, severity: 'error' });
        continue;
      }
      if (rules.oneOf && !rules.oneOf.includes(value)) {
        errors.push({ field, rule: 'oneOf', message: `${field} must be one of: ${rules.oneOf.join(', ')}`, severity: 'error' });
        continue;
      }
    }
  }
  
  // Date validity (e.g., Feb 30 is invalid)
  if (entry.month && entry.day) {
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (entry.day > daysInMonth[entry.month - 1]) {
      errors.push({ field: 'day', rule: 'valid_date', message: `Day ${entry.day} invalid for month ${entry.month}`, severity: 'error' });
    }
  }
  
  // Leap year check for Feb 29
  if (entry.month === 2 && entry.day === 29 && entry.year) {
    if (!isLeapYear(entry.year)) {
      warnings.push({ field: 'day', rule: 'leap_year', message: `Feb 29 only valid in leap years (${entry.year} is not)`, severity: 'warning' });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate URL.
 */
function isValidUrl(str) {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a year is a leap year.
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Find duplicate entries.
 * Strict match: same date + year + title (case-insensitive)
 * Fuzzy match: same date + year + similar title
 * @param {object} newEntry
 * @param {object[]} existingEntries
 * @returns {{strict: object|null, fuzzy: object|null}}
 */
function findDuplicate(newEntry, existingEntries) {
  if (!newEntry || !existingEntries || existingEntries.length === 0) {
    return { strict: null, fuzzy: null };
  }
  
  const newTitleNorm = normalize(newEntry.title);
  
  for (const existing of existingEntries) {
    // Strict match
    if (
      existing.month === newEntry.month &&
      existing.day === newEntry.day &&
      existing.year === newEntry.year &&
      normalize(existing.title) === newTitleNorm
    ) {
      return { strict: existing, fuzzy: null };
    }
    
    // Fuzzy match: same date + year + similar title
    if (
      existing.month === newEntry.month &&
      existing.day === newEntry.day &&
      existing.year === newEntry.year
    ) {
      const similarity = titleSimilarity(newEntry.title, existing.title);
      if (similarity > 0.7) {
        return { strict: null, fuzzy: existing };
      }
    }
  }
  
  return { strict: null, fuzzy: null };
}

/**
 * Normalize a title for comparison.
 */
function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate title similarity (Jaccard index of word sets).
 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/**
 * Merge two entries (newer/wins priority, fill missing from loser).
 * @param {object} winner - the entry to keep
 * @param {object} loser - the entry to merge from
 * @returns {object} merged entry
 */
function mergeEntries(winner, loser) {
  const merged = { ...winner };
  
  for (const [field, loserValue] of Object.entries(loser)) {
    const winnerValue = merged[field];
    
    // Skip if winner already has a value
    if (winnerValue !== undefined && winnerValue !== null && winnerValue !== '' && 
        !(Array.isArray(winnerValue) && winnerValue.length === 0)) {
      // Special case: if winner has array and loser has more, merge arrays
      if (Array.isArray(winnerValue) && Array.isArray(loserValue)) {
        const winnerSet = new Set(winnerValue.map(v => typeof v === 'object' ? JSON.stringify(v) : v));
        for (const item of loserValue) {
          const key = typeof item === 'object' ? JSON.stringify(item) : item;
          if (!winnerSet.has(key)) {
            merged[field] = [...winnerValue, item];
          }
        }
      }
      continue;
    }
    
    // Fill from loser
    merged[field] = loserValue;
  }
  
  merged.merged_at = new Date().toISOString();
  merged.merged_from_id = loser.id;
  
  return merged;
}

/**
 * Batch-validate multiple entries.
 * @param {object[]} entries
 * @returns {{valid: object[], invalid: object[], total: number}}
 */
function batchValidate(entries) {
  const valid = [];
  const invalid = [];
  
  for (const entry of entries) {
    const result = validateEntry(entry);
    if (result.valid) {
      valid.push({ entry, result });
    } else {
      invalid.push({ entry, result });
    }
  }
  
  return { valid, invalid, total: entries.length };
}

/**
 * Detect issues across the dataset.
 * @param {object[]} entries
 * @returns {object} issues report
 */
function detectIssues(entries) {
  const issues = {
    total: entries.length,
    invalid_dates: [],
    duplicate_candidates: [],
    missing_required: [],
    bad_urls: [],
    profanity: [],
    future_years: []
  };
  
  // Build lookup for duplicate detection
  const byDateYear = new Map();
  
  for (const entry of entries) {
    // Invalid dates
    if (entry.month === 2 && entry.day === 29 && entry.year && !isLeapYear(entry.year)) {
      issues.invalid_dates.push({ id: entry.id, title: entry.title, issue: 'Feb 29 in non-leap year' });
    }
    
    // Future years (more than 1 year ahead)
    if (entry.year > CURRENT_YEAR) {
      issues.future_years.push({ id: entry.id, title: entry.title, year: entry.year });
    }
    
    // Bad URLs
    if (entry.wikipedia_url && !isValidUrl(entry.wikipedia_url)) {
      issues.bad_urls.push({ id: entry.id, field: 'wikipedia_url', value: entry.wikipedia_url });
    }
    if (entry.image_url && !isValidUrl(entry.image_url) && !entry.image_url.startsWith('data:')) {
      issues.bad_urls.push({ id: entry.id, field: 'image_url', value: entry.image_url });
    }
    
    // Profanity
    if (entry.title && containsProfanity(entry.title)) {
      issues.profanity.push({ id: entry.id, field: 'title', value: entry.title });
    }
    if (entry.description && containsProfanity(entry.description)) {
      issues.profanity.push({ id: entry.id, field: 'description', value: entry.description.slice(0, 100) });
    }
    
    // Missing required
    const validation = validateEntry(entry);
    if (!validation.valid) {
      for (const error of validation.errors) {
        if (error.rule === 'required') {
          issues.missing_required.push({ id: entry.id, field: error.field, title: entry.title });
        }
      }
    }
    
    // Build date+year lookup for dup detection
    if (entry.month && entry.day && entry.year) {
      const key = `${entry.month}-${entry.day}-${entry.year}`;
      if (!byDateYear.has(key)) byDateYear.set(key, []);
      byDateYear.get(key).push(entry);
    }
  }
  
  // Find duplicates
  for (const [key, group] of byDateYear.entries()) {
    if (group.length > 1) {
      // Check for similar titles
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const sim = titleSimilarity(group[i].title, group[j].title);
          if (sim > 0.7) {
            issues.duplicate_candidates.push({
              date: key,
              entry_a: { id: group[i].id, title: group[i].title },
              entry_b: { id: group[j].id, title: group[j].title },
              similarity: sim
            });
          }
        }
      }
    }
  }
  
  return issues;
}

module.exports = {
  validateEntry,
  batchValidate,
  findDuplicate,
  mergeEntries,
  detectIssues,
  containsProfanity,
  isValidUrl,
  isLeapYear,
  titleSimilarity,
  VALID_CATEGORIES,
  VALID_TYPES,
  VALID_SENTIMENTS,
  VALID_REGIONS,
  VALIDATION_RULES
};
