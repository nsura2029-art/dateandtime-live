/**
 * Multi-language data (Phase 4, Item #35)
 *
 * Per Blueprint Ch 5 (Wikimedia feed availability) + Ch 7 (T14 non-English):
 *   Fetch on-this-day data for 14 languages (PT, ES, DE, FR, IT, NL, PL, PT, SV, UK, FA, HE, AR, HI)
 *   calendarr.com draws 34% of 3.7M monthly visits from Brazil (PT) per Ch 7.
 *
 * Source: Blueprint Ch 5 (14 languages) + Ch 7 (T14)
 */

const wikipedia = require('./wikipedia');

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' }
];

/**
 * Fetch on-this-day data for a single (month, day, lang).
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @returns {Promise<object>}
 */
async function fetchForLang(month, day, lang) {
  return await wikipedia.fetchOnThisDayEntries(month, day, lang);
}

/**
 * Fetch on-this-day data for all 14 languages for a (month, day).
 * Sequential to respect rate limits.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<object>} { [lang]: { events, births, deaths, holidays } }
 */
async function fetchAllLanguages(month, day) {
  const result = {};
  for (const lang of LANGUAGES) {
    try {
      result[lang.code] = await fetchForLang(month, day, lang.code);
      // Throttle: 200ms between langs
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn(`[i18n] ${lang.code} for ${month}-${day}: ${err.message}`);
      result[lang.code] = null;
    }
  }
  return result;
}

module.exports = {
  LANGUAGES,
  fetchForLang,
  fetchAllLanguages
};
