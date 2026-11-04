// Settings are kept in localStorage only. This module is pure: it takes a storage object.

export const DEFAULTS = Object.freeze({ mode: 'demo', baseUrl: '', apiKey: '', model: '' });

export function normalizeSettings(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    mode: src.mode === 'live' ? 'live' : 'demo',
    baseUrl: String(src.baseUrl ?? '').trim(),
    apiKey: String(src.apiKey ?? '').trim(),
    model: String(src.model ?? '').trim(),
  };
}

export function validateSettings(settings) {
  const s = normalizeSettings(settings);
  const problems = [];
  if (s.mode !== 'live') return problems;
  if (!s.baseUrl) {
    problems.push('Add the API base URL.');
  } else {
    try {
      const u = new URL(s.baseUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') problems.push('The base URL must start with https:// or http://.');
    } catch (_) {
      problems.push('The base URL is not a valid URL.');
    }
  }
  if (!s.model) problems.push('Add the model name.');
  return problems;
}

export function loadSettings(storage, key) {
  try {
    const raw = storage && storage.getItem(key);
    if (!raw) return { ...DEFAULTS };
    return normalizeSettings(JSON.parse(raw));
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(storage, settings, key) {
  const s = normalizeSettings(settings);
  storage.setItem(key, JSON.stringify(s));
  return s;
}

export function isLive(settings) {
  const s = normalizeSettings(settings);
  return s.mode === 'live' && s.baseUrl !== '' && s.model !== '' && validateSettings(s).length === 0;
}
