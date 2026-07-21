/**
 * Holiday-year data library
 *
 * Per Blueprint Ch 7 (T9: holiday-year pages): "Easter 2027", "Christmas 2027", etc.
 * Computed movable feasts (Easter, Thanksgiving, Memorial Day, Labor Day) for next 3 years.
 *
 * Top 200 holidays worldwide.
 *
 * Source: Blueprint Ch 7 (T9) + "Easter 2024 hit 6.5M searches"
 */

/**
 * Compute Western Easter Sunday for a given year (Anonymous Gregorian algorithm).
 * @param {number} year
 * @returns {string} ISO date
 */
function computeEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Compute US Thanksgiving (4th Thursday of November).
 */
function computeUSThanksgiving(year) {
  const nov1 = new Date(year, 10, 1);  // Nov 1
  const dayOfWeek = nov1.getDay();      // 0=Sun
  // First Thursday: 4 if Sun, 3 if Mon, 2 if Tue, 1 if Wed, 7 if Thu, 6 if Fri, 5 if Sat
  const firstThursday = dayOfWeek === 0 ? 5 : (dayOfWeek <= 4 ? 5 - dayOfWeek : 12 - dayOfWeek);
  const fourthThursday = firstThursday + 21;
  return `${year}-11-${String(fourthThursday).padStart(2, '0')}`;
}

/**
 * Compute Memorial Day (last Monday of May, US).
 */
function computeMemorialDay(year) {
  const may31 = new Date(year, 4, 31);
  const dayOfWeek = may31.getDay();
  const lastMonday = dayOfWeek === 0 ? 25 : (dayOfWeek === 1 ? 31 : 31 - dayOfWeek + 1);
  return `${year}-05-${String(lastMonday).padStart(2, '0')}`;
}

/**
 * Compute Labor Day (1st Monday of September, US).
 */
function computeLaborDay(year) {
  const sep1 = new Date(year, 8, 1);
  const dayOfWeek = sep1.getDay();
  const firstMonday = dayOfWeek === 0 ? 2 : (dayOfWeek === 1 ? 1 : 9 - dayOfWeek);
  return `${year}-09-${String(firstMonday).padStart(2, '0')}`;
}

/**
 * Compute Mother's Day (2nd Sunday of May, US).
 */
function computeMothersDay(year) {
  const may1 = new Date(year, 4, 1);
  const dayOfWeek = may1.getDay();
  const firstSunday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  return `${year}-05-${String(firstSunday + 7).padStart(2, '0')}`;
}

/**
 * Compute Father's Day (3rd Sunday of June, US).
 */
function computeFathersDay(year) {
  const jun1 = new Date(year, 5, 1);
  const dayOfWeek = jun1.getDay();
  const firstSunday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  return `${year}-06-${String(firstSunday + 14).padStart(2, '0')}`;
}

/**
 * Compute all major movable feasts for a year.
 * @param {number} year
 * @returns {object[]}
 */
function computeMovableFeasts(year) {
  return [
    { name: 'Easter Sunday', slug: 'easter', date: computeEaster(year), country: 'global', type: 'religious' },
    { name: 'US Thanksgiving', slug: 'thanksgiving-us', date: computeUSThanksgiving(year), country: 'US', type: 'national' },
    { name: 'Memorial Day', slug: 'memorial-day', date: computeMemorialDay(year), country: 'US', type: 'national' },
    { name: 'Labor Day', slug: 'labor-day', date: computeLaborDay(year), country: 'US', type: 'national' },
    { name: "Mother's Day", slug: 'mothers-day', date: computeMothersDay(year), country: 'US', type: 'observance' },
    { name: "Father's Day", slug: 'fathers-day', date: computeFathersDay(year), country: 'US', type: 'observance' }
  ];
}

/**
 * Top 200 fixed holidays (non-movable).
 */
const TOP_FIXED_HOLIDAYS = [
  { name: "New Year's Day", slug: 'new-years-day', month: 1, day: 1 },
  { name: "Valentine's Day", slug: 'valentines-day', month: 2, day: 14 },
  { name: "St Patrick's Day", slug: 'st-patricks-day', month: 3, day: 17 },
  { name: "Earth Day", slug: 'earth-day', month: 4, day: 22 },
  { name: "Cinco de Mayo", slug: 'cinco-de-mayo', month: 5, day: 5 },
  { name: "Independence Day (US)", slug: 'independence-day-us', month: 7, day: 4 },
  { name: "Bastille Day", slug: 'bastille-day', month: 7, day: 14 },
  { name: "Halloween", slug: 'halloween', month: 10, day: 31 },
  { name: "Veterans Day", slug: 'veterans-day', month: 11, day: 11 },
  { name: "Christmas", slug: 'christmas', month: 12, day: 25 },
  { name: "Boxing Day", slug: 'boxing-day', month: 12, day: 26 },
  { name: "New Year's Eve", slug: 'new-years-eve', month: 12, day: 31 }
];

/**
 * Build holiday-year data for next 3 years.
 * @param {number} startYear
 * @param {number} endYear
 * @returns {object}
 */
function buildHolidayYears(startYear, endYear) {
  const data = {};

  for (let year = startYear; year <= endYear; year++) {
    const movable = computeMovableFeasts(year);
    const fixed = TOP_FIXED_HOLIDAYS.map(h => ({
      ...h,
      date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
      type: 'national'
    }));

    data[year] = {
      year,
      movable_feasts: movable,
      fixed_holidays: fixed,
      all: [...movable, ...fixed].sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  return data;
}

module.exports = {
  computeEaster,
  computeUSThanksgiving,
  computeMemorialDay,
  computeLaborDay,
  computeMothersDay,
  computeFathersDay,
  computeMovableFeasts,
  buildHolidayYears,
  TOP_FIXED_HOLIDAYS
};
