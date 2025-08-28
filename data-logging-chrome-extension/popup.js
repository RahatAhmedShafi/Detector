async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

let lastSummary = null; // Store the last summary for export

document.getElementById('start').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
  document.getElementById('status').innerHTML = '<small>Logging active on this tab.</small>';
  refreshSummary();
});

document.getElementById('stop').addEventListener('click', async () => {
  document.getElementById('status').innerHTML = '<small>Stop pressed. Reload the tab to fully detach listeners.</small>';
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function refreshSummary() {
  const tab = await getCurrentTab();
  const url = new URL(tab.url);
  const origin = url.origin;
  const dayKey = new Date().toISOString().slice(0,10);
  chrome.runtime.sendMessage({ type: 'metrics:summary', origin, dayKey }, (res) => {
    if (!res || !res.ok) return;
    const s = res.summary || {};
    lastSummary = {
      Origin: origin,
      Keystrokes: s.keystrokes || 0,
      "Avg inter-key (ms)": s.avgInterKeyMs ?? '-',
      "Undo / Redo": `${s.undoCount || 0} / ${s.redoCount || 0}`,
      "Compile attempts": s.compileAttempts || 0,
      "JS errors": s.errorCount || 0,
      "Idle events (max ms)": `${s.idleEvents || 0} (${s.maxIdleMs || 0})`
    };
    document.getElementById('summary').innerHTML = `
      <div class="stat"><span>Origin:</span> <b>${origin}</b></div>
      <div class="stat"><span>Keystrokes:</span> <b>${s.keystrokes||0}</b></div>
      <div class="stat"><span>Avg inter-key (ms):</span> <b>${s.avgInterKeyMs ?? '-'}</b></div>
      <div class="stat"><span>Undo / Redo:</span> <b>${s.undoCount||0} / ${s.redoCount||0}</b></div>
      <div class="stat"><span>Compile attempts:</span> <b>${s.compileAttempts||0}</b></div>
      <div class="stat"><span>JS errors:</span> <b>${s.errorCount||0}</b></div>
      <div class="stat"><span>Idle events (max ms):</span> <b>${s.idleEvents||0} (${s.maxIdleMs||0})</b></div>
    `;
  });
}

document.getElementById('export').addEventListener('click', (e) => {
  e.preventDefault();
  if (!lastSummary) {
    alert('No summary to export.');
    return;
  }
  const jsonContent = JSON.stringify(lastSummary, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Create a temporary <a> for download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'code-metrics-summary.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById('export-csv').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ type: 'metrics:export', format: 'csv' }, (res) => {
    if (!res || !res.ok || !res.data) {
      alert('No data to export.');
      return;
    }
    const data = res.data;
    if (!Array.isArray(data) || data.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(field =>
          `"${String(row[field] ?? '').replace(/"/g, '""')}"`
        ).join(',')
      )
    ];
    const csvContent = csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    // Create a temporary <a> for download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code-metrics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});

refreshSummary();