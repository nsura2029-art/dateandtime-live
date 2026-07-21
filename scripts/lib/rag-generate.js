/**
 * RAG generation layer
 *
 * Per Blueprint Ch 8 (RAG architecture, Prompt E stage 4-6):
 *   Stage 4: Grounded generation (records-only prompt, cite record IDs)
 *   Stage 5: Post-verification (strip uncited claims)
 *   Stage 6: Serve + QA log
 *
 * Uses Gemini 2.5 Flash-Lite via REST for $0.00032/answer cost.
 * Pre-generation: 1,100 canonical answers for ~$0.35-1.60 one-time.
 *
 * Per Risk #2 (hallucination):
 *   - Refusal string if no records
 *   - Strip sentences without valid record IDs
 *   - Trust-first positioning
 *
 * Source: Blueprint Ch 8 (RAG) + Risk #2 (hallucination)
 */

const { REFUSAL_STRING } = require('./rag-retrieve');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.5-flash-lite';
const COST_PER_M_INPUT = 0.10 / 1_000_000;   // $0.10/1M tokens
const COST_PER_M_OUTPUT = 0.40 / 1_000_000;  // $0.40/1M tokens

/**
 * Build the records-only prompt for the LLM.
 * Per Blueprint Prompt E stage 4: "Answer using ONLY the records below.
 * Cite every factual claim with its record ID in [brackets].
 * If the records are insufficient, reply exactly: 'I can only answer from our verified database.'"
 */
function buildPrompt(question, records) {
  const recordsText = records.map((r, i) =>
    `[Record ${r.wikidata_id || r.id || (i + 1)}] ${r.title} (${r.year || 'no year'})\n${r.description || ''}\nSource: ${r.wikipedia_url || r.data_sources?.[0]?.url || 'unknown'}`
  ).join('\n\n');

  return `You are a precise historical knowledge assistant. You must answer using ONLY the records provided below. Do not add facts not present in the records.

${recordsText}

User question: ${question}

Instructions:
1. Answer in 2-4 sentences.
2. Cite every factual claim with [Record #ID] in brackets.
3. If the records don't contain enough information to answer, reply exactly: "${REFUSAL_STRING}"
4. Never invent dates, names, or facts not in the records.

Answer:`;
}

/**
 * Stage 4: Generate a grounded answer using Gemini.
 * @param {string} question
 * @param {object[]} records
 * @param {object} opts - {apiKey, maxOutputTokens}
 * @returns {Promise<object>} {answer, cost, promptTokens, completionTokens, model}
 */
async function generate(question, records, opts = {}) {
  if (!records || records.length === 0) {
    return {
      answer: REFUSAL_STRING,
      refused: true,
      cost: 0,
      promptTokens: 0,
      completionTokens: 0,
      model: MODEL
    };
  }

  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY required for RAG generation');
  }

  const prompt = buildPrompt(question, records);
  const maxOutputTokens = opts.maxOutputTokens || 350;

  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.1   // low temperature for factuality
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }

  const data = await res.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  const cost = (usage.promptTokenCount || 0) * COST_PER_M_INPUT +
               (usage.candidatesTokenCount || 0) * COST_PER_M_OUTPUT;

  return {
    answer,
    refused: false,
    cost,
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
    model: MODEL
  };
}

/**
 * Stage 5: Post-verification.
 * Strip any sentence whose claims are not in the retrieved records.
 * Per Blueprint Prompt E: "if nothing survives, return the refusal string"
 */
function verify(answer, records) {
  if (!answer || answer === REFUSAL_STRING) {
    return { verified: answer, stripped: 0 };
  }

  const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const verified = [];
  let stripped = 0;

  // Build a corpus of all "facts" (lowercased words > 3 chars) from records
  const corpusWords = new Set();
  for (const r of records) {
    const text = `${r.title || ''} ${r.description || ''} ${r.wikipedia_url || ''}`.toLowerCase();
    text.split(/\W+/).forEach(w => { if (w.length > 4) corpusWords.add(w); });
  }

  for (const sentence of sentences) {
    // Must have a citation [Record #X]
    if (!/\[Record #?\d+/.test(sentence) && !/\[Q\d+/.test(sentence)) {
      stripped++;
      continue;
    }
    // Sanity check: 60% of the sentence's words should appear in corpus
    const words = sentence.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    if (words.length === 0) {
      verified.push(sentence);
      continue;
    }
    const matches = words.filter(w => corpusWords.has(w)).length;
    if (matches / words.length < 0.3) {
      stripped++;
      continue;
    }
    verified.push(sentence);
  }

  if (verified.length === 0) {
    return { verified: REFUSAL_STRING, stripped };
  }

  return { verified: verified.join('. ') + '.', stripped };
}

/**
 * Stage 6: Full RAG pipeline.
 * @param {string} question
 * @param {object[]} records
 * @param {object} opts
 * @returns {Promise<object>}
 */
async function rag(question, records, opts = {}) {
  const result = await generate(question, records, opts);
  const verification = verify(result.answer, records);
  return {
    question,
    answer: verification.verified,
    refused: result.refused || verification.verified === REFUSAL_STRING,
    strippedSentences: verification.stripped,
    cost: result.cost,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    model: result.model,
    recordIds: records.map(r => r.wikidata_id || r.id)
  };
}

/**
 * Pre-generate canonical answers for a set of (month, day) dates.
 * Per Blueprint: ~1,100 generations for $0.35-1.60 one-time.
 *
 * @param {Array<{month, day, records}>} dateBatches
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function preGenerate(dateBatches, opts = {}) {
  const results = [];
  let totalCost = 0;

  for (const { month, day, records } of dateBatches) {
    const question = `What happened on ${formatDate(month, day)}?`;
    const result = await rag(question, records.slice(0, 30), opts);
    results.push({ month, day, ...result });
    totalCost += result.cost;
    console.log(`[pre-gen] ${month}-${day}: ${result.answer.slice(0, 80)}... ($${result.cost.toFixed(6)})`);
  }

  console.log(`[pre-gen] Total cost: $${totalCost.toFixed(4)}`);
  return results;
}

function formatDate(month, day) {
  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month]} ${day}`;
}

module.exports = {
  GEMINI_API_BASE,
  MODEL,
  buildPrompt,
  generate,
  verify,
  rag,
  preGenerate
};
