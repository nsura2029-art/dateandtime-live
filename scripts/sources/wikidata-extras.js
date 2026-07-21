/**
 * Wikidata Extras: Divorces, Anniversaries, Periodic events
 *
 * Per Blueprint Ch 5 + Ch 6 (4 SPARQL recipes):
 *   - Divorces: P26 with end-time qualifier (P580 end date)
 *   - Anniversaries: P571 (inception), P577 (publication), P1619 (date)
 *
 * Output: content/otd/{divorces,anniversaries}.json
 *
 * Source: Blueprint Ch 5
 */

const wikidata = require('./wikidata');

/**
 * Fetch notable divorces on a (month, day).
 * Uses P26 spouse + P580 end-time.
 * @param {number} month
 * @param {number} day
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function fetchDivorcesForDay(month, day, opts = {}) {
  const limit = opts.limit || 50;
  const minSitelinks = opts.minSitelinks || 20;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX p: <http://www.wikidata.org/prop/>
    PREFIX ps: <http://www.wikidata.org/prop/statement/>
    PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    SELECT ?person ?personLabel ?spouse ?spouseLabel ?divorceDate ?image ?sitelinks WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P26 ?spouse .
      ?person p:P26 ?stmt .
      ?stmt ps:P26 ?spouse .
      ?stmt pq:P582 ?divorceDate .
      FILTER (MONTH(?divorceDate) = ${month} && DAY(?divorceDate) = ${day})
      FILTER (?person != ?spouse)
      ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
      OPTIONAL { ?spouse rdfs:label ?spouseLabel . FILTER(LANG(?spouseLabel) = "en") }
      ?person wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
      OPTIONAL { ?person wdt:P18 ?image . }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await wikidata.query(sparql, { endpoint: 'qlever' });
  const bindings = data.results?.bindings || [];
  return bindings.map(b => ({
    wikidata_id: b.person?.value?.replace('http://www.wikidata.org/entity/', ''),
    entity2_id: b.spouse?.value?.replace('http://www.wikidata.org/entity/', ''),
    entity2_name: b.spouseLabel?.value,
    title: b.personLabel?.value,
    couple_id: [b.person?.value, b.spouse?.value]
      .map(s => s?.replace('http://www.wikidata.org/entity/', ''))
      .sort()
      .join('-'),
    divorce_date: b.divorceDate?.value?.split('T')[0],
    image_url: b.image?.value ? wikidata.convertImageUrl(b.image.value) : null,
    sitelinks: parseInt(b.sitelinks?.value || '0', 10),
    type: 'divorce',
    data_sources: JSON.stringify([{
      name: 'wikidata_qlever',
      url: 'https://qlever.dev/api/wikidata',
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'CC0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution_required: 0
    }])
  }));
}

/**
 * Fetch notable anniversaries on a (month, day).
 * P571 (inception for orgs/places), P577 (publication for works), P1619 (date)
 */
async function fetchAnniversariesForDay(month, day, opts = {}) {
  const limit = opts.limit || 30;
  const minSitelinks = opts.minSitelinks || 50;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    SELECT ?item ?itemLabel ?date ?inceptionType ?image ?sitelinks WHERE {
      {
        ?item wdt:P571 ?date .
        BIND("inception" AS ?inceptionType)
      } UNION {
        ?item wdt:P577 ?date .
        BIND("publication" AS ?inceptionType)
      }
      FILTER (MONTH(?date) = ${month} && DAY(?date) = ${day})
      ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
      ?item wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
      OPTIONAL { ?item wdt:P18 ?image . }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await wikidata.query(sparql, { endpoint: 'qlever' });
  const bindings = data.results?.bindings || [];
  return bindings.map(b => ({
    wikidata_id: b.item?.value?.replace('http://www.wikidata.org/entity/', ''),
    title: b.itemLabel?.value,
    date: b.date?.value?.split('T')[0],
    year: b.date?.value ? parseInt(b.date.value.split('-')[0], 10) : null,
    inception_type: b.inceptionType?.value,
    image_url: b.image?.value ? wikidata.convertImageUrl(b.image.value) : null,
    sitelinks: parseInt(b.sitelinks?.value || '0', 10),
    type: 'anniversary',
    data_sources: JSON.stringify([{
      name: 'wikidata_qlever',
      url: 'https://qlever.dev/api/wikidata',
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'CC0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution_required: 0
    }])
  }));
}

module.exports = {
  fetchDivorcesForDay,
  fetchAnniversariesForDay
};
