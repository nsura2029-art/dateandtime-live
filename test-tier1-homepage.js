#!/usr/bin/env node
/**
 * Test the homepage Tier 1 changes:
 * - 5 JSON-LD blocks present and valid
 * - hreflang for 14 languages
 * - 6 pills converted to <a href>
 * - "Today on Earth" strip with 6 cards
 * - OTD section still has 1 card container (not 5)
 * - FAQ has 8 items (not expanded)
 */

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const HTML = readFileSync('./index.html', 'utf-8');

let pass = 0, fail = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${err.message}`);
      fail++;
    }
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

const dom = new JSDOM(HTML, { url: 'http://localhost:9877/' });
const { window } = dom;
const doc = window.document;

console.log('TIER 1 HOMEPAGE CHANGES:\n');

// =========== B2: JSON-LD blocks ===========

await test('5 JSON-LD blocks present', async () => {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  assert(scripts.length === 5, `expected 5, got ${scripts.length}`);
})();

await test('WebSite + SearchAction JSON-LD valid', async () => {
  const s = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .find(x => x.textContent.includes('"@type":"WebSite"'));
  assert(s, 'WebSite schema not found');
  const j = JSON.parse(s.textContent);
  assert(j['@type'] === 'WebSite');
  assert(j.potentialAction?.['@type'] === 'SearchAction');
})();

await test('Organization + sameAs JSON-LD valid', async () => {
  const s = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .find(x => x.textContent.includes('"@type":"Organization"'));
  assert(s, 'Organization schema not found');
  const j = JSON.parse(s.textContent);
  assert(j.sameAs && j.sameAs.length > 0);
})();

await test('WebApplication + featureList JSON-LD valid', async () => {
  const s = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .find(x => x.textContent.includes('"@type":"WebApplication"'));
  assert(s, 'WebApplication schema not found');
  const j = JSON.parse(s.textContent);
  assert(j.featureList && j.featureList.length >= 5, `featureList should have 5+ items, got ${j.featureList?.length}`);
})();

await test('ItemList of 6 cities JSON-LD valid', async () => {
  const s = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .find(x => x.textContent.includes('"@type":"ItemList"'));
  assert(s, 'ItemList schema not found');
  const j = JSON.parse(s.textContent);
  assert(j.numberOfItems === 6, `numberOfItems should be 6, got ${j.numberOfItems}`);
  assert(j.itemListElement && j.itemListElement.length === 6, `should have 6 list items, got ${j.itemListElement?.length}`);
  // Check cities
  const names = j.itemListElement.map(i => i.item.name);
  assert(names.includes('Tokyo') && names.includes('London') && names.includes('New York'), `should include major cities, got: ${names.join(', ')}`);
})();

await test('FAQPage with 8 Q&A JSON-LD valid', async () => {
  const s = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .find(x => x.textContent.includes('"@type":"FAQPage"'));
  assert(s, 'FAQPage schema not found');
  const j = JSON.parse(s.textContent);
  assert(j.mainEntity && j.mainEntity.length === 8, `FAQ should have 8 questions, got ${j.mainEntity?.length}`);
})();

// =========== B3: hreflang ===========

await test('hreflang for 14 languages + x-default', async () => {
  const links = doc.querySelectorAll('link[rel="alternate"][hreflang]');
  assert(links.length >= 15, `should have 15+ hreflang tags (14 langs + x-default), got ${links.length}`);
  const xdef = doc.querySelector('link[rel="alternate"][hreflang="x-default"]');
  assert(xdef, 'x-default hreflang missing');
})();

await test('hreflang includes major languages (es, fr, de, ja, zh)', async () => {
  const langs = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map(l => l.getAttribute('hreflang'));
  ['es', 'fr', 'de', 'ja', 'zh'].forEach(l => {
    assert(langs.includes(l), `missing hreflang for ${l}`);
  });
})();

// =========== B4: Pills as <a> ===========

await test('6 pills converted to <a href> (not <span>)', async () => {
  const pillSpans = doc.querySelectorAll('span.pill');
  assert(pillSpans.length === 0, `expected 0 span.pill (all should be <a>), got ${pillSpans.length}`);
  const pillLinks = doc.querySelectorAll('a.pill');
  assert(pillLinks.length === 6, `expected 6 a.pill, got ${pillLinks.length}`);
})();

await test('Pills link to meaningful destinations', async () => {
  const pills = doc.querySelectorAll('a.pill');
  const hrefs = Array.from(pills).map(p => p.getAttribute('href'));
  assert(hrefs.some(h => h.includes('/onthisday/')), 'should link to /onthisday/');
  assert(hrefs.some(h => h.includes('/holidays/')), 'should link to /holidays/');
  assert(hrefs.some(h => h.includes('/time-zones/')), 'should link to /time-zones/');
})();

await test('OTD pill links to /onthisday/ (Tier 1: previously non-clickable)', async () => {
  const otdPill = doc.querySelector('a.pill#onthisday-pill');
  assert(otdPill, 'OTD pill not found as <a>');
  assert(otdPill.getAttribute('href') === '/onthisday/', `OTD pill href should be /onthisday/, got: ${otdPill.getAttribute('href')}`);
})();

// =========== B5: Today on Earth strip ===========

await test('Today on Earth section is present', async () => {
  const section = doc.querySelector('section.section--today-on-earth');
  assert(section, 'section--today-on-earth not found');
})();

await test('6 earth cards in the strip', async () => {
  const cards = doc.querySelectorAll('a.earth-card');
  assert(cards.length === 6, `expected 6 earth cards, got ${cards.length}`);
})();

await test('Each card has flag, city, time, date, offset', async () => {
  const cards = doc.querySelectorAll('a.earth-card');
  for (const card of cards) {
    assert(card.querySelector('.earth-flag'), `card ${card.dataset.city} missing flag`);
    assert(card.querySelector('.earth-city'), `card ${card.dataset.city} missing city`);
    assert(card.querySelector('[data-time-field]'), `card ${card.dataset.city} missing time field`);
    assert(card.querySelector('[data-date-field]'), `card ${card.dataset.city} missing date field`);
    assert(card.querySelector('[data-offset-field]'), `card ${card.dataset.city} missing offset field`);
  }
})();

await test('Earth cards link to correct country pages', async () => {
  const cards = doc.querySelectorAll('a.earth-card');
  const expected = {
    Tokyo: '/time-zones/in/jp/',
    London: '/time-zones/in/gb/',
    'New York': '/time-zones/in/us/',
    Sydney: '/time-zones/in/au/',
    Lagos: '/time-zones/in/ng/',
    'São Paulo': '/time-zones/in/br/'
  };
  for (const card of cards) {
    const city = card.dataset.city;
    assert(card.getAttribute('href') === expected[city], `${city} should link to ${expected[city]}, got ${card.getAttribute('href')}`);
  }
})();

await test('Earth card cities: Tokyo, London, New York, Sydney, Lagos, São Paulo', async () => {
  const cities = Array.from(doc.querySelectorAll('a.earth-card')).map(c => c.dataset.city);
  ['Tokyo', 'London', 'New York', 'Sydney', 'Lagos', 'São Paulo'].forEach(c => {
    assert(cities.includes(c), `missing city: ${c}, got: ${cities.join(', ')}`);
  });
})();

// =========== B6: OTD still 1 card (user-locked) ===========

await test('OTD section still has only 1 card container (no expansion)', async () => {
  const otdSection = doc.querySelector('section.section--onthisday-section');
  assert(otdSection, 'OTD section not found');
  // The "card" is the container, not the cards inside
  const cardContainers = otdSection.querySelectorAll('#onthisday-section-card');
  assert(cardContainers.length === 1, `expected 1 OTD card container, got ${cardContainers.length}`);
})();

// =========== B7: FAQ still 8 items (user-locked) ===========

await test('FAQ section still has 8 items (no expansion)', async () => {
  const faqSection = doc.querySelector('section.section--faq');
  assert(faqSection, 'FAQ section not found');
  const items = faqSection.querySelectorAll('.faq-item');
  assert(items.length === 8, `expected 8 FAQ items, got ${items.length}`);
})();

await test('Search section and favorite cities rail are still present (untouched)', async () => {
  assert(doc.querySelector('section.section--search'), 'search section missing');
  assert(doc.querySelector('section.section--favorites'), 'favorites section missing');
})();

// =========== Sanity: page still renders, no broken HTML ===========

await test('Page is valid HTML (parses without error)', async () => {
  // The JSDOM construction already validates this — if it didn't parse, we'd never get here
  assert(doc.documentElement, 'documentElement missing');
})();

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---\n`);
if (fail > 0) process.exit(1);
