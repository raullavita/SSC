/**
 * Smart reply suggestions — Ollama (local LLM) with rule-based fallback — Engine 12.
 * Privacy: calls Ollama on the user's machine only; SSC server never sees plaintext.
 * @see https://github.com/ollama/ollama
 */

const OLLAMA_URL = process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.REACT_APP_OLLAMA_MODEL || 'llama3.2';

const RULE_REPLIES = [
  'Sounds good!',
  'On my way.',
  'Let me check and get back to you.',
  'Thanks!',
  'Can we talk later?',
];

function ruleBasedReplies(lastText) {
  const t = (lastText || '').toLowerCase();
  if (t.includes('?')) return ['Yes', 'No', 'Maybe later', 'Let me think'];
  if (t.includes('thank')) return ['You\'re welcome!', 'Anytime', 'No problem'];
  if (t.includes('hello') || t.includes('hi ')) return ['Hey!', 'Hello!', 'Hi there'];
  return RULE_REPLIES.slice(0, 3);
}

export async function suggestReplies({ lastMessages = [], peerName = 'them' } = {}) {
  const context = lastMessages
    .slice(-6)
    .map((m) => `${m.sender_id}: ${m.text}`)
    .join('\n');
  const last = lastMessages[lastMessages.length - 1]?.text || '';

  try {
    const prompt = `You are a helpful chat assistant. Suggest exactly 3 short reply options (under 8 words each) for the user to send in a private encrypted chat with ${peerName}. Return ONLY a JSON array of 3 strings, no explanation.\n\nRecent messages:\n${context}`;

    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 120 },
      }),
    });

    if (!resp.ok) throw new Error('ollama_unavailable');

    const data = await resp.json();
    const raw = (data.response || '').trim();
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.slice(0, 3).map(String);
      }
    }
  } catch {
    /* fall through to rules */
  }

  return ruleBasedReplies(last);
}