import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, validateSettings, loadSettings, saveSettings, isLive } from '../src/core/settings.js';

function memStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    dump: () => Object.fromEntries(m),
  };
}

test('defaults to demo mode with empty fields', () => {
  assert.deepEqual({ ...DEFAULTS }, { mode: 'demo', baseUrl: '', apiKey: '', model: '' });
});
test('normalizeSettings trims values and forces an unknown mode to demo', () => {
  assert.deepEqual(normalizeSettings({ mode: 'weird', baseUrl: ' https://a.test/v1 ', apiKey: ' k ', model: ' m ' }),
    { mode: 'demo', baseUrl: 'https://a.test/v1', apiKey: 'k', model: 'm' });
});
test('normalizeSettings tolerates a missing object', () => {
  assert.deepEqual(normalizeSettings(null), { mode: 'demo', baseUrl: '', apiKey: '', model: '' });
});
test('demo mode never has validation problems', () => {
  assert.deepEqual(validateSettings({ mode: 'demo' }), []);
});
test('live mode needs a base URL and a model', () => {
  const p = validateSettings({ mode: 'live', baseUrl: '', model: '' });
  assert.equal(p.length, 2);
});
test('live mode rejects an invalid base URL', () => {
  assert.match(validateSettings({ mode: 'live', baseUrl: 'nope', model: 'm' })[0], /not a valid URL/);
});
test('live mode rejects a non-http scheme', () => {
  assert.match(validateSettings({ mode: 'live', baseUrl: 'file:///x', model: 'm' })[0], /must start with/);
});
test('a complete live configuration validates', () => {
  assert.deepEqual(validateSettings({ mode: 'live', baseUrl: 'https://a.test/v1', model: 'm' }), []);
});
test('loadSettings returns defaults when nothing is stored', () => {
  assert.deepEqual(loadSettings(memStore(), 'k'), { ...DEFAULTS });
});
test('loadSettings returns defaults on corrupt JSON', () => {
  assert.deepEqual(loadSettings(memStore({ k: '{not json' }), 'k'), { ...DEFAULTS });
});
test('loadSettings returns defaults when storage is missing', () => {
  assert.deepEqual(loadSettings(undefined, 'k'), { ...DEFAULTS });
});
test('saveSettings writes normalized JSON under the key', () => {
  const store = memStore();
  const s = saveSettings(store, { mode: 'live', baseUrl: ' https://a.test ', apiKey: 'x', model: 'm' }, 'k');
  assert.equal(s.baseUrl, 'https://a.test');
  assert.deepEqual(JSON.parse(store.dump().k), s);
});
test('saved settings round-trip through loadSettings', () => {
  const store = memStore();
  saveSettings(store, { mode: 'live', baseUrl: 'https://a.test', apiKey: 'x', model: 'm' }, 'k');
  assert.equal(loadSettings(store, 'k').model, 'm');
});
test('isLive is true only for live mode with URL and model', () => {
  assert.equal(isLive({ mode: 'live', baseUrl: 'https://a.test', model: 'm' }), true);
  assert.equal(isLive({ mode: 'demo', baseUrl: 'https://a.test', model: 'm' }), false);
  assert.equal(isLive({ mode: 'live', baseUrl: '', model: 'm' }), false);
  assert.equal(isLive({ mode: 'live', baseUrl: 'https://a.test', model: '' }), false);
});
