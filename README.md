# Code Metrics Logger (Chrome Extension)

This extension lets you **opt-in per tab** to record coding activity metrics:
- Compile attempts (button clicks like "Run/Compile", or key combos like Ctrl/Cmd+Enter)
- JavaScript errors on the page (captured via `window.onerror` injection)
- Time between keystrokes
- Cursor idleness (periods of no input/mouse/visibility changes)
- Undo/redo frequency (Ctrl/Cmd+Z / Ctrl/Cmd+Y / Shift+Ctrl+Z)

Data is stored **locally in IndexedDB** inside the extension's service worker. You can export/delete data from the **Options** page.
By default, **no sites are monitored** until you click **Start logging** in the popup for the current tab.

## Install (Developer mode)
1. Download the zip, unzip it.
2. Open `chrome://extensions` → enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Files
- `manifest.json`: MV3 manifest.
- `background.js`: service worker, database, message hub, summarization.
- `db.js`: small IndexedDB helper used by the background.
- `content.js`: attaches listeners and emits events.
- `inject-onerror.js`: injected into the page to catch `window.onerror` and forward to content script.
- `popup.html` / `popup.js`: start/stop logging on the current tab & show quick stats.
- `options.html` / `options.js`: export/delete data; set idle threshold.
- `utils.js`: small helpers shared by content/popup/options (duplicated into each page context when needed).

## Privacy & Scope
- Runs **only when you press Start** for a tab (uses `scripting.executeScript` with `activeTab` permission).
- You can stop logging anytime in the popup.
- Data never leaves your machine unless you export it yourself.
- Idle threshold and site filters are configurable in **Options**.

## Notes
- For Monaco/CodeMirror editors, the content script listens at the document level; it works with most editors out of the box.
- Detecting "compile attempts" is best-effort: it tracks clicks on buttons whose text matches /(run|compile|execute|build)/i and Ctrl/Cmd+Enter.
