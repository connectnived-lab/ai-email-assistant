import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/core/text.js';

test('escapeHtml escapes the five dangerous characters', () => {
  assert.equal(T.escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('escapeHtml handles null and numbers', () => {
  assert.equal(T.escapeHtml(null), '');
  assert.equal(T.escapeHtml(42), '42');
});
test('normalizeWhitespace collapses spaces and blank lines', () => {
  assert.equal(T.normalizeWhitespace('  a   b \r\n\r\n\r\n\r\nc  '), 'a b\n\nc');
});
test('splitSentences splits on terminal punctuation followed by a capital', () => {
  assert.deepEqual(T.splitSentences('One thing. Two thing! Three?'), ['One thing.', 'Two thing!', 'Three?']);
});
test('splitSentences returns an empty list for blank input', () => {
  assert.deepEqual(T.splitSentences('   \n  '), []);
});
test('tokenize drops stopwords and single letters', () => {
  assert.deepEqual(T.tokenize('The quick a fox is in the box'), ['quick', 'fox', 'box']);
});
test('isStopword recognises common stopwords case-insensitively', () => {
  assert.equal(T.isStopword('The'), true);
  assert.equal(T.isStopword('invoice'), false);
});
test('wordFrequencies counts content words', () => {
  const f = T.wordFrequencies('invoice invoice payment');
  assert.equal(f.get('invoice'), 2);
  assert.equal(f.get('payment'), 1);
});
test('scoreSentences ranks sentences with frequent words higher', () => {
  const scored = T.scoreSentences(['Budget budget budget review.', 'Lunch was nice.']);
  assert.ok(scored[0].score > scored[1].score);
});
test('extractiveSummary keeps original order and length n', () => {
  const text = 'Alpha beta. Gamma delta. Alpha alpha beta. Zeta. Alpha again here.';
  const s = T.extractiveSummary(text, 2);
  assert.equal(s.length, 2);
  const idx = s.map((x) => text.indexOf(x));
  assert.deepEqual([...idx].sort((a, b) => a - b), idx);
});
test('extractiveSummary returns everything when text is short', () => {
  assert.deepEqual(T.extractiveSummary('Only one. Two here.', 5), ['Only one.', 'Two here.']);
});
test('parseJsonLoose reads plain JSON', () => {
  assert.deepEqual(T.parseJsonLoose('{"a":1}'), { a: 1 });
});
test('parseJsonLoose strips code fences', () => {
  assert.deepEqual(T.parseJsonLoose('```json\n[1,2]\n```'), [1, 2]);
});
test('parseJsonLoose finds JSON inside prose', () => {
  assert.deepEqual(T.parseJsonLoose('Here you go: {"ok": true} thanks'), { ok: true });
});
test('parseJsonLoose throws on non-JSON', () => {
  assert.throws(() => T.parseJsonLoose('no json here at all'), /not valid JSON/);
});
test('jaccard is 1 for identical text and 0 for disjoint text', () => {
  assert.equal(T.jaccard('invoice payment', 'payment invoice'), 1);
  assert.equal(T.jaccard('apples', 'bananas'), 0);
});
test('clip shortens long text with an ellipsis', () => {
  assert.equal(T.clip('abcdefghij', 5), 'abcd…');
  assert.equal(T.clip('abc', 5), 'abc');
});
