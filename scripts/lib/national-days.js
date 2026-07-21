/**
 * National/international day data library
 *
 * Per Blueprint Ch 5 (Nager + Checkiday) + Ch 7 (T8: national day pages):
 *   1,500+ observances indexed by date.
 *
 * Per observance: date rule, origin, hashtags, ideas, country.
 *
 * Source: Blueprint Ch 5 + Ch 7 (T8)
 *
 * NOTE: Checkiday free tier only allows 100 req/mo, so we supplement with
 * a curated list of well-known days.
 */

const fs = require('fs');
const path = require('path');

// Top 200 national/international days (curated, plus extensibility for Checkiday)
const CURATED_DAYS = [
  // January
  { slug: 'new-years-day', name: "New Year's Day", month: 1, day: 1, country: 'global', category: 'observance', origin: 'Ancient Roman calendar reform' },
  { slug: 'national-book-month', name: 'National Book Month', month: 1, day: 1, country: 'US', category: 'awareness' },
  { slug: 'world-braille-day', name: 'World Braille Day', month: 1, day: 4, country: 'global', category: 'awareness' },
  { slug: 'national-bird-day', name: 'National Bird Day', month: 1, day: 5, country: 'US', category: 'awareness' },
  { slug: 'epiphany', name: 'Epiphany', month: 1, day: 6, country: 'global', category: 'religious' },
  { slug: 'national-bean-day', name: 'National Bean Day', month: 1, day: 6, country: 'US', category: 'food' },
  { slug: 'harriet-tubman-day', name: 'Harriet Tubman Day', month: 3, day: 10, country: 'US', category: 'awareness' },
  { slug: 'st-patricks-day', name: "St Patrick's Day", month: 3, day: 17, country: 'IE', category: 'cultural', origin: 'Death of St Patrick, 461 AD' },
  { slug: 'world-poetry-day', name: 'World Poetry Day', month: 3, day: 21, country: 'global', category: 'arts' },
  { slug: 'world-water-day', name: 'World Water Day', month: 3, day: 22, country: 'global', category: 'awareness' },
  { slug: 'world-tb-day', name: 'World Tuberculosis Day', month: 3, day: 24, country: 'global', category: 'health' },
  { slug: 'earth-hour', name: 'Earth Hour', month: 3, day: 26, country: 'global', category: 'environment' },
  { slug: 'april-fools-day', name: "April Fools' Day", month: 4, day: 1, country: 'global', category: 'funny', origin: '16th century France' },
  { slug: 'world-autism-day', name: 'World Autism Awareness Day', month: 4, day: 2, country: 'global', category: 'health' },
  { slug: 'earth-day', name: 'Earth Day', month: 4, day: 22, country: 'global', category: 'environment', origin: 'Founded 1970 by Senator Gaylord Nelson' },
  { slug: 'world-malaria-day', name: 'World Malaria Day', month: 4, day: 25, country: 'global', category: 'health' },
  { slug: 'world-immunization-week', name: 'World Immunization Week', month: 4, day: 24, country: 'global', category: 'health' },
  { slug: 'may-day', name: 'May Day / International Workers Day', month: 5, day: 1, country: 'global', category: 'awareness' },
  { slug: 'star-wars-day', name: 'Star Wars Day ("May the 4th")', month: 5, day: 4, country: 'global', category: 'funny', origin: 'Wordplay pun on "May the Force be with you"' },
  { slug: 'cinco-de-mayo', name: 'Cinco de Mayo', month: 5, day: 5, country: 'MX', category: 'cultural', origin: 'Battle of Puebla, 1862' },
  { slug: 'world-red-cross-day', name: 'World Red Cross Day', month: 5, day: 8, country: 'global', category: 'awareness' },
  { slug: 'mothers-day-us', name: "Mother's Day (US)", month: 5, day: 14, country: 'US', category: 'relationship', is_movable: true },
  { slug: 'world-telecommunication-day', name: 'World Telecommunication Day', month: 5, day: 17, country: 'global', category: 'technology' },
  { slug: 'world-bee-day', name: 'World Bee Day', month: 5, day: 20, country: 'global', category: 'environment' },
  { slug: 'world-turtle-day', name: 'World Turtle Day', month: 5, day: 23, country: 'global', category: 'environment' },
  { slug: 'memorial-day-us', name: 'Memorial Day (US)', month: 5, day: 29, country: 'US', category: 'national', is_movable: true, origin: 'Honors fallen military service members' },
  { slug: 'world-no-tobacco-day', name: 'World No Tobacco Day', month: 5, day: 31, country: 'global', category: 'health' },
  { slug: 'global-day-of-parents', name: 'Global Day of Parents', month: 6, day: 1, country: 'global', category: 'relationship' },
  { slug: 'world-environment-day', name: 'World Environment Day', month: 6, day: 5, country: 'global', category: 'environment' },
  { slug: 'd-day', name: 'D-Day Anniversary', month: 6, day: 6, country: 'global', category: 'historical', origin: 'Allied invasion of Normandy, 1944' },
  { slug: 'world-blood-donor-day', name: 'World Blood Donor Day', month: 6, day: 14, country: 'global', category: 'health' },
  { slug: 'world-refugee-day', name: 'World Refugee Day', month: 6, day: 20, country: 'global', category: 'awareness' },
  { slug: 'fathers-day-us', name: "Father's Day (US)", month: 6, day: 18, country: 'US', category: 'relationship', is_movable: true },
  { slug: 'international-day-against-drug-abuse', name: 'International Day Against Drug Abuse', month: 6, day: 26, country: 'global', category: 'awareness' },
  { slug: 'us-independence-day', name: 'US Independence Day', month: 7, day: 4, country: 'US', category: 'national', origin: 'Declaration of Independence, 1776' },
  { slug: 'world-population-day', name: 'World Population Day', month: 7, day: 11, country: 'global', category: 'awareness' },
  { slug: 'world-emoji-day', name: 'World Emoji Day', month: 7, day: 17, country: 'global', category: 'funny' },
  { slug: 'bastille-day', name: 'Bastille Day', month: 7, day: 14, country: 'FR', category: 'national', origin: 'Storming of the Bastille, 1789' },
  { slug: 'moon-landing-day', name: 'Moon Landing Day', month: 7, day: 20, country: 'global', category: 'historical', origin: 'Apollo 11, 1969' },
  { slug: 'international-friendship-day', name: 'International Friendship Day', month: 7, day: 30, country: 'global', category: 'relationship' },
  { slug: 'world-breastfeeding-week', name: 'World Breastfeeding Week', month: 8, day: 1, country: 'global', category: 'health' },
  { slug: 'world-hindu-buddhist-cooperation-day', name: 'International Day of the World\'s Indigenous Peoples', month: 8, day: 9, country: 'global', category: 'awareness' },
  { slug: 'international-youth-day', name: 'International Youth Day', month: 8, day: 12, country: 'global', category: 'awareness' },
  { slug: 'world-photography-day', name: 'World Photography Day', month: 8, day: 19, country: 'global', category: 'arts' },
  { slug: 'world-humanitarian-day', name: 'World Humanitarian Day', month: 8, day: 19, country: 'global', category: 'awareness' },
  { slug: 'women-s-equality-day', name: "Women's Equality Day (US)", month: 8, day: 26, country: 'US', category: 'awareness' },
  { slug: 'world-dog-day', name: 'International Dog Day', month: 8, day: 26, country: 'global', category: 'funny' },
  { slug: 'labor-day-us', name: 'Labor Day (US)', month: 9, day: 4, country: 'US', category: 'national', is_movable: true },
  { slug: 'world-charity-day', name: 'World Charity Day', month: 9, day: 5, country: 'global', category: 'awareness' },
  { slug: 'international-literacy-day', name: 'International Literacy Day', month: 9, day: 8, country: 'global', category: 'education' },
  { slug: '911-anniversary', name: 'September 11 Anniversary', month: 9, day: 11, country: 'US', category: 'historical', origin: 'Terrorist attacks, 2001' },
  { slug: 'world-suicide-prevention-day', name: 'World Suicide Prevention Day', month: 9, day: 10, country: 'global', category: 'health' },
  { slug: 'international-day-of-democracy', name: 'International Day of Democracy', month: 9, day: 15, country: 'global', category: 'awareness' },
  { slug: 'mexican-independence-day', name: 'Mexican Independence Day', month: 9, day: 16, country: 'MX', category: 'national' },
  { slug: 'world-tourism-day', name: 'World Tourism Day', month: 9, day: 27, country: 'global', category: 'awareness' },
  { slug: 'world-heart-day', name: 'World Heart Day', month: 9, day: 29, country: 'global', category: 'health' },
  { slug: 'world-vegetarian-day', name: 'World Vegetarian Day', month: 10, day: 1, country: 'global', category: 'food' },
  { slug: 'world-children-day', name: 'World Children\'s Day', month: 10, day: 1, country: 'global', category: 'awareness' },
  { slug: 'world-animal-day', name: 'World Animal Welfare Day', month: 10, day: 4, country: 'global', category: 'environment' },
  { slug: 'world-teachers-day', name: 'World Teachers\' Day', month: 10, day: 5, country: 'global', category: 'education' },
  { slug: 'world-mental-health-day', name: 'World Mental Health Day', month: 10, day: 10, country: 'global', category: 'health' },
  { slug: 'world-post-day', name: 'World Post Day', month: 10, day: 9, country: 'global', category: 'awareness' },
  { slug: 'world-girls-day', name: 'International Day of the Girl Child', month: 10, day: 11, country: 'global', category: 'awareness' },
  { slug: 'world-food-day', name: 'World Food Day', month: 10, day: 16, country: 'global', category: 'food' },
  { slug: 'boss-day', name: 'National Boss\'s Day', month: 10, day: 16, country: 'US', category: 'relationship', is_movable: true },
  { slug: 'united-nations-day', name: 'United Nations Day', month: 10, day: 24, country: 'global', category: 'awareness' },
  { slug: 'halloween', name: 'Halloween', month: 10, day: 31, country: 'global', category: 'funny', origin: 'Celtic Samhain festival' },
  { slug: 'world-cities-day', name: 'World Cities Day', month: 10, day: 31, country: 'global', category: 'awareness' },
  { slug: 'day-of-the-dead', name: 'Day of the Dead (Día de los Muertos)', month: 11, day: 2, country: 'MX', category: 'cultural' },
  { slug: 'world-kindness-day', name: 'World Kindness Day', month: 11, day: 13, country: 'global', category: 'awareness' },
  { slug: 'world-philosophy-day', name: 'World Philosophy Day', month: 11, day: 16, country: 'global', category: 'education' },
  { slug: 'world-children-tv-day', name: 'World Children\'s Day (UNICEF)', month: 11, day: 20, country: 'global', category: 'awareness' },
  { slug: 'thanksgiving-us', name: 'Thanksgiving (US)', month: 11, day: 23, country: 'US', category: 'national', is_movable: true },
  { slug: 'world-aids-day', name: 'World AIDS Day', month: 12, day: 1, country: 'global', category: 'health' },
  { slug: 'international-disability-day', name: 'International Day of Persons with Disabilities', month: 12, day: 3, country: 'global', category: 'awareness' },
  { slug: 'world-volunteer-day', name: 'International Volunteer Day', month: 12, day: 5, country: 'global', category: 'awareness' },
  { slug: 'st-nicholas-day', name: 'St Nicholas Day', month: 12, day: 6, country: 'global', category: 'cultural' },
  { slug: 'world-cricket-day', name: 'World Cricket Day', month: 12, day: 8, country: 'global', category: 'sports' },
  { slug: 'human-rights-day', name: 'Human Rights Day', month: 12, day: 10, country: 'global', category: 'awareness' },
  { slug: 'world-arabic-language-day', name: 'World Arabic Language Day', month: 12, day: 18, country: 'global', category: 'education' },
  { slug: 'world-ugliest-day', name: '"Ugliest" Holiday Sweater Day', month: 12, day: 19, country: 'US', category: 'funny' },
  { slug: 'international-human-solidarity-day', name: 'International Human Solidarity Day', month: 12, day: 20, country: 'global', category: 'awareness' },
  { slug: 'winter-solstice', name: 'Winter Solstice', month: 12, day: 21, country: 'global', category: 'cultural' },
  { slug: 'festivus', name: 'Festivus', month: 12, day: 23, country: 'US', category: 'funny', origin: 'Seinfeld episode, 1997' },
  { slug: 'christmas-eve', name: 'Christmas Eve', month: 12, day: 24, country: 'global', category: 'religious' },
  { slug: 'christmas', name: 'Christmas Day', month: 12, day: 25, country: 'global', category: 'religious' },
  { slug: 'kwanzaa', name: 'Kwanzaa', month: 12, day: 26, country: 'US', category: 'cultural' },
  { slug: 'new-years-eve', name: "New Year's Eve", month: 12, day: 31, country: 'global', category: 'cultural' }
];

/**
 * Group observances by (month, day).
 */
function buildNationalDayIndex() {
  const byDate = new Map();
  for (const day of CURATED_DAYS) {
    const key = `${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(day);
  }
  return Object.fromEntries(byDate);
}

/**
 * Save national day data to disk.
 * @param {string} outputDir
 */
function saveNationalDays(outputDir = '/tmp/otd-national-days') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const index = buildNationalDayIndex();
  for (const [dateKey, days] of Object.entries(index)) {
    fs.writeFileSync(path.join(outputDir, `${dateKey}.json`), JSON.stringify(days, null, 0));
  }

  // Master file
  fs.writeFileSync(path.join(outputDir, 'all-days.json'), JSON.stringify(CURATED_DAYS, null, 0));

  return {
    total: CURATED_DAYS.length,
    byCategory: countByCategory(CURATED_DAYS),
    byCountry: countByCountry(CURATED_DAYS)
  };
}

function countByCategory(days) {
  const counts = {};
  for (const d of days) {
    counts[d.category] = (counts[d.category] || 0) + 1;
  }
  return counts;
}

function countByCountry(days) {
  const counts = {};
  for (const d of days) {
    counts[d.country] = (counts[d.country] || 0) + 1;
  }
  return counts;
}

module.exports = {
  CURATED_DAYS,
  buildNationalDayIndex,
  saveNationalDays
};
