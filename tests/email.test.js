import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/core/email.js';

const THREAD = `From: Anita Rao <anita@client.co>
Subject: Re: Proposal
Could you confirm the pricing for 50 seats?
Are you free for a call on Thursday?

On Mon, 3 Nov, Ravi wrote:
> Here is the proposal.

From: Ravi <ravi@us.test>
Here is the proposal, let me know if anything is unclear.`;

test('parseThread splits on From lines and drops quoted text', () => {
  const m = E.parseThread(THREAD);
  assert.equal(m.length, 2);
  assert.equal(m[0].from, 'Anita Rao');
  assert.ok(!m[0].body.includes('Here is the proposal.'));
});
test('parseThread strips the email address from the sender', () => {
  assert.equal(E.parseThread('From: Dana <dana@x.test>\nHello there.')[0].from, 'Dana');
});
test('parseThread drops header lines such as Subject and Sent', () => {
  const m = E.parseThread('Subject: Hi\nSent: today\nHello team, the report is ready.');
  assert.equal(m[0].body, 'Hello team, the report is ready.');
});
test('parseThread returns nothing for blank input', () => {
  assert.deepEqual(E.parseThread('   '), []);
});
test('detectIntents finds questions, meetings, attachments and deadlines', () => {
  const i = E.detectIntents('Can you send the invoice? Are you free for a call by Friday?');
  for (const k of ['question', 'meeting', 'attachment', 'deadline', 'request']) assert.ok(i.includes(k), k);
});
test('detectIntents finds complaints and thanks', () => {
  assert.ok(E.detectIntents('The app is not working, very disappointed.').includes('complaint'));
  assert.ok(E.detectIntents('Thank you so much!').includes('thanks'));
});
test('detectIntents returns an empty list for neutral text', () => {
  assert.deepEqual(E.detectIntents('The weather is mild this week.'), []);
});
test('questionsIn returns sentences that end with a question mark', () => {
  assert.deepEqual(E.questionsIn('Done. Is it ready? Yes.'), ['Is it ready?']);
});
test('deadlinesIn reads weekday, EOD and day-month phrases', () => {
  assert.deepEqual(E.deadlinesIn('Please send it by Friday.'), ['Friday']);
  assert.deepEqual(E.deadlinesIn('Need this by EOD and due 14 Nov'), ['EOD', '14 Nov']);
  assert.deepEqual(E.deadlinesIn('no date here'), []);
});
test('suggestActions turns questions and meetings into concrete steps', () => {
  const a = E.suggestActions({ intents: ['meeting'], questions: ['Pricing for 50 seats?'], deadlines: [] });
  assert.equal(a[0], 'Answer: "Pricing for 50 seats?"');
  assert.ok(a.includes('Offer two times or confirm a slot'));
});
test('suggestActions falls back to an acknowledgement', () => {
  assert.deepEqual(E.suggestActions({}), ['Send a short acknowledgement']);
});
test('suggestActions caps the list at five items', () => {
  const a = E.suggestActions({ intents: ['meeting', 'attachment', 'complaint', 'confirm'], questions: ['a?', 'b?', 'c?', 'd?'], deadlines: ['Friday', 'EOD'] });
  assert.ok(a.length <= 5);
});
test('draftReply greets the sender by first name and signs with the given name', () => {
  const d = E.draftReply({ latest: { from: 'Anita Rao', body: 'Q?' }, intents: ['question'], questions: ['Q?'], tone: 'friendly', name: 'Nived' });
  assert.match(d, /^Hi Anita,/);
  assert.match(d, /Thanks,\nNived$/);
  assert.match(d, /\[your answer here\]/);
});
test('draftReply uses a formal greeting and sign-off', () => {
  const d = E.draftReply({ latest: { from: 'Ravi K', body: 'x' }, intents: [], tone: 'formal', name: 'Nived' });
  assert.match(d, /^Dear Ravi,/);
  assert.match(d, /Kind regards,\nNived$/);
});
test('draftReply falls back to a neutral greeting with no sender', () => {
  const d = E.draftReply({ latest: { from: null, body: 'x' }, intents: [], tone: 'friendly' });
  assert.match(d, /^Hi there,/);
  assert.match(d, /\[your name\]/);
});
test('draftReply acknowledges a complaint with a placeholder date', () => {
  const d = E.draftReply({ latest: { from: 'Kim', body: 'x' }, intents: ['complaint'], tone: 'friendly', name: 'N' });
  assert.match(d, /sorry about this/);
  assert.match(d, /\[date\]/);
});
test('draftReply offers placeholder times for a meeting request', () => {
  const d = E.draftReply({ latest: { from: 'Kim', body: 'x' }, intents: ['meeting'], tone: 'friendly', name: 'N' });
  assert.match(d, /\[day, time\]/);
});
test('analyzeThread returns summary, actions and a draft for a thread', () => {
  const r = E.analyzeThread(THREAD, { tone: 'friendly', name: 'Nived' });
  assert.ok(r.summary.length >= 1);
  assert.deepEqual(r.participants, ['Anita Rao', 'Ravi']);
  assert.ok(r.actions.length >= 1);
  assert.match(r.draft, /Hi Anita/);
  assert.equal(r.source, 'demo');
});
test('analyzeThread refuses empty input', () => {
  assert.throws(() => E.analyzeThread('  '), /Paste an email/);
});
test('analyzeThread falls back to friendly for an unknown tone', () => {
  assert.equal(E.analyzeThread(THREAD, { tone: 'pirate' }).tone, 'friendly');
});
test('buildLivePrompt asks for JSON with a reply and actions', () => {
  const msgs = E.buildLivePrompt(THREAD, { tone: 'formal', name: 'Nived' });
  assert.match(msgs[0].content, /"reply"/);
  assert.match(msgs[0].content, /formal/);
  assert.match(msgs[1].content, /Anita/);
});
test('buildLivePrompt refuses empty input', () => {
  assert.throws(() => E.buildLivePrompt(''), /Paste an email/);
});
test('parseLiveReply reads reply and trims actions', () => {
  const r = E.parseLiveReply('{"reply":"Hi there","actions":["Check pricing", 3, ""]}');
  assert.equal(r.reply, 'Hi there');
  assert.deepEqual(r.actions, ['Check pricing']);
});
test('parseLiveReply rejects an answer with no reply', () => {
  assert.throws(() => E.parseLiveReply('{"actions":[]}'), /no reply/);
  assert.throws(() => E.parseLiveReply('not json'), /not valid JSON/);
});
