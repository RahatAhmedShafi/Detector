// background.js (MV3 service worker, type: module)
import { openDB, putEvent, getSummaryByOrigin, clearAll, exportAll, getSettings, saveSettings } from './db.js';
// Add this import for CSV export (make sure getAllEvents exists in db.js)
import { getAllEvents } from './db.js';

chrome.runtime.onInstalled.addListener(async () => {
  await openDB();
  // initialize defaults
  const defaults = { idleMs: 5000 };
  const settings = await getSettings();
  if (!settings) await saveSettings(defaults);
});

// Message routing from content/popup/options
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    await openDB();

    if (msg.type === 'metrics:event') {
      await putEvent(msg.payload);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'metrics:summary') {
      const { origin, dayKey } = msg;
      const summary = await getSummaryByOrigin(origin, dayKey);
      sendResponse({ ok: true, summary });
      return;
    }

    // Updated export handler to support CSV
    if (msg.type === 'metrics:export') {
      if (msg.format === 'csv') {
        const data = await getAllEvents();
        sendResponse({ ok: true, data });
      } else {
        const blob = await exportAll();
        const url = URL.createObjectURL(blob);
        sendResponse({ ok: true, url });
      }
      return;
    }

    if (msg.type === 'metrics:clear') {
      await clearAll();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'settings:get') {
      const settings = await getSettings();
      sendResponse({ ok: true, settings });
      return;
    }

    if (msg.type === 'settings:set') {
      await saveSettings(msg.settings);
      sendResponse({ ok: true });
      return;
    }

  })();
  // keep message channel open for async response
  return true;
});

// Utilities for scripting injection from popup
export async function executeContent(tabId, files) {
  return chrome.scripting.executeScript({
    target: { tabId },
    files
  });
}