import { analyzeThread, buildLivePrompt, parseLiveReply, parseThread, suggestActions, detectIntents, questionsIn, deadlinesIn, draftReply } from './core/email.js';
import { createLLMClient } from './core/llm.js';
import { isLive } from './core/settings.js';
import { escapeHtml } from './core/text.js';
import { initSettings } from './ui/settings-panel.js';

const SETTINGS_KEY = 'ai-email-assistant:settings';
const SAMPLE = `From: Anita Rao <anita@client.co>
Subject: Re: Proposal for Q4 rollout
Thanks for the proposal, it looks solid. Could you confirm the pricing for 50 seats and whether onboarding is included?
Also, are you free for a call on Thursday to walk the team through it?
I've attached our revised requirements, please take a look before we meet.

On Mon, 3 Nov, Ravi wrote:
> Hi Anita, here is the proposal for the Q4 rollout. Let me know if anything is unclear.`;

const $ = (id) => document.getElementById(id);
const settings = initSettings({ storageKey: SETTINGS_KEY });

function setError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

function list(items, empty) {
  if (!items.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<ul class="list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function paint({ summary, perMessage, actions, intents, source }) {
  $('output').innerHTML =
    `<div class="stats"><span class="stat">${escapeHtml(source === 'model' ? 'Live model' : 'Demo mode')}</span>` +
    intents.map((i) => `<span class="stat">${escapeHtml(i)}</span>`).join('') + '</div>' +
    '<h3 style="font-size:1rem;margin:14px 0 4px">Summary</h3>' + list(summary, 'Nothing to summarise.') +
    '<h3 style="font-size:1rem;margin:14px 0 4px">Thread</h3>' +
    perMessage.map((m) => `<div class="item"><strong>${escapeHtml(m.from)}</strong><div class="meta">${escapeHtml(m.line)}</div></div>`).join('') +
    '<h3 style="font-size:1rem;margin:14px 0 4px">Next actions</h3>' + list(actions, 'No actions suggested.');
}

async function analyze() {
  setError('');
  const raw = $('thread').value;
  const tone = $('tone').value;
  const name = $('name').value.trim();
  const cfg = settings.get();
  const button = $('analyze');
  try {
    if (isLive(cfg)) {
      button.disabled = true;
      button.textContent = 'Working…';
      const client = createLLMClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model });
      const reply = parseLiveReply(await client.chat(buildLivePrompt(raw, { tone, name }), { temperature: 0.3 }));
      const messages = parseThread(raw);
      const all = messages.map((m) => m.body).join(' ');
      paint({
        summary: [reply.reply.split('\n')[0].slice(0, 220)],
        perMessage: messages.map((m) => ({ from: m.from || 'Unknown sender', line: m.body.slice(0, 140) })),
        actions: reply.actions.length ? reply.actions : suggestActions({ intents: detectIntents(all), questions: questionsIn(all), deadlines: deadlinesIn(all) }),
        intents: detectIntents(all),
        source: 'model',
      });
      $('draft').value = reply.reply;
    } else {
      const r = analyzeThread(raw, { tone, name });
      paint({ summary: r.summary, perMessage: r.perMessage, actions: r.actions, intents: r.intents, source: 'demo' });
      $('draft').value = r.draft;
    }
    $('copy').disabled = false;
  } catch (err) {
    setError(err.message || 'Something went wrong.');
  } finally {
    button.disabled = false;
    button.textContent = 'Analyse and draft';
  }
}

$('analyze').addEventListener('click', analyze);
$('sample').addEventListener('click', () => {
  $('thread').value = SAMPLE;
  $('name').value = 'Nived';
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('draft').value);
    $('status').textContent = 'Draft copied.';
  } catch (_) {
    $('draft').select();
    $('status').textContent = 'Select the draft and copy it yourself.';
  }
});
