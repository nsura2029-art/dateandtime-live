#!/usr/bin/env node
/**
 * Test the per-person page rendering logic against the synthetic test data.
 * Loads the page JS in a JSDOM environment and verifies it renders correctly.
 *
 * Run: node test-person-page.js
 */

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const HTML = readFileSync('./person/einstein/index.html', 'utf-8');
const JS = readFileSync('./src/person-page.js', 'utf-8');

const dom = new JSDOM(HTML, {
  url: 'http://localhost:9876/person/einstein/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});

const { window } = dom;

// Provide a mock fetch that reads the test data (set BEFORE injecting script)
window.fetch = async (url) => {
  if (url.includes('persons.json')) {
    const data = readFileSync('/tmp/test-otd/persons.json', 'utf-8');
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(data)
    };
  }
  if (url.includes('/api/v1/')) {
    // Simulate API 200 with normalized test data
    return {
      ok: true,
      status: 200,
      json: async () => {
        const data = JSON.parse(readFileSync('/tmp/test-otd/persons.json', 'utf-8'));
        // Normalize to API response shape (camelCase)
        const p = data[0]; // First person = Einstein
        return {
          id: p.wikidata_id,
          label: p.label,
          description: p.description,
          briefDescription: p.description,
          longDescription: null,
          entityType: 'person',
          wikidataId: p.wikidata_id,
          wikipediaTitle: p.wikipedia_title,
          birthDate: p.birth_date,
          deathDate: p.death_date,
          birthYear: p.birth_year,
          deathYear: p.death_year,
          countryCode: p.country_code,
          profession: p.profession || [],
          starSign: p.star_sign,
          chineseZodiac: p.chinese_zodiac,
          generation: p.generation,
          causeOfDeath: p.cause_of_death,
          ageAtDeath: p.age_at_death,
          image: p.image_url ? {
            url: p.image_url,
            license: p.image_license,
            credit: p.image_credit
          } : null,
          sitelinks: p.sitelinks,
          notabilityScore: p.notability_score || p.rank_score,
          onthisdayEntries: [],
          knowledgeGraphLinks: {
            wikidata: `https://www.wikidata.org/wiki/${p.wikidata_id}`,
            wikipedia: `https://en.wikipedia.org/wiki/${p.wikipedia_title}`,
            bornOnPage: p.birth_month && p.birth_day
              ? `https://dateandtime.live/onthisday/born/${String(p.birth_month).padStart(2,'0')}-${String(p.birth_day).padStart(2,'0')}/`
              : null,
            diedOnPage: null,
            profile: `https://dateandtime.live/person/einstein/`
          },
          sources: [],
          attribution: {
            text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
            textUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
          }
        };
      }
    };
  }
  return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
};

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

// Inject the JS into the page
const script = window.document.createElement('script');
script.textContent = JS;
window.document.body.appendChild(script);

// Wait for async init
await new Promise(r => setTimeout(r, 2000));

const content = window.document.querySelector('#prs-content');
const hero = window.document.querySelector('#prs-hero');

// DEBUG
console.log('DEBUG: content length:', content?.innerHTML.length);
console.log('DEBUG: content snippet:', content?.innerHTML?.slice(0, 500));
console.log('DEBUG: hero snippet:', hero?.innerHTML?.slice(0, 500));
console.log('DEBUG: title:', window.document.title);

await test('Page renders content (not loading state)', async () => {
  assert(content, 'content element exists');
  assert(!content.innerHTML.includes('Loading person…'), 'should not be in loading state');
})();

await test('Hero contains the person name', async () => {
  assert(hero.innerHTML.includes('Albert Einstein'), 'should contain name');
})();

await test('Hero contains the life years', async () => {
  assert(hero.innerHTML.includes('1879') && hero.innerHTML.includes('1955'), 'should show life years');
})();

await test('Content contains a brief description', async () => {
  assert(content.innerHTML.includes('theoretical physicist') || content.innerHTML.includes('relativity'), 'should have brief description');
})();

await test('At-a-glance sidebar shows birth date', async () => {
  assert(content.innerHTML.includes('Born') || content.innerHTML.includes('1879-03-14'), 'should show birth date');
})();

await test('At-a-glance sidebar shows country', async () => {
  assert(content.innerHTML.includes('Country') || content.innerHTML.includes('DE'), 'should show country');
})();

await test('JSON-LD Person schema is injected', async () => {
  const ld = window.document.querySelector('script[type="application/ld+json"][data-source="person-api"]');
  assert(ld, 'JSON-LD should be injected');
  const schema = JSON.parse(ld.textContent);
  assert(schema['@type'] === 'Person', 'schema type should be Person');
  assert(schema.name === 'Albert Einstein', `name should be Einstein, got ${schema.name}`);
})();

await test('Knowledge graph links are rendered', async () => {
  assert(content.innerHTML.includes('Wikidata') || content.innerHTML.includes('wikidata.org'), 'should have Wikidata link');
})();

await test('Attribution is shown (CC BY-SA 4.0)', async () => {
  assert(content.innerHTML.includes('CC BY-SA 4.0') || content.innerHTML.includes('wikipedia.org'), 'should show attribution');
})();

await test('Page title is updated', async () => {
  assert(window.document.title.includes('Albert Einstein'), `title should be Einstein, got: ${window.document.title}`);
})();

// Test with 404 (unknown slug)
const dom2 = new JSDOM(HTML, {
  url: 'http://localhost:9876/person/thisdoesnotexistxyz/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
dom2.window.fetch = async (url) => {
  if (url.includes('/api/v1/')) {
    return { ok: false, status: 404, json: async () => ({ error: 'Person not found' }) };
  }
  if (url.includes('persons.json')) {
    // persons.json exists but doesn't have this slug
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync('/tmp/test-otd/persons.json', 'utf-8')) };
  }
  return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
};
const s2 = dom2.window.document.createElement('script');
s2.textContent = JS;
dom2.window.document.body.appendChild(s2);
await new Promise(r => setTimeout(r, 1500));

await test('404 shows error state', async () => {
  const c2 = dom2.window.document.querySelector('#prs-content');
  assert(c2.innerHTML.includes('Person not found') || c2.innerHTML.includes('not found'), `should show error state, got: ${c2.innerHTML.slice(0, 200)}`);
})();

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---\n`);
if (fail > 0) process.exit(1);
