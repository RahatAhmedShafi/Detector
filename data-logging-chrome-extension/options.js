// options.js
const idleMsInput = document.getElementById('idleMs');
const saveBtn = document.getElementById('save');
const exportBtn = document.getElementById('export');
const clearBtn = document.getElementById('clear');

chrome.runtime.sendMessage({ type: 'settings:get' }, (res) => {
  if (res && res.ok && res.settings) {
    idleMsInput.value = res.settings.idleMs ?? 5000;
  } else {
    idleMsInput.value = 5000;
  }
});

saveBtn.addEventListener('click', () => {
  const idleMs = parseInt(idleMsInput.value, 10) || 5000;
  chrome.runtime.sendMessage({ type: 'settings:set', settings: { idleMs }}, (res) => {
    // noop
  });
});

exportBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'metrics:export' }, (res) => {
    if (!res || !res.ok) return;
    const a = document.createElement('a');
    a.href = res.url;
    a.download = 'code-metrics.json';
    a.click();
  });
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Delete all recorded data? This cannot be undone.')) return;
  chrome.runtime.sendMessage({ type: 'metrics:clear' }, () => {});
});