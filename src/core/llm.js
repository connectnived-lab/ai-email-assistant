// OpenAI-compatible chat-completions client. The fetch implementation is injectable
// so tests and the demo mode never touch the network.

export class LLMError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMError';
  }
}

export function createLLMClient({ baseUrl, apiKey = '', model, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl) throw new LLMError('Add an API base URL in Settings.');
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (_) {
    throw new LLMError('The API base URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new LLMError('The API base URL must start with https:// or http://.');
  }
  if (!model) throw new LLMError('Add a model name in Settings.');
  if (typeof fetchImpl !== 'function') throw new LLMError('No fetch implementation is available.');

  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';

  async function chat(messages, { temperature = 0.2 } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LLMError('No messages to send.');
    }
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, temperature }),
      });
    } catch (err) {
      throw new LLMError(`Could not reach the API: ${err && err.message ? err.message : 'network error'}`);
    }
    if (!res || !res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 160);
      } catch (_) {
        detail = '';
      }
      throw new LLMError(`The API answered ${res ? res.status : 'nothing'}${detail ? `: ${detail}` : ''}`);
    }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new LLMError('The API answer was not JSON.');
    }
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : undefined;
    if (typeof content !== 'string' || !content.trim()) {
      throw new LLMError('The API answer had no text in it.');
    }
    return content;
  }

  return { chat, url };
}
