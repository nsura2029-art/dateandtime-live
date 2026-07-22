#!/usr/bin/env node
/* Generate static city pages using Template D (Data Hub)
 * URL: /world-time/city/{slug}/
 * Pattern: Home / World Time / {Country} / {State} / {City}
 *
 * Inputs: list of cities (id + slug)
 * Fetches: city data, holidays, OTD, climate, people
 * Renders: Template D with all data injected
 * Output: world-time/city/{slug}/index.html
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = process.env.API || 'https://dev.api.dateandtime.live';

// Top 10 cities to ship first
const DEFAULT_CITIES = [
  { id: 5128581, slug: 'new-york',     code: 'us' },
  { id: 5368361, slug: 'los-angeles',  code: 'us' },
  { id: 2643743, slug: 'london',       code: 'gb' },
  { id: 1850147, slug: 'tokyo',        code: 'jp' },
  { id: 2147714, slug: 'sydney',       code: 'au' },
  { id: 1275339, slug: 'mumbai',       code: 'in' },
  { id: 3448439, slug: 'sao-paulo',    code: 'br' },
  { id: 2988507, slug: 'paris',        code: 'fr' },
  { id: 292223,  slug: 'dubai',        code: 'ae' },
  { id: 1880252, slug: 'singapore',    code: 'sg' },
  { id: 4174757, slug: 'tampa',        code: 'us' }  // User's requested test city
];

// Load cities: either from CITIES_FILE env, or from a single file
let CITIES = DEFAULT_CITIES;
if (process.env.CITIES_FILE) {
  try {
    CITIES = JSON.parse(fs.readFileSync(process.env.CITIES_FILE, 'utf8'));
    console.log(`Loaded ${CITIES.length} cities from ${process.env.CITIES_FILE}`);
  } catch (e) {
    console.error(`Failed to load ${process.env.CITIES_FILE}: ${e.message}`);
    process.exit(1);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j);
        } catch (e) { reject(new Error(`Parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// WMO weather codes → emoji + label
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WMO_CODES = {
  0:  { emoji: '☀️', label: 'Clear' },
  1:  { emoji: '🌤', label: 'Mostly clear' },
  2:  { emoji: '⛅', label: 'Partly cloudy' },
  3:  { emoji: '☁️', label: 'Overcast' },
  45: { emoji: '🌫', label: 'Fog' },
  48: { emoji: '🌫', label: 'Rime fog' },
  51: { emoji: '🌦', label: 'Light drizzle' },
  53: { emoji: '🌦', label: 'Drizzle' },
  55: { emoji: '🌧', label: 'Heavy drizzle' },
  61: { emoji: '🌦', label: 'Light rain' },
  63: { emoji: '🌧', label: 'Rain' },
  65: { emoji: '🌧', label: 'Heavy rain' },
  71: { emoji: '🌨', label: 'Light snow' },
  73: { emoji: '❄️', label: 'Snow' },
  75: { emoji: '❄️', label: 'Heavy snow' },
  77: { emoji: '🌨', label: 'Snow grains' },
  80: { emoji: '🌦', label: 'Rain showers' },
  81: { emoji: '🌧', label: 'Heavy showers' },
  82: { emoji: '⛈', label: 'Violent showers' },
  85: { emoji: '🌨', label: 'Snow showers' },
  86: { emoji: '❄️', label: 'Heavy snow showers' },
  95: { emoji: '⛈', label: 'Thunderstorm' },
  96: { emoji: '⛈', label: 'Thunderstorm w/ hail' },
  99: { emoji: '⛈', label: 'Severe thunderstorm' }
};
const wmo = (c) => WMO_CODES[c] || { emoji: '🌤', label: '—' };

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Lat/lon-based climate estimate (used when D1 climate data isn't loaded).
 * Simplified model:
 *  - baseline avg high temp = 28 - 0.4 * |lat - 20| (rough temperature gradient)
 *  - tropical (|lat| < 23.5): less seasonal variation
 *  - temperate (23.5-45): moderate seasonal swing
 *  - polar (|lat| > 60): high seasonal swing
 *  - northern hemisphere: peak in July, trough in January
 *  - southern hemisphere: opposite
 *  - returns 12 months of avg_high_c
 */
function estimateClimate(lat) {
  const absLat = Math.abs(lat);
  const isNorth = lat >= 0;
  const isTropical = absLat < 23.5;
  const isPolar = absLat > 60;

  // Peak avg high in summer
  const peakHigh = isTropical ? 31 : isPolar ? 8 : 28 - 0.4 * Math.max(0, absLat - 20);
  const winterHigh = isTropical ? 30 : isPolar ? -20 : peakHigh - 12 - 0.3 * (absLat - 20);
  const amplitude = (peakHigh - winterHigh) / 2;

  // Day of year for peak (July 15 = day 196 for north, January 15 for south)
  const peakDay = isNorth ? 196 : 15;

  return Array.from({ length: 12 }, (_, i) => {
    const monthStartDay = i * 30 + 15; // mid-month
    const daysFromPeak = Math.abs(monthStartDay - peakDay);
    const seasonal = Math.min(1, daysFromPeak / 180);
    const avgHighC = (peakHigh + winterHigh) / 2 + amplitude * Math.cos((monthStartDay - peakDay) * Math.PI / 180);
    return {
      month: i + 1,
      avg_high_c: Math.round(avgHighC * 10) / 10,
      avg_low_c: Math.round((avgHighC - 10) * 10) / 10,
      avg_mean_c: Math.round((avgHighC - 5) * 10) / 10,
      climate_class: isTropical ? 'tropical' : isPolar ? 'polar' : 'temperate'
    };
  });
}

async function fetchAll(city) {
  console.log(`\n→ Fetching data for ${city.slug} (id ${city.id})...`);

  // 1. City data — use direct /api/cities with a fetch
  const cityData = await fetchJson(`${API}/api/v2/search?q=${encodeURIComponent(city.slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '))}`);
  const c = cityData.data.cities[0];
  if (!c) throw new Error(`No city found for ${city.slug}`);

  // 2. Time in city
  const timeData = await fetchJson(`${API}/api/v1/time/now?tz=${encodeURIComponent(c.timezone)}`);
  const t = timeData.data;

  // 3. Holidays for country (upcoming + 2026 list)
  const holidaysData = await fetchJson(`${API}/api/v1/holidays?country=${c.countryCode}&year=2026`);

  // 4. OTD for today's date (month-day)
  const today = new Date();
  const mm = today.getUTCMonth() + 1;
  const dd = today.getUTCDate();
  const otdData = await fetchJson(`${API}/api/v1/on-this-day/${mm}-${dd}?limit=10`);

  // 5. Sun data
  const sunData = await fetchJson(`${API}/api/v1/time/sun?lat=${c.latitude}&lon=${c.longitude}&date=${today.toISOString().slice(0,10)}`);

  // 6. DST upcoming
  let dstData = null;
  try {
    dstData = await fetchJson(`${API}/api/v1/dst/upcoming?tz=${encodeURIComponent(c.timezone)}`);
  } catch (e) { /* DST endpoint may not work */ }

  // 7. Climate (for chart heights) — old fetch
  let climateData;
  try {
    const climateResp = await fetchJson(`${API}/api/v1/cities/${c.id}/climate`);
    climateData = climateResp.data || climateResp;
  } catch (e) { climateData = null; }

  // If no climate data, compute a lat/lon-based estimate
  if (!climateData || !climateData.climate || climateData.climate.length === 0) {
    climateData = { climate: estimateClimate(c.latitude) };
  }

  // 8. 7-day weather forecast (Open-Meteo, no API key needed)
  // https://open-meteo.com/ (CC BY 4.0)
  const weatherData = await fetchJson(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${c.latitude}&longitude=${c.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(c.timezone)}&forecast_days=7`
  );

  // 9. Cities near (haversine, computed from full city list)
  // /api/v1/cities doesn't filter by country, so fetch top 2000 by pop and filter ourselves.
  let nearbyCities = [];
  try {
    const candidates = [];
    for (let offset = 0; offset < 2000; offset += 500) {
      const nearbyResp = await fetchJson(`${API}/api/v1/cities?limit=500&offset=${offset}`);
      const list = nearbyResp.data?.cities || nearbyResp.cities || [];
      candidates.push(...list.filter(x => x.countryCode === c.countryCode));
      if (candidates.length >= 20) break; // enough
    }
    nearbyCities = candidates
      .filter(x => x.id !== c.id)
      .map(x => ({ ...x, distanceKm: haversineKm(c.latitude, c.longitude, x.latitude, x.longitude) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  } catch (e) { console.warn('nearby fetch failed:', e.message); }

  return {
    city: c,
    time: t,
    holidays: holidaysData.data || holidaysData,
    otd: otdData,
    weather: weatherData,
    nearby: nearbyCities,
    sun: sunData.data || sunData,
    dst: dstData ? (dstData.data || dstData) : null,
    climate: climateData
  };
}

function cca2ToFlag(cca2) {
  if (!cca2 || cca2.length !== 2) return '🌐';
  const codePoints = cca2.toUpperCase().split('').map(ch => 127397 + ch.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function fmtTime(iso, use24 = false) {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  if (use24) {
    return `${String(h).padStart(2,'0')}:${m}:${s}`;
  } else {
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m}:${s} ${ampm}`;
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function numberFormat(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function renderTemplate(d) {
  const { city: c, time: t, holidays, otd, sun, dst, climate, weather, nearby } = d;
  const today = new Date();
  const sunRise = sun?.sunrise_utc ? new Date(sun.sunrise_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: c.timezone }) : '6:00 AM';
  const sunSet = sun?.sunset_utc ? new Date(sun.sunset_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: c.timezone }) : '6:00 PM';
  const dayLength = sun?.daylight_seconds ? `${Math.floor(sun.daylight_seconds / 3600)}h ${Math.round((sun.daylight_seconds % 3600) / 60)}m` : '12h 0m';
  const offsetStr = t.offset || 'UTC+0';
  const offsetAbbr = t.offsetMinutes === -240 ? 'EDT' :
                     t.offsetMinutes === -300 ? 'CDT' :
                     t.offsetMinutes === -360 ? 'CST' :
                     t.offsetMinutes === -480 ? 'PST' :
                     t.offsetMinutes === 0 ? 'GMT' :
                     t.offsetMinutes === 60 ? 'CET' :
                     t.offsetMinutes > 0 ? `+${t.offsetMinutes/60}` :
                     `${t.offsetMinutes/60}`;
  const fullName = c.name + (c.stateCode ? `, ${c.stateCode}` : '');

  // 5 quick-info pills (we'll let JS fill in more)
  const pillsHtml = `
    <span class="pill"><span class="icon">🌅</span><span class="value">${sunRise}</span><span class="label">sunrise</span></span>
    <span class="pill"><span class="icon">🌇</span><span class="value">${sunSet}</span><span class="label">sunset</span></span>
    <span class="pill"><span class="icon">📏</span><span class="value">${dayLength}</span><span class="label">daylight</span></span>
    <span class="pill"><span class="icon">👥</span><span class="value">${numberFormat(c.population)}</span><span class="label">pop</span></span>
    <span class="pill"><span class="icon">📍</span><span class="value">${c.latitude.toFixed(2)}°, ${c.longitude.toFixed(2)}°</span><span class="label">coords</span></span>
  `;

  // 8 color-coded info blocks
  const blocksHtml = `
    <div class="info-block time">
      <div class="icon">🕐</div>
      <div class="label">Current time</div>
      <div class="value" data-tz="${c.timezone}">${fmtTime(t.utc || new Date().toISOString(), false)}<br>${offsetAbbr} · ${fmtDate(t.utc || new Date().toISOString()).split(',')[0]}</div>
    </div>
    <div class="info-block zone">
      <div class="icon">🕒</div>
      <div class="label">Time zone</div>
      <div class="value">${c.timezone}<br>${offsetStr} hours from UTC</div>
    </div>
    <div class="info-block dst">
      <div class="icon">▶</div>
      <div class="label">DST started</div>
      <div class="value">${dst?.started || 'Mar 8, 2026'}<br>Forward 1 hour</div>
    </div>
    <div class="info-block dst">
      <div class="icon">⏸</div>
      <div class="label">DST ends</div>
      <div class="value">${dst?.ends || 'Nov 1, 2026'}<br>Back 1 hour</div>
    </div>
    <div class="info-block time">
      <div class="icon">🌐</div>
      <div class="label">Time in other cities</div>
      <div class="value">New York: ${c.timezone === 'America/New_York' ? 'same' : c.timezone === 'America/Los_Angeles' ? '+3h' : '−?'}<br>London: ${c.timezone === 'Europe/London' ? 'same' : '+?'} · Tokyo: ${c.timezone === 'Asia/Tokyo' ? 'same' : '+?'}</div>
    </div>
    <div class="info-block weather">
      <div class="icon">⛅</div>
      <div class="label">Weather</div>
      <div class="value" data-weather="${c.id}">Loading weather…<br>via Open-Meteo</div>
    </div>
    <div class="info-block sun">
      <div class="icon">🌅</div>
      <div class="label">Sunrise</div>
      <div class="value">${sunRise}<br>↑ East</div>
    </div>
    <div class="info-block sun">
      <div class="icon">🌇</div>
      <div class="label">Sunset</div>
      <div class="value">${sunSet}<br>↓ West</div>
    </div>
  `;

  // Tampa in numbers (we'll use real city stats)
  const statsHtml = `
    <div class="stat-cell"><div class="value">${numberFormat(c.population)}</div><div class="label">Population</div></div>
    <div class="stat-cell"><div class="value">${c.elevation ? c.elevation + 'm' : '—'}</div><div class="label">Elevation</div></div>
    <div class="stat-cell"><div class="value">${c.featureCode}</div><div class="label">Feature</div></div>
    <div class="stat-cell"><div class="value">${c.isCapital ? '✓' : '—'}</div><div class="label">Capital</div></div>
    <div class="stat-cell"><div class="value">${c.stateCode || '—'}</div><div class="label">Region</div></div>
    <div class="stat-cell"><div class="value">${c.countryCode}</div><div class="label">Country</div></div>
  `;

  // OTD events (limit 3)
  const otdEvents = (otd?.events || []).slice(0, 3);
  const otdHtml = otdEvents.length > 0 ? otdEvents.map(e => `
    <div class="data-row">
      <div class="date">${e.year || '—'}</div>
      <div><div class="name">${e.title}</div><div class="meta">${e.description || ''}</div></div>
      <div class="when">Event</div>
    </div>
  `).join('') : `
    <div class="data-row"><div class="date">—</div><div><div class="name">No events on file for today</div><div class="meta">Check back tomorrow for new historical content</div></div><div class="when">—</div></div>
  `;

  // Holidays (limit 6, upcoming only)
  const upcomingHolidays = (holidays?.holidays || holidays || []).filter(h => new Date(h.date) >= today).slice(0, 6);
  const holidaysHtml = upcomingHolidays.length > 0 ? upcomingHolidays.map(h => {
    const days = Math.ceil((new Date(h.date) - today) / (1000 * 60 * 60 * 24));
    return `
      <div class="data-row">
        <div class="date">${new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        <div><div class="name">${h.name || h.localName}</div><div class="meta">${h.types?.join(' · ') || 'Public holiday'}</div></div>
        <div class="when">${days}d</div>
      </div>
    `;
  }).join('') : `
    <div class="data-row"><div class="date">—</div><div><div class="name">No upcoming holidays</div><div class="meta">2026 calendar available via API</div></div><div class="when">—</div></div>
  `;

  // 7-day weather forecast (Open-Meteo, no API key)
  const wDaily = weather?.daily || {};
  const wCurrent = weather?.current || {};
  const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayIdx = (wDaily.time || []).findIndex(d => d === new Date().toISOString().slice(0,10));
  const weatherHtml = (wDaily.time && wDaily.time.length > 0) ? `
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem;">
      ${(wDaily.time || []).map((d, i) => {
        const date = new Date(d + 'T12:00:00');
        const code = wDaily.weather_code?.[i] ?? 0;
        const emoji = wmo(code).emoji;
        const hi = Math.round(wDaily.temperature_2m_max?.[i] ?? 0);
        const lo = Math.round(wDaily.temperature_2m_min?.[i] ?? 0);
        const isToday = i === 0;
        return `
          <div class="weather-day"${isToday ? ' style="border: 2px solid var(--color-primary);"' : ''}>
            <div class="day">${isToday ? 'Today' : daysShort[date.getDay()]}</div>
            <div class="icon">${emoji}</div>
            <div class="hi">${hi}°</div>
            <div class="lo">${lo}°</div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; font-size: 0.875rem; color: var(--color-muted);">
      <span>💧 ${wCurrent.relative_humidity_2m ?? '—'}% humidity</span>
      <span>💨 ${Math.round(wCurrent.wind_speed_10m ?? 0)} mph wind</span>
      <span>🌡 ${Math.round((wCurrent.apparent_temperature ?? wCurrent.temperature_2m) * 9/5 + 32)}°F feels like</span>
      <span>🕵 UV ${wDaily.uv_index_max?.[0] ?? '—'}</span>
      <span>📏 ${wCurrent.surface_pressure ?? '—'} hPa</span>
    </div>
    <p style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--color-muted-soft);">Weather data via <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0). Updated every 6 hours.</p>
  ` : '<p style="color: var(--color-muted);">Weather forecast unavailable.</p>';

  // Cities near (haversine, top 6)
  const nearbyHtml = (nearby && nearby.length > 0) ? `
    <div class="nearby-grid">
      ${nearby.map(n => `
        <a href="/world-time/city/${n.asciiName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}/" class="nearby-card">
          <div class="name">${n.name}</div>
          <div class="meta">${Math.round(n.distanceKm)} km ${n.stateCode ? `· ${n.stateCode}` : ''} · ${n.countryCode}</div>
          <div class="time" data-tz="${n.timezone}">${fmtTime(new Date().toLocaleString('en-US', { timeZone: n.timezone }), false).split(' ')[0]}<span class="ampm">${fmtTime(new Date().toLocaleString('en-US', { timeZone: n.timezone }), false).split(' ')[1]}</span></div>
        </a>
      `).join('')}
    </div>
  ` : '<p style="color: var(--color-muted);">No nearby cities in our database.</p>';

  // Climate chart (12-month bars) — convert to Fahrenheit
  const climateList = (climate && climate.climate) || [];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const climateMax = climateList.length > 0 ? Math.max(...climateList.map(m => m.avg_high_c || 0)) : 30;
  const climateMin = climateList.length > 0 ? Math.min(...climateList.map(m => m.avg_low_c || 0)) : 0;
  const climateRange = Math.max(1, climateMax - climateMin);
  const climateHtml = climateList.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; align-items: end; height: 140px; margin: 0.5rem 0 0;">
      ${climateList.map(m => {
        const hiF = Math.round((m.avg_high_c || 0) * 9/5 + 32);
        const loF = Math.round((m.avg_low_c || 0) * 9/5 + 32);
        const heightPct = Math.max(15, ((m.avg_high_c || 0) - climateMin) / climateRange * 100);
        return `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; height: 100%;">
            <div style="font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-foreground); font-weight: 700;">${hiF}°</div>
            <div style="flex: 1; width: 100%; display: flex; align-items: end;">
              <div style="width: 100%; height: ${heightPct}%; background: linear-gradient(180deg, #f59e0b 0%, #c44536 100%); border-radius: 3px 3px 0 0; min-height: 4px;"></div>
            </div>
            <div style="font-size: 0.6875rem; color: var(--color-muted);">${MONTHS_SHORT[m.month - 1]}</div>
            <div style="font-family: var(--font-mono); font-size: 0.625rem; color: var(--color-muted-soft);">${loF}°</div>
          </div>
        `;
      }).join('')}
    </div>
    <p style="margin-top: 1.5rem; font-size: 0.875rem; color: var(--color-foreground-soft);">
      Climate: <strong>${climateList[0]?.climate_class || 'temperate'}</strong> · avg high ${Math.round(climateList.reduce((s,m) => s + (m.avg_high_c || 0), 0) / climateList.length * 9/5 + 32)}°F · avg low ${Math.round(climateList.reduce((s,m) => s + (m.avg_low_c || 0), 0) / climateList.length * 9/5 + 32)}°F
    </p>
  ` : '<p style="color: var(--color-muted);">Climate data unavailable.</p>';

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${fullName} — Current Time, Time Zone, Weather & People · dateandtime.live</title>
  <meta name="description" content="${c.name}: live local time (${offsetAbbr}, ${offsetStr}), 7-day weather, sunrise & sunset, holidays, famous people, climate, and time difference from every major city. Updated every second." />
  <link rel="canonical" href="https://dateandtime.live/world-time/city/${c.slug || d.city.slug || ''}/" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "City",
    "name": "${c.name}",
    "containedInPlace": { "@type": "Country", "name": "${c.countryName}" },
    "geo": { "@type": "GeoCoordinates", "latitude": ${c.latitude}, "longitude": ${c.longitude} },
    "population": ${c.population || 0},
    "timeZone": "${c.timezone}"
  }
  </script>
  <style>
    :root {
      --color-bg: #ffffff; --color-bg-soft: #f8f9fb; --color-bg-elev: #ffffff;
      --color-foreground: #0a1929; --color-foreground-soft: #2c3e50;
      --color-muted: #5a6878; --color-muted-soft: #95a3b3;
      --color-border: #e3e7ec; --color-border-soft: #eef1f4;
      --color-primary: #c44536; --color-primary-soft: #fdf1ee;
      --color-accent: #2c5d63; --color-link: #1a5490;
      --blk-time-bg: #fce8e1; --blk-time-fg: #c44536;
      --blk-zone-bg: #fef3e6; --blk-zone-fg: #d97706;
      --blk-sun-bg: #fef9c3; --blk-sun-fg: #ca8a04;
      --blk-moon-bg: #ede9fe; --blk-moon-fg: #7c3aed;
      --blk-tide-bg: #cffafe; --blk-tide-fg: #0e7490;
      --blk-weather-bg: #dbeafe; --blk-weather-fg: #1d4ed8;
      --blk-air-bg: #d1fae5; --blk-air-fg: #047857;
      --blk-pop-bg: #fce7f3; --blk-pop-fg: #be185d;
      --blk-dst-bg: #fef3c7; --blk-dst-fg: #92400e;
      --container: 1280px;
      --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      --font-serif: "Source Serif 4", "Tiempos Headline", Charter, Georgia, serif;
      --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Code", monospace;
    }
    [data-theme="dark"] {
      --color-bg: #0a1929; --color-bg-soft: #102438; --color-bg-elev: #142d44;
      --color-foreground: #f0f4f8; --color-foreground-soft: #c8d4e0;
      --color-muted: #95a3b3; --color-muted-soft: #5a6878;
      --color-border: #1d3552; --color-border-soft: #14283d;
      --color-primary: #e87664; --color-primary-soft: #2c1a16;
      --color-accent: #5e9ba3; --color-link: #6ba4d6;
      --blk-time-bg: #3a1d18; --blk-time-fg: #e87664;
      --blk-zone-bg: #3a2a18; --blk-zone-fg: #fbbf24;
      --blk-sun-bg: #3a3214; --blk-sun-fg: #fde047;
      --blk-moon-bg: #1f1a36; --blk-moon-fg: #c4b5fd;
      --blk-tide-bg: #0e2e36; --blk-tide-fg: #67e8f9;
      --blk-weather-bg: #1a2a44; --blk-weather-fg: #93c5fd;
      --blk-air-bg: #0e2e22; --blk-air-fg: #6ee7b7;
      --blk-pop-bg: #2e1a26; --blk-pop-fg: #f9a8d4;
      --blk-dst-bg: #2e2410; --blk-dst-fg: #fde047;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-sans); background: var(--color-bg); color: var(--color-foreground); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: var(--color-link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { max-width: var(--container); margin: 0 auto; padding: 0 1.5rem; }
    h1, h2, h3, h4 { font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
    h1 { font-size: clamp(1.875rem, 3.5vw, 2.5rem); }
    h2 { font-size: clamp(1.25rem, 2vw, 1.5rem); margin: 2.5rem 0 1rem; }
    h3 { font-size: 1.0625rem; margin: 1.5rem 0 0.5rem; }
    p { color: var(--color-foreground-soft); }
    .serif { font-family: var(--font-serif); }
    .theme-toggle { position: fixed; top: 1rem; right: 1rem; z-index: 100; width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; background: var(--color-bg-elev); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .theme-toggle svg { width: 1.125rem; height: 1.125rem; color: var(--color-foreground); }
    .topnav { padding: 0.875rem 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border-soft); background: var(--color-bg); position: sticky; top: 0; z-index: 50; }
    .topnav .logo { font-weight: 800; font-size: 1rem; letter-spacing: -0.02em; color: var(--color-foreground); }
    .topnav nav { display: flex; gap: 1rem; font-size: 0.875rem; }
    .topnav nav a { color: var(--color-muted); }
    .crumbs { padding: 0.75rem 0; font-size: 0.8125rem; color: var(--color-muted); display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .crumbs a { color: var(--color-muted); }
    .crumbs .sep { opacity: 0.4; }
    .crumbs .current { color: var(--color-foreground); font-weight: 600; }
    .hero { padding: 1.5rem 0 2rem; display: grid; grid-template-columns: 1.4fr 1fr; gap: 2.5rem; align-items: end; }
    @media (max-width: 800px) { .hero { grid-template-columns: 1fr; } }
    .hero-left .pre-title { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }
    .hero-left h1 { font-family: var(--font-serif); font-size: clamp(2.5rem, 5vw, 3.75rem); line-height: 1.05; margin-bottom: 0.75rem; }
    .hero-left h1 .name { color: var(--color-primary); }
    .hero-left .lede { font-size: 1.0625rem; line-height: 1.6; color: var(--color-foreground-soft); max-width: 32rem; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 1rem; font-size: 0.875rem; color: var(--color-muted); }
    .hero-clock { background: var(--color-bg-soft); border-radius: 1rem; padding: 1.5rem; border: 1px solid var(--color-border-soft); }
    .clock-row { display: flex; align-items: baseline; gap: 0.5rem; }
    .clock-time { font-family: var(--font-mono); font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700; line-height: 1; letter-spacing: -0.025em; color: var(--color-foreground); }
    .clock-time .ampm { font-size: 0.35em; opacity: 0.55; font-weight: 500; margin-left: 0.4em; }
    .clock-time .ms { font-size: 0.4em; opacity: 0.4; font-weight: 500; }
    .clock-date { font-size: 0.9375rem; color: var(--color-foreground-soft); margin-top: 0.5rem; }
    .clock-tz { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 1rem; }
    .clock-tz .pill { padding: 0.25rem 0.625rem; border-radius: 9999px; background: var(--color-primary-soft); color: var(--color-primary); font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; }
    .clock-tz .meta { font-size: 0.8125rem; color: var(--color-muted); }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.3); animation: pulse 2s infinite; display: inline-block; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
    .pillbar { padding: 0.5rem 0 1.5rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .pillbar-row { display: flex; gap: 0.5rem; min-width: min-content; }
    .pillbar .pill { flex-shrink: 0; padding: 0.625rem 1rem; border-radius: 9999px; background: var(--color-bg-soft); border: 1px solid var(--color-border-soft); font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
    .pillbar .pill .icon { font-size: 1rem; }
    .pillbar .pill .value { font-weight: 700; color: var(--color-foreground); }
    .pillbar .pill .label { color: var(--color-muted); font-size: 0.8125rem; }
    .section-head { display: flex; align-items: end; justify-content: space-between; margin: 2.5rem 0 1rem; padding-bottom: 0.625rem; border-bottom: 2px solid var(--color-foreground); }
    .section-head .num { font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; color: var(--color-muted); letter-spacing: 0.05em; }
    .section-head h2 { margin: 0; padding: 0; border: none; font-size: 1.25rem; font-weight: 800; }
    .section-head .more { font-size: 0.8125rem; color: var(--color-link); font-weight: 600; }
    .info-blocks { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.5rem; }
    @media (max-width: 1000px) { .info-blocks { grid-template-columns: repeat(4, 1fr); } }
    @media (max-width: 600px) { .info-blocks { grid-template-columns: repeat(2, 1fr); } }
    .info-block { padding: 1.25rem 0.875rem; text-align: center; display: flex; flex-direction: column; gap: 0.5rem; min-height: 140px; }
    .info-block .icon { font-size: 2rem; line-height: 1; }
    .info-block .label { font-size: 0.875rem; font-weight: 700; color: var(--blk-fg); }
    .info-block .value { font-size: 0.75rem; color: var(--color-muted); line-height: 1.4; }
    .info-block.time { background: var(--blk-time-bg); --blk-fg: var(--blk-time-fg); }
    .info-block.zone { background: var(--blk-zone-bg); --blk-fg: var(--blk-zone-fg); }
    .info-block.sun { background: var(--blk-sun-bg); --blk-fg: var(--blk-sun-fg); }
    .info-block.moon { background: var(--blk-moon-bg); --blk-fg: var(--blk-moon-fg); }
    .info-block.tide { background: var(--blk-tide-bg); --blk-fg: var(--blk-tide-fg); }
    .info-block.weather { background: var(--blk-weather-bg); --blk-fg: var(--blk-weather-fg); }
    .info-block.air { background: var(--blk-air-bg); --blk-fg: var(--blk-air-fg); }
    .info-block.pop { background: var(--blk-pop-bg); --blk-fg: var(--blk-pop-fg); }
    .info-block.dst { background: var(--blk-dst-bg); --blk-fg: var(--blk-dst-fg); }
    .stats-inline { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; padding: 1rem 0; }
    @media (max-width: 800px) { .stats-inline { grid-template-columns: repeat(3, 1fr); } }
    .stat-cell { text-align: center; }
    .stat-cell .value { font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: var(--color-foreground); }
    .stat-cell .label { font-size: 0.75rem; color: var(--color-muted); letter-spacing: 0.05em; text-transform: uppercase; }
    .data-list { padding: 0.5rem 0; }
    .weather-day { padding: 1rem 0.5rem; text-align: center; background: var(--color-bg-soft); border-radius: 0.5rem; }
    .weather-day .day { font-size: 0.75rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
    .weather-day .icon { font-size: 1.875rem; line-height: 1; margin: 0.375rem 0; }
    .weather-day .hi { font-family: var(--font-mono); font-weight: 700; color: var(--color-foreground); }
    .weather-day .lo { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--color-muted); }
    .nearby-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    @media (max-width: 700px) { .nearby-grid { grid-template-columns: repeat(2, 1fr); } }
    .nearby-card { padding: 0.875rem; background: var(--color-bg-soft); border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .nearby-card:hover { background: var(--color-primary-soft); text-decoration: none; }
    .nearby-card .name { font-weight: 600; color: var(--color-foreground); }
    .nearby-card .meta { font-size: 0.8125rem; color: var(--color-muted); }
    .nearby-card .time { font-family: var(--font-mono); font-size: 0.875rem; color: var(--color-primary); }
    .nearby-card .time .ampm { opacity: 0.6; font-size: 0.75em; margin-left: 0.2em; }
    .data-row { display: grid; grid-template-columns: 6rem 1fr auto; gap: 1rem; align-items: center; padding: 0.625rem 0; border-bottom: 1px solid var(--color-border-soft); }
    .data-row:last-child { border-bottom: none; }
    .data-row .date { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--color-muted); }
    .data-row .name { font-weight: 600; }
    .data-row .meta { font-size: 0.8125rem; color: var(--color-muted); margin-top: 0.125rem; }
    .data-row .when { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--color-primary); font-weight: 600; }
    .explore-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
    @media (max-width: 700px) { .explore-grid { grid-template-columns: repeat(2, 1fr); } }
    .explore-link { padding: 0.75rem; border: 1px solid var(--color-border-soft); border-radius: 0.5rem; text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--color-foreground-soft); }
    .explore-link:hover { border-color: var(--color-primary); color: var(--color-primary); text-decoration: none; }
    .explore-link .label { display: block; font-size: 0.875rem; margin-bottom: 0.125rem; }
    footer { margin-top: 4rem; padding: 2.5rem 0 1.5rem; border-top: 1px solid var(--color-border); background: var(--color-bg-soft); }
    .footer-cols { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
    @media (max-width: 800px) { .footer-cols { grid-template-columns: 1fr 1fr; } }
    .footer-col h4 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); margin-bottom: 0.75rem; font-weight: 700; }
    .footer-col a { display: block; padding: 0.2rem 0; font-size: 0.8125rem; color: var(--color-foreground-soft); }
    .footer-col a:hover { color: var(--color-link); text-decoration: none; }
    .footer-bottom { padding-top: 1.5rem; border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.75rem; color: var(--color-muted); }
    .city-page-loading { color: var(--color-muted); font-style: italic; }
  </style>
</head>
<body>
  <button class="theme-toggle" aria-label="Toggle dark mode" onclick="document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="theme-icon"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
  </button>

  <header class="topnav">
    <a href="/" class="logo">⏱ dateandtime.live</a>
    <nav>
      <a href="/world-time/">World</a>
      <a href="/world-time/${c.countryCode.toLowerCase()}/">${c.countryName}</a>
      <a href="/time-zones/zone/${c.timezone.toLowerCase()}/">${c.timezone}</a>
      <a href="/holidays/${c.countryCode.toLowerCase()}/">Holidays</a>
      <a href="/meeting/?with=${d.city.slug}">Meeting</a>
    </nav>
    <div>
      <span class="pill" style="background: var(--color-primary-soft); color: var(--color-primary); font-size: 0.75rem; padding: 0.25rem 0.625rem; border-radius: 9999px;">${cca2ToFlag(c.countryCode)} ${c.countryCode}</span>
    </div>
  </header>

  <div class="container">
    <div class="crumbs">
      <a href="/world-time/">World time</a>
      <span class="sep">›</span>
      <a href="/world-time/${c.countryCode.toLowerCase()}/">${c.countryName}</a>
      ${c.stateCode ? `<span class="sep">›</span><a href="/world-time/${c.countryCode.toLowerCase()}/${c.stateCode.toLowerCase()}/">${c.stateCode}</a>` : ''}
      <span class="sep">›</span>
      <span class="current">${c.name}</span>
    </div>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-left">
        <div class="pre-title">Current local time in</div>
        <h1><span class="name">${c.name}</span>${c.stateCode ? `, <span style="font-size: 0.6em; color: var(--color-muted);">${c.stateCode}</span>` : ''}</h1>
        <p class="lede">Live local time, time zone, weather, and history for ${c.name}${c.isCapital ? ' (capital city)' : ''} — a city in ${c.countryName} with ${numberFormat(c.population)} people.</p>
        <div class="hero-meta">
          <span>📍 ${c.latitude.toFixed(4)}°N, ${c.longitude.toFixed(4)}°E</span>
          <span>👥 ${numberFormat(c.population)}</span>
          <span>🌎 ${c.timezone}</span>
          <span>📅 ${fmtDate(new Date().toISOString())}</span>
        </div>
      </div>
      <div class="hero-clock">
        <div class="clock-row">
          <span class="clock-time" id="clockTime">${fmtTime(t.utc || new Date().toISOString(), false).split(' ')[0]}<span class="ms">.00</span><span class="ampm">${fmtTime(t.utc || new Date().toISOString(), false).split(' ')[1]}</span></span>
        </div>
        <div class="clock-date" id="clockDate">${fmtDate(new Date().toISOString())}</div>
        <div class="clock-tz">
          <span class="live-dot"></span>
          <span class="pill">${offsetAbbr}</span>
          <span class="pill">${offsetStr}</span>
          <span class="meta" id="tzMeta">${c.timezone}</span>
        </div>
      </div>
    </section>

    <!-- Quick info pill bar -->
    <section class="pillbar">
      <div class="pillbar-row">${pillsHtml}</div>
    </section>

    <!-- Section 02: TAD-style color blocks -->
    <div class="section-head">
      <h2><span class="num">02</span> · Time, zone, and environment</h2>
      <a class="more" href="/world-time/city/${d.city.slug}/time/">All time details →</a>
    </div>
    <section class="info-blocks">${blocksHtml}</section>

    <!-- Section 03: Tampa in numbers -->
    <div class="section-head">
      <h2><span class="num">03</span> · ${c.name} in numbers</h2>
      <a class="more" href="/world-time/city/${d.city.slug}/facts/">More facts →</a>
    </div>
    <section class="stats-inline">${statsHtml}</section>

    <!-- Section 04: OTD -->
    <div class="section-head">
      <h2><span class="num">04</span> · On this day (${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})</h2>
      <a class="more" href="/onthisday/by-date/${today.getUTCMonth()+1}-${today.getUTCDate()}/">All events →</a>
    </div>
    <section class="data-list">${otdHtml}</section>

    <!-- Section 05: 7-day weather -->
    <div class="section-head">
      <h2><span class="num">05</span> · 7-day weather in ${c.name}</h2>
      <a class="more" href="/world-time/city/${d.city.slug}/weather/">Full forecast →</a>
    </div>
    <section>${weatherHtml}</section>

    <!-- Section 06: Holidays -->
    <div class="section-head">
      <h2><span class="num">06</span> · Upcoming ${c.countryName} holidays</h2>
      <a class="more" href="/holidays/${c.countryCode.toLowerCase()}/">All 2026 →</a>
    </div>
    <section class="data-list">${holidaysHtml}</section>

    <!-- Section 07: Cities near -->
    <div class="section-head">
      <h2><span class="num">07</span> · Cities near ${c.name}</h2>
      <a class="more" href="/world-time/${c.countryCode.toLowerCase()}/${(c.stateCode||'').toLowerCase()}/">All nearby →</a>
    </div>
    <section>${nearbyHtml}</section>

    <!-- Section 08: Climate year-round -->
    <div class="section-head">
      <h2><span class="num">08</span> · ${c.name} climate year-round</h2>
      <a class="more" href="/world-time/city/${d.city.slug}/climate/">Full climate →</a>
    </div>
    <section>${climateHtml}</section>

    <!-- Section 09: More to explore -->
    <div class="section-head">
      <h2><span class="num">09</span> · More to explore</h2>
    </div>
    <section class="explore-grid">
      <a href="/world-time/${c.countryCode.toLowerCase()}/" class="explore-link"><span class="label">${cca2ToFlag(c.countryCode)} ${c.countryName}</span>All ${c.countryName} cities</a>
      ${c.stateCode ? `<a href="/world-time/${c.countryCode.toLowerCase()}/${c.stateCode.toLowerCase()}/" class="explore-link"><span class="label">${c.stateCode}</span>All ${c.stateCode} cities</a>` : ''}
      <a href="/time-zones/zone/${c.timezone.toLowerCase()}/" class="explore-link"><span class="label">🕒 ${c.timezone}</span>Time zone hub</a>
      <a href="/holidays/${c.countryCode.toLowerCase()}/" class="explore-link"><span class="label">🎉 Holidays</span>2026 calendar</a>
      <a href="/meeting/?with=${d.city.slug}" class="explore-link"><span class="label">📅 Meeting</span>Plan with ${c.name}</a>
    </section>

    <footer>
      <div class="footer-cols">
        <div>
          <div class="logo" style="margin-bottom: 0.5rem;">⏱ dateandtime.live</div>
          <p style="font-size: 0.875rem; color: var(--color-muted);">Live time, time zone, weather, and calendar for every city on Earth. 33,945 cities, 408 time zones, 242 countries.</p>
        </div>
        <div class="footer-col">
          <h4>${c.name}</h4>
          <a href="/world-time/city/${d.city.slug}/">Overview</a>
          <a href="/world-time/city/${d.city.slug}/sunrise/">Sun & Moon</a>
          <a href="/world-time/city/${d.city.slug}/holidays/">Holidays</a>
          <a href="/world-time/city/${d.city.slug}/people/">People</a>
          <a href="/world-time/city/${d.city.slug}/weather/">Weather</a>
        </div>
        <div class="footer-col">
          <h4>${c.countryName}</h4>
          <a href="/world-time/${c.countryCode.toLowerCase()}/">All ${c.countryName} cities</a>
          <a href="/holidays/${c.countryCode.toLowerCase()}/">${c.countryName} holidays</a>
          <a href="/time-zones/zone/${c.timezone.toLowerCase()}/">${c.timezone}</a>
        </div>
        <div class="footer-col">
          <h4>Tools</h4>
          <a href="/meeting/?with=${d.city.slug}">Meeting planner</a>
          <a href="/converter/?from=${d.city.slug}">Time converter</a>
          <a href="/distance/?from=${d.city.slug}">Distance</a>
          <a href="/event-time/?at=${d.city.slug}">Event time</a>
        </div>
        <div class="footer-col">
          <h4>Top cities</h4>
          <a href="/world-time/city/new-york/">New York</a>
          <a href="/world-time/city/london/">London</a>
          <a href="/world-time/city/tokyo/">Tokyo</a>
          <a href="/world-time/city/sydney/">Sydney</a>
          <a href="/world-time/city/dubai/">Dubai</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 dateandtime.live · ${fullName}</span>
        <span>Wikipedia-derived content licensed CC BY-SA 4.0</span>
      </div>
    </footer>
  </div>

  <script>
    // Live clock updates (60fps via requestAnimationFrame)
    const TZ = "${c.timezone}";
    const CITY_NAME = "${c.name}";
    const USE_24 = localStorage.getItem('tdp-fmt') === '24';

    function updateClock() {
      const el = document.getElementById('clockTime');
      const dateEl = document.getElementById('clockDate');
      if (!el) return;
      const now = new Date();
      const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !USE_24, timeZone: TZ };
      const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ };
      const timeStr = now.toLocaleTimeString('en-US', timeOpts);
      const dateStr = now.toLocaleDateString('en-US', dateOpts);
      // Split AM/PM into span
      if (USE_24) {
        el.innerHTML = timeStr.replace(/^(\\d{2}:\\d{2}:\\d{2})/, '$1') + '<span class="ms">.' + String(Math.floor(now.getMilliseconds()/10)).padStart(2,'0') + '</span>';
      } else {
        const m = timeStr.match(/^(\\d{1,2}:\\d{2}:\\d{2})\\s?(AM|PM)$/i);
        if (m) el.innerHTML = m[1] + '<span class="ms">.' + String(Math.floor(now.getMilliseconds()/10)).padStart(2,'0') + '</span><span class="ampm">' + m[2] + '</span>';
        else el.textContent = timeStr;
      }
      if (dateEl) dateEl.textContent = dateStr;
      requestAnimationFrame(updateClock);
    }
    updateClock();

    // Theme icon
    function updateThemeIcon() {
      const isDark = document.documentElement.dataset.theme === 'dark';
      const icon = document.getElementById('theme-icon');
      if (!icon) return;
      icon.innerHTML = isDark
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
        : '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>';
    }
    updateThemeIcon();
    document.querySelector('.theme-toggle').addEventListener('click', () => setTimeout(updateThemeIcon, 50));
  </script>
</body>
</html>`;
}

async function buildCity(city) {
  try {
    const data = await fetchAll(city);
    const html = renderTemplate(data);
    const outDir = path.join('/workspace/dateandtime-live/world-time/city', city.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log(`✓ ${city.slug}/index.html (${html.length} bytes)`);
    return true;
  } catch (err) {
    console.error(`✗ ${city.slug} failed:`, err.message);
    return false;
  }
}

(async () => {
  console.log(`Building ${CITIES.length} city pages via ${API}...`);
  let ok = 0;
  for (const city of CITIES) {
    const r = await buildCity(city);
    if (r) ok++;
  }
  console.log(`\n${ok}/${CITIES.length} pages built successfully.`);
})();
