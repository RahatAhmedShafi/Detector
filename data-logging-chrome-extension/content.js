// content.js — attaches listeners and emits metrics to background
(function () {
  const origin = location.origin;
  const dayKey = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  let lastKeyTs = null;
  let lastActivityTs = Date.now();
  let idleTimer = null;
  let idleMsSetting = 5000; // default; will be updated from background settings

  const send = (payload) => {
    chrome.runtime.sendMessage({ type: 'metrics:event', payload });
  };

  const markActivity = () => {
    lastActivityTs = Date.now();
  };

  const scheduleIdleCheck = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      const now = Date.now();
      const idleMs = now - lastActivityTs;
      if (idleMs >= idleMsSetting) {
        send({ kind: 'idle', ts: now, idleMs, origin, dayKey });
        lastActivityTs = now; // reset after recording
      }
      scheduleIdleCheck();
    }, 1000);
  };

  // fetch settings
  chrome.runtime.sendMessage({ type: 'settings:get' }, (res) => {
    if (res && res.ok && res.settings && typeof res.settings.idleMs === 'number') {
      idleMsSetting = res.settings.idleMs;
    }
  });

  // Keystrokes & meta (undo/redo/compile)
  document.addEventListener('keydown', (e) => {
    const now = Date.now();
    const deltaMs = lastKeyTs ? now - lastKeyTs : null;
    lastKeyTs = now;
    markActivity();

    // meta tagging
    let meta = null;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
    const ctrl = isMac ? e.metaKey : e.ctrlKey;

    // undo
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) meta = 'undo';
    // redo (Ctrl+Y or Shift+Ctrl+Z)
    if ((ctrl && e.key.toLowerCase() === 'y') || (ctrl && e.shiftKey && e.key.toLowerCase() === 'z')) meta = 'redo';
    // compile attempt (Ctrl/Cmd+Enter)
    if (ctrl && e.key === 'Enter') meta = 'compile';

    send({
      kind: 'key',
      ts: now,
      key: e.key,
      code: e.code,
      ctrl: e.ctrlKey,
      metaKey: e.metaKey,
      alt: e.altKey,
      shift: e.shiftKey,
      deltaMs,
      meta,
      origin,
      dayKey
    });
  }, true);

  // text input as activity
  document.addEventListener('input', markActivity, true);
  document.addEventListener('mousedown', markActivity, true);
  document.addEventListener('mousemove', markActivity, true);
  document.addEventListener('visibilitychange', markActivity, true);

  // Compile/run button clicks (best-effort)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="button"], input[type="submit"], a, div[role="button"]');
    if (!btn) return;
    const label = (btn.innerText || btn.value || '').trim().toLowerCase();
    if (/(run|compile|execute|build)/i.test(label)) {
      send({ kind: 'compile', ts: Date.now(), label, origin, dayKey });
      markActivity();
    }
  }, true);

  // Inject onerror hook
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inject-onerror.js');
    (document.head || document.documentElement).appendChild(s);
    s.remove();
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.__codeMetricsError) {
        send({ kind: 'error', ts: Date.now(), message: event.data.message, stack: event.data.stack, origin, dayKey });
      }
    });
  } catch (e) {
    // ignore
  }

  scheduleIdleCheck();
})();