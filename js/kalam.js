// ============================================================
// KALAM — AI History Guide (RAG-ready architecture)
// Game -> askKalam -> Retriever -> KnowledgeBase -> (LLM later)
// -> age-appropriate explanation. Works fully OFFLINE via
// local fallback KB; plug an API key in later without
// changing any caller.
// ============================================================
import { KALAM_KB } from './data.js';

// Optional future wiring: set window.BQ_LLM_ENDPOINT + BQ_API_KEY
// and implement fetch there. Interface stays identical.
const LLM_ENDPOINT = null; // e.g. "https://api.example.com/v1/chat"

function retrieve(question) {
  const q = question.toLowerCase();
  let best = null, bestScore = 0;
  for (const entry of KALAM_KB) {
    let score = 0;
    for (const k of entry.keys) if (q.includes(k)) score += k.length;
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return best;
}

/**
 * getHistoricalAnswer(question, context) — clean RAG interface.
 * @param {string} question  player question
 * @param {object} context   { levelId, levelName, era }
 * @returns {Promise<string>} age-appropriate answer (9–15)
 */
export async function getHistoricalAnswer(question, context = {}) {
  const q = (question || '').trim();
  if (!q) return 'Ask me anything about history — drains, temples, scrolls, forts or freedom!';
  // 1) Future: try remote LLM if configured (graceful fallback on failure)
  if (LLM_ENDPOINT && window.BQ_API_KEY) {
    try {
      const res = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.BQ_API_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are Kalam, a friendly history guide for ages 9-15. Context: ${context.era || ''}. Keep answers under 60 words, simple language, historically careful.` },
            { role: 'user', content: q }
          ]
        })
      });
      const data = await res.json();
      const txt = data?.choices?.[0]?.message?.content;
      if (txt) return txt.slice(0, 500);
    } catch { /* fall through to local KB */ }
  }
  // 2) Local retriever + knowledge base (offline, always works)
  const hit = retrieve(q);
  if (hit) return '🤖 ' + hit.answer;
  const eraHints = {
    1: 'Look around this planned city — its drains, bricks and Great Bath each hide a story. Try asking about drains or seals!',
    2: 'Nalanda was a great university. Ask me about scholars, the library or the stars!',
    3: 'The Cholas raised mighty temples. Ask me about temples or Rajaraja!',
    4: 'This fort guards many secrets. Ask me about Shah Jahan or the Taj Mahal!',
    5: 'The Final Chamber tests all four eras! Ask me about drains, Nalanda, temples or forts!'
  };
  return `🤖 Wonderful question! ${eraHints[context.levelId] || 'Indian history is full of wonders — try asking about drains, Nalanda, temples, forts or freedom!'}`;
}
