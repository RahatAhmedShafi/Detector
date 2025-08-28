// db.js (module) — tiny IndexedDB helper and summarizers

const DB_NAME = 'code-metrics-db';
const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const META_STORE = 'meta';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const s = db.createObjectStore(EVENTS_STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('byOrigin', 'origin');
        s.createIndex('byDay', 'dayKey');
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE); // key-value for settings etc.
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function putEvent(evt) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    tx.objectStore(EVENTS_STORE).put(evt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllEvents() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, 'readonly');
    const req = tx.objectStore(EVENTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getSummaryByOrigin(origin, dayKey) {
  const db = await openDB();
  // simple scan (small data) — can be optimized with compound index
  const all = await getAllEvents();
  const filtered = all.filter(e => (!origin || e.origin === origin) && (!dayKey || e.dayKey === dayKey));
  const summary = {
    origin,
    dayKey,
    keystrokes: 0,
    avgInterKeyMs: null,
    idleEvents: 0,
    maxIdleMs: 0,
    undoCount: 0,
    redoCount: 0,
    compileAttempts: 0,
    errorCount: 0,
    firstSeen: null,
    lastSeen: null
  };
  const intervals = [];

  for (const e of filtered) {
    summary.firstSeen = summary.firstSeen ? Math.min(summary.firstSeen, e.ts) : e.ts;
    summary.lastSeen = summary.lastSeen ? Math.max(summary.lastSeen, e.ts) : e.ts;
    if (e.kind === 'key') {
      summary.keystrokes++;
      if (e.deltaMs != null) intervals.push(e.deltaMs);
      if (e.meta === 'undo') summary.undoCount++;
      if (e.meta === 'redo') summary.redoCount++;
      if (e.meta === 'compile') summary.compileAttempts++;
    } else if (e.kind === 'idle') {
      summary.idleEvents++;
      summary.maxIdleMs = Math.max(summary.maxIdleMs, e.idleMs || 0);
    } else if (e.kind === 'compile') {
      summary.compileAttempts++;
    } else if (e.kind === 'error') {
      summary.errorCount++;
    }
  }

  if (intervals.length) {
    summary.avgInterKeyMs = Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length);
  }
  return summary;
}

export async function exportAll() {
  const data = await getAllEvents();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return blob;
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([EVENTS_STORE, META_STORE], 'readwrite');
    tx.objectStore(EVENTS_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('settings');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSettings(settings) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(settings, 'settings');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}