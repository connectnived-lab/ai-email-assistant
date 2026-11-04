import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLLMClient, LLMError } from '../src/core/llm.js';

const ok = (content) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }),
  text: async () => '',
});

test('requires a base URL', () => {
  assert.throws(() => createLLMClient({ model: 'm' }), LLMError);
});
test('rejects a malformed base URL', () => {
  assert.throws(() => createLLMClient({ baseUrl: 'not a url', model: 'm' }), /not a valid URL/);
});
test('rejects a non-http scheme', () => {
  assert.throws(() => createLLMClient({ baseUrl: 'ftp://x.test/v1', model: 'm' }), /https:\/\/ or http:\/\//);
});
test('requires a model name', () => {
  assert.throws(() => createLLMClient({ baseUrl: 'https://x.test/v1' }), /model name/);
});
test('builds the chat-completions URL without a double slash', () => {
  const c = createLLMClient({ baseUrl: 'https://x.test/v1/', model: 'm', fetchImpl: ok('hi') });
  assert.equal(c.url, 'https://x.test/v1/chat/completions');
});
test('sends model, messages and bearer key and returns the content', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return ok('answer')();
  };
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', apiKey: 'k1', model: 'mdl', fetchImpl });
  const out = await c.chat([{ role: 'user', content: 'hi' }]);
  assert.equal(out, 'answer');
  assert.equal(seen.init.headers.Authorization, 'Bearer k1');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, 'mdl');
  assert.equal(body.messages[0].content, 'hi');
});
test('omits the Authorization header when no key is given', async () => {
  let headers;
  const fetchImpl = async (u, init) => {
    headers = init.headers;
    return ok('x')();
  };
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl });
  await c.chat([{ role: 'user', content: 'hi' }]);
  assert.equal(headers.Authorization, undefined);
});
test('wraps a network failure in LLMError', async () => {
  const fetchImpl = async () => { throw new Error('boom'); };
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl });
  await assert.rejects(c.chat([{ role: 'user', content: 'hi' }]), /Could not reach the API: boom/);
});
test('reports a non-2xx status with a short detail', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'bad key' });
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl });
  await assert.rejects(c.chat([{ role: 'user', content: 'hi' }]), /answered 401: bad key/);
});
test('reports a non-JSON answer', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl });
  await assert.rejects(c.chat([{ role: 'user', content: 'hi' }]), /not JSON/);
});
test('reports an answer with no text', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '  ' } }] }) });
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl });
  await assert.rejects(c.chat([{ role: 'user', content: 'hi' }]), /no text/);
});
test('refuses an empty message list', async () => {
  const c = createLLMClient({ baseUrl: 'https://x.test/v1', model: 'm', fetchImpl: ok('x') });
  await assert.rejects(c.chat([]), /No messages/);
});
