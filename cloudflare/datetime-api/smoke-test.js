#!/usr/bin/env node
/**
 * Live API smoke test — call each endpoint, print full response, verify shape.
 * Run: node cloudflare/datetime-api/smoke-test.js
 */

const env = {
  OTD_DATES_DIR: '/tmp/test-otd/dates',
  OTD_WEDDINGS_DIR: '/tmp/test-otd/weddings',
  OTD_PERSONS_FILE: '/tmp/test-otd/persons.json'
};

import { handle as personRoutes } from './routes/person.js';
import { handle as eventRoutes } from './routes/event.js';
import { handle as timeMultiRoutes } from './routes/time-multi.js';

const REQ = (path) => ({ url: `https://api.dateandtime.live${path}`, method: 'GET' });

async function callAndShow(label, routes, fullPath) {
  console.log(`\n=== ${label} ===`);
  console.log(`GET ${fullPath}`);
  // Route modules expect just the pathname (no query) as second arg,
  // and the full URL on the request so they can read searchParams
  const pathname = fullPath.split('?')[0];
  const resp = await routes(env, pathname, REQ(fullPath));
  if (!resp) {
    console.log('  → no route match (null)');
    return;
  }
  const data = await resp.json().catch(() => null);
  console.log(`  → status ${resp.status}`);
  if (data) {
    const summary = summarize(data);
    console.log(JSON.stringify(summary, null, 2).slice(0, 800));
    if (JSON.stringify(summary, null, 2).length > 800) {
      console.log('...');
    }
  }
}

function summarize(obj, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) return '...';
  if (Array.isArray(obj)) {
    return `[Array of ${obj.length}]`;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === null) out[k] = null;
      else if (v === undefined) out[k] = 'undefined';
      else if (Array.isArray(v)) out[k] = `[Array of ${v.length}]`;
      else if (typeof v === 'object') out[k] = summarize(v, depth + 1, maxDepth);
      else if (typeof v === 'string' && v.length > 60) out[k] = v.slice(0, 60) + '...';
      else out[k] = v;
    }
    return out;
  }
  return obj;
}

async function main() {
  console.log('===========================================');
  console.log(' Date-Time API — Live Smoke Test');
  console.log('===========================================');

  await callAndShow('Person: Q-ID lookup', personRoutes, '/api/v1/person/Q937');
  await callAndShow('Person: slug lookup', personRoutes, '/api/v1/person/einstein');
  await callAndShow('Person: born on date', personRoutes, '/api/v1/person/born/7-19');
  await callAndShow("Person: today's birthdays", personRoutes, '/api/v1/person/today?date=7-19&limit=3');
  await callAndShow('Person: onthisday for entity', personRoutes, '/api/v1/person/Q11631/onthisday');

  await callAndShow('Event: Q-ID lookup', eventRoutes, '/api/v1/onthisday/event/Q11631');
  await callAndShow('Event: year-title slug', eventRoutes, '/api/v1/onthisday/event/1969-apollo-11');
  await callAndShow('Event: related events', eventRoutes, '/api/v1/onthisday/event/Q11631/related');

  await callAndShow('Time: multi-time by IDs', timeMultiRoutes, '/api/v1/time/now/multi?ids=5128581,2643743,1850147');
  await callAndShow('Time: multi-time by timezones', timeMultiRoutes, '/api/v1/time/now/multi?timezones=America/New_York,Asia/Tokyo');
  await callAndShow('Today snapshot', timeMultiRoutes, '/api/v1/snapshot?country=US&city=5128581');

  console.log('\n===========================================');
  console.log(' Done');
  console.log('===========================================');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
