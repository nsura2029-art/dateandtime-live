#!/usr/bin/env node
/**
 * Test the per-event page rendering logic against the synthetic test data.
 * Run: node test-event-page.js
 */

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const HTML = readFileSync('./onthisday/event/index.html', 'utf-8');
const JS = readFileSync('./src/event-page.js', 'utf-8');

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

function makeMockFetch() {
  return async (url) => {
    if (url.includes('persons.json')) {
      return { ok: true, status: 200, json: async () => JSON.parse(readFileSync('/tmp/test-otd/persons.json', 'utf-8')) };
    }
    if (url.includes('Q11631') || url.includes('Apollo_11') || url.includes('1969-apollo-11')) {
      // Return normalized event data
      const raw = JSON.parse(readFileSync('/tmp/test-otd/dates/07-20.json', 'utf-8'))[0];
      return { ok: true, status: 200, json: async () => ({
        title: raw.title,
        type: raw.type,
        year: raw.year,
        month: raw.month,
        day: raw.day,
        yearPrecision: 'day',
        briefDescription: raw.description,
        longDescription: null,
        keyPeople: raw.people_mentioned ? JSON.parse(raw.people_mentioned) : [],
        keyFacts: raw.key_facts ? JSON.parse(raw.key_facts) : [],
        faqQuestions: raw.faq_questions ? JSON.parse(raw.faq_questions) : [],
        image: raw.image_url ? {
          url: raw.image_url, license: raw.image_license, credit: raw.image_credit
        } : null,
        wikidataId: raw.wikidata_id,
        wikipediaUrl: raw.wikipedia_url,
        wikipediaTitle: raw.wikipedia_title,
        countryCode: raw.country_code,
        region: raw.region,
        yearsAgo: 57,
        isAnniversaryToday: false,
        rankScore: raw.rank_score || 0,
        sources: raw.data_sources ? JSON.parse(raw.data_sources) : [],
        verified: raw.verified === 1,
        relatedEvents: [
          { relation: 'same-date-different-year', title: 'Apollo 11', year: 1969, wikipediaUrl: 'https://en.wikipedia.org/wiki/Apollo_11' }
        ],
        knowledgeGraphLinks: {
          wikidata: 'https://www.wikidata.org/wiki/Q11631',
          wikipedia: 'https://en.wikipedia.org/wiki/Apollo_11',
          date: 'https://dateandtime.live/onthisday/by-date/07-20/',
          country: 'https://dateandtime.live/time-zones/in/us/'
        },
        attribution: {
          text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
          textUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
        }
      })};
    }
    if (url.includes('/api/v1/')) {
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    }
    return { ok: false, status: 404 };
  };
}

// Test 1: Q-ID lookup
const dom = new JSDOM(HTML, {
  url: 'http://localhost:9876/onthisday/event/Q11631/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
dom.window.fetch = makeMockFetch();
const script = dom.window.document.createElement('script');
script.textContent = JS;
dom.window.document.body.appendChild(script);
await new Promise(r => setTimeout(r, 1500));

const content = dom.window.document.querySelector('#evt-content');
const hero = dom.window.document.querySelector('#evt-hero');

await test('Event page renders content', async () => {
  assert(content, 'content element exists');
  assert(!content.innerHTML.includes('Loading event…'), 'should not be in loading state');
})();

await test('Event hero contains title', async () => {
  assert(hero.innerHTML.includes('Apollo 11'), `should contain title, got: ${hero.innerHTML.slice(0, 200)}`);
})();

await test('Event hero contains year', async () => {
  assert(hero.innerHTML.includes('1969'), 'should show year');
})();

await test('Event content has description', async () => {
  assert(content.innerHTML.includes('Moon') || content.innerHTML.includes('touchdown'), 'should have description');
})();

await test('Event image is shown', async () => {
  assert(content.innerHTML.includes('Aldrin_Apollo_11') || content.innerHTML.includes('upload.wikimedia.org'), 'should show image');
})();

await test('Event key people rendered', async () => {
  assert(content.innerHTML.includes('Neil Armstrong'), 'should show Neil Armstrong');
})();

await test('Event key facts rendered', async () => {
  assert(content.innerHTML.includes('First crewed Moon landing'), 'should show key fact');
})();

await test('Event related events rendered', async () => {
  assert(content.innerHTML.includes('Related events'), 'should show related events section');
})();

await test('Event JSON-LD Article schema is injected', async () => {
  const ld = dom.window.document.querySelector('script[type="application/ld+json"][data-source="event-api"]');
  assert(ld, 'JSON-LD should be injected');
  const schema = JSON.parse(ld.textContent);
  assert(schema['@type'] === 'Article', `should be Article, got ${schema['@type']}`);
  assert(schema.headline === 'Apollo 11 lands on the Moon', `headline should match, got: ${schema.headline}`);
})();

await test('Event page title is updated', async () => {
  assert(dom.window.document.title.includes('Apollo 11'), `title should mention Apollo 11, got: ${dom.window.document.title}`);
})();

await test('Event attribution is shown (CC BY-SA 4.0)', async () => {
  assert(content.innerHTML.includes('CC BY-SA 4.0'), 'should show attribution');
})();

// Test 2: 404
const dom2 = new JSDOM(HTML, {
  url: 'http://localhost:9876/onthisday/event/zzzzzz/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
dom2.window.fetch = async (url) => {
  if (url.includes('/api/v1/')) {
    return { ok: false, status: 404, json: async () => ({ error: 'Event not found' }) };
  }
  return { ok: false, status: 404 };
};
const s2 = dom2.window.document.createElement('script');
s2.textContent = JS;
dom2.window.document.body.appendChild(s2);
await new Promise(r => setTimeout(r, 1500));

await test('Event 404 shows error state', async () => {
  const c2 = dom2.window.document.querySelector('#evt-content');
  assert(c2.innerHTML.includes('Event not found') || c2.innerHTML.includes('not found'), `should show error, got: ${c2.innerHTML.slice(0, 200)}`);
})();

// Test 3: Year-title slug
const dom3 = new JSDOM(HTML, {
  url: 'http://localhost:9876/onthisday/event/1969-apollo-11/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
dom3.window.fetch = makeMockFetch();
const s3 = dom3.window.document.createElement('script');
s3.textContent = JS;
dom3.window.document.body.appendChild(s3);
await new Promise(r => setTimeout(r, 1500));

await test('Event year-title slug works', async () => {
  const c3 = dom3.window.document.querySelector('#evt-content');
  assert(!c3.innerHTML.includes('Loading event…'), 'should not be in loading state');
  assert(c3.innerHTML.includes('Apollo 11') || c3.innerHTML.includes('Moon'), 'should show event content');
})();

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---\n`);
if (fail > 0) process.exit(1);
