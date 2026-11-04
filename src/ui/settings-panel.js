import { loadSettings, saveSettings, validateSettings, normalizeSettings } from '../core/settings.js';

// Wires the Settings dialog in index.html. Storage is the browser's localStorage.
export function initSettings({ storageKey, onChange = () => {} }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('settings-dialog');
  const badge = $('mode-badge');
  const fields = {
    mode: $('settings-mode'),
    baseUrl: $('settings-base-url'),
    apiKey: $('settings-api-key'),
    model: $('settings-model'),
  };
  const errorBox = $('settings-error');
  let current = loadSettings(window.localStorage, storageKey);

  function paint(s) {
    badge.textContent = s.mode === 'live' ? 'Live mode' : 'Demo mode';
    badge.classList.toggle('live', s.mode === 'live');
  }
  function fill(s) {
    fields.mode.value = s.mode;
    fields.baseUrl.value = s.baseUrl;
    fields.apiKey.value = s.apiKey;
    fields.model.value = s.model;
  }
  function read() {
    return normalizeSettings({
      mode: fields.mode.value,
      baseUrl: fields.baseUrl.value,
      apiKey: fields.apiKey.value,
      model: fields.model.value,
    });
  }

  paint(current);

  $('open-settings').addEventListener('click', () => {
    fill(current);
    errorBox.hidden = true;
    dialog.showModal();
  });
  $('close-settings').addEventListener('click', () => dialog.close());
  $('settings-clear').addEventListener('click', () => {
    const cleared = saveSettings(window.localStorage, { ...read(), apiKey: '' }, storageKey);
    fields.apiKey.value = '';
    current = cleared;
    paint(current);
    onChange(current);
  });
  $('settings-save').addEventListener('click', () => {
    const draft = read();
    const problems = validateSettings(draft);
    if (problems.length) {
      errorBox.textContent = problems.join(' ');
      errorBox.hidden = false;
      return;
    }
    current = saveSettings(window.localStorage, draft, storageKey);
    paint(current);
    dialog.close();
    onChange(current);
  });

  return { get: () => current };
}
