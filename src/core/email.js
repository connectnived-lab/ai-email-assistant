// Email assistant core: thread parsing, summaries, intents, next actions and drafts. No DOM.
import { normalizeWhitespace, splitSentences, extractiveSummary, parseJsonLoose, clip } from './text.js';

export const TONES = ['friendly', 'formal', 'short'];

const INTENTS = [
  ['question', /\?/],
  ['meeting', /\b(meet|meeting|call|schedule|calendar|availability|slot|catch up|free on)\b/i],
  ['thanks', /\b(thanks|thank you|appreciate)\b/i],
  ['complaint', /\b(not working|broken|disappointed|refund|problem|issue|delayed?|unhappy|frustrat\w*)\b/i],
  ['request', /\b(please|could you|can you|would you|kindly|need you to|send me)\b/i],
  ['attachment', /\b(attached|attachment|enclosed|pdf|invoice|spreadsheet)\b/i],
  ['deadline', /\b(deadline|due|by (?:mon|tue|wed|thu|fri|sat|sun)\w*|by (?:eod|tomorrow|end of)\b)/i],
  ['confirm', /\b(confirm|confirmation|let me know|reply with|rsvp)\b/i],
];

export function parseThread(raw) {
  const text = normalizeWhitespace(raw);
  if (!text) return [];
  const messages = [];
  let cur = null;
  const open = (from) => {
    cur = { from, lines: [] };
    messages.push(cur);
  };
  open(null);
  for (const line of text.split('\n')) {
    const t = line.trim();
    const from = t.match(/^From:\s*(.+)$/i);
    if (from) {
      open(from[1].replace(/<[^>]*>/g, '').replace(/"/g, '').trim() || null);
      continue;
    }
    if (/^On .+ wrote:$/i.test(t) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) {
      open(null);
      continue;
    }
    if (/^(Sent|To|Subject|Date|Cc):/i.test(t) || t.startsWith('>') || !t) continue;
    cur.lines.push(t);
  }
  return messages
    .map((m) => ({ from: m.from, body: m.lines.join(' ').trim() }))
    .filter((m) => m.body);
}

export function detectIntents(text) {
  const found = [];
  for (const [name, re] of INTENTS) if (re.test(text)) found.push(name);
  return found;
}

export function questionsIn(text) {
  return splitSentences(text).filter((s) => s.endsWith('?'));
}

export function deadlinesIn(text) {
  const re = /\b(?:by|before|due)\s+((?:next\s+)?(?:mon|tue|wed|thu|fri|sat|sun)\w*|tomorrow|today|eod|end of (?:the )?(?:day|week)|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/gi;
  return [...new Set([...text.matchAll(re)].map((m) => m[1].trim()))];
}

export function analyzeThread(raw, { tone = 'friendly', name = '' } = {}) {
  const messages = parseThread(raw);
  if (messages.length === 0) throw new Error('Paste an email or a thread first.');
  const all = messages.map((m) => m.body).join(' ');
  const intents = detectIntents(all);
  const questions = questionsIn(all);
  const deadlines = deadlinesIn(all);
  const latest = messages[0];
  return {
    messages,
    participants: [...new Set(messages.map((m) => m.from).filter(Boolean))],
    summary: extractiveSummary(all, 3),
    perMessage: messages.map((m) => ({ from: m.from || 'Unknown sender', line: clip(splitSentences(m.body)[0] || m.body, 140) })),
    intents,
    questions,
    deadlines,
    actions: suggestActions({ intents, questions, deadlines }),
    draft: draftReply({ latest, intents, questions, tone, name }),
    tone: TONES.includes(tone) ? tone : 'friendly',
    source: 'demo',
  };
}

export function suggestActions({ intents = [], questions = [], deadlines = [] }) {
  const out = [];
  for (const q of questions.slice(0, 3)) out.push(`Answer: "${clip(q, 90)}"`);
  if (intents.includes('meeting')) out.push('Offer two times or confirm a slot');
  if (intents.includes('attachment')) out.push('Open the attachment before you reply');
  for (const d of deadlines.slice(0, 2)) out.push(`Note the deadline: ${d}`);
  if (intents.includes('complaint')) out.push('Acknowledge the problem and say what happens next');
  if (intents.includes('request') && !questions.length) out.push('Reply with a yes, a no or a date for the request');
  if (intents.includes('confirm')) out.push('Confirm or decline, as they asked');
  if (out.length === 0) out.push('Send a short acknowledgement');
  return [...new Set(out)].slice(0, 5);
}

const greeting = (first, tone) => (tone === 'formal' ? `Dear ${first},` : `Hi ${first},`);
const closing = (name, tone) => {
  const who = name || '[your name]';
  if (tone === 'formal') return `Kind regards,\n${who}`;
  if (tone === 'short') return who;
  return `Thanks,\n${who}`;
};

export function draftReply({ latest, intents = [], questions = [], tone = 'friendly', name = '' }) {
  const fromName = latest && latest.from ? latest.from.split(' ')[0] : '';
  const first = fromName || 'there';
  const lines = [];
  if (questions.length) {
    lines.push(`Thanks for the question${questions.length > 1 ? 's' : ''}. ${questions.map((q) => `On "${clip(q, 70)}": [your answer here].`).join(' ')}`);
  }
  if (intents.includes('meeting')) lines.push('Would a time on [day, time] or [alternative time] work for you?');
  if (intents.includes('complaint')) lines.push("I'm sorry about this. I'm looking into it and will update you by [date].");
  if (intents.includes('request') && !questions.length) lines.push("I'll take care of this and get back to you by [date].");
  if (intents.includes('attachment')) lines.push("Thanks for the attachment. I'll review it and come back to you.");
  if (intents.includes('thanks') && lines.length === 0) lines.push("You're welcome.");
  if (lines.length === 0) lines.push('Thanks for your message. [your reply here]');
  const body = tone === 'short' ? lines.map((l) => l.split('. ')[0].replace(/\.?$/, '.')).join(' ') : lines.join('\n\n');
  return `${greeting(first, tone)}\n\n${body}\n\n${closing(name.trim(), tone)}`;
}

export function buildLivePrompt(raw, { tone = 'friendly', name = '' } = {}) {
  const thread = normalizeWhitespace(raw);
  if (!thread) throw new Error('Paste an email or a thread first.');
  return [
    {
      role: 'system',
      content: `You help with email. Read the thread (newest message first). Write a ${tone} reply to the newest message ` +
        `for the sender ${name ? `to sign as ${name}` : ''}. Use only facts in the thread and leave [placeholders] where you need a fact you do not have. ` +
        'Also list up to five next actions. Reply with JSON only: {"reply": string, "actions": string[]}.',
    },
    { role: 'user', content: thread },
  ];
}

export function parseLiveReply(raw) {
  const data = parseJsonLoose(raw);
  if (!data || typeof data !== 'object' || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error('The model answer had no reply in it.');
  }
  const actions = Array.isArray(data.actions) ? data.actions.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()).slice(0, 5) : [];
  return { reply: data.reply.trim(), actions };
}
