// Pure text helpers shared by the core logic. No DOM access.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function normalizeWhitespace(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitSentences(text) {
  const flat = normalizeWhitespace(text).replace(/\n+/g, ' ');
  if (!flat) return [];
  return flat
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that', 'these', 'those', 'i', 'we', 'you',
  'he', 'she', 'they', 'my', 'our', 'your', 'as', 'if', 'so', 'not', 'no', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'should', 'have', 'has', 'had', 'about', 'into', 'than', 'then',
  'there', 'their', 'its', 'just', 'also', 'me', 'us', 'them', 'what', 'which', 'who', 'how', 'all',
]);

export function isStopword(word) {
  return STOP.has(String(word).toLowerCase());
}

export function tokenize(text) {
  return (String(text ?? '').toLowerCase().match(/[a-z0-9']+/g) || [])
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function wordFrequencies(text) {
  const freq = new Map();
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1);
  return freq;
}

// Score each sentence by the average document frequency of its content words.
export function scoreSentences(sentences) {
  const freq = wordFrequencies(sentences.join(' '));
  return sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const total = words.reduce((sum, w) => sum + (freq.get(w) || 0), 0);
    const score = words.length ? total / words.length : 0;
    return { index, sentence, score };
  });
}

// Pick the n best sentences, returned in their original order.
export function extractiveSummary(text, n = 3) {
  const sentences = splitSentences(text);
  if (sentences.length <= n) return sentences;
  const best = scoreSentences(sentences)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, n)
    .sort((a, b) => a.index - b.index);
  return best.map((b) => b.sentence);
}

// Parse JSON that a model may have wrapped in code fences or prose.
export function parseJsonLoose(raw) {
  const text = String(raw ?? '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced ? fenced[1] : text];
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const starts = [firstObj, firstArr].filter((i) => i >= 0).sort((a, b) => a - b);
  for (const start of starts) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    const end = text.lastIndexOf(close);
    if (end > start) candidates.push(text.slice(start, end + 1));
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch (_) {
      /* try the next candidate */
    }
  }
  throw new Error('The model answer was not valid JSON.');
}

export function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function clip(text, max = 120) {
  const t = String(text ?? '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}
