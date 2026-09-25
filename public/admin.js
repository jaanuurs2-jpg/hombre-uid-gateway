// HOMBRE Admin Panel Controller

let currentKeys = [];
const BASE_URL = window.location.origin;

function getAdminToken() {
  return sessionStorage.getItem('hombre_admin_token') || localStorage.getItem('hombre_admin_token');
}

function setAdminToken(token) {
  sessionStorage.setItem('hombre_admin_token', token);
  localStorage.setItem('hombre_admin_token', token);
}

function clearAdminToken() {
  sessionStorage.removeItem('hombre_admin_token');
  localStorage.removeItem('hombre_admin_token');
}

document.addEventListener('DOMContentLoaded', async () => {
  setupDirectLoginForm();
  setupAdminAnimations();
  setupModalAddUidForm();
  setupEditKeyForm();
  await checkAuthAndInitialize();
});

// Check Authentication
async function checkAuthAndInitialize() {
  const token = getAdminToken();
  const lockScreen = document.getElementById('auth-lock-screen');
  const mainContainer = document.getElementById('admin-main-container');

  if (!token) {
    showLockScreen();
    return;
  }

  try {
    const res = await fetch('/api/admin/verify-token', {
      headers: { 'x-admin-token': token }
    });

    if (res.ok) {
      if (lockScreen) lockScreen.classList.add('hidden');
      if (mainContainer) mainContainer.classList.remove('hidden');

      setupTabs();
      setupForms();
      loadStats();
      loadKeys();
      loadLogs();
      updatePublicUrlDisplay();

      const searchInput = document.getElementById('key-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', () => applyKeyFilters());
      }
      const keyStatusFilter = document.getElementById('key-status-filter');
      if (keyStatusFilter) {
        keyStatusFilter.addEventListener('change', () => applyKeyFilters());
      }

      const logSearch = document.getElementById('log-search-input');
      if (logSearch) {
        logSearch.addEventListener('input', () => applyLogFilters());
      }
      const logStatusFilter = document.getElementById('log-status-filter');
      if (logStatusFilter) {
        logStatusFilter.addEventListener('change', () => applyLogFilters());
      }
    } else {
      clearAdminToken();
      showLockScreen();
    }
  } catch (err) {
    console.error('Error verifying token:', err);
    showLockScreen();
  }
}

function showLockScreen() {
  const lockScreen = document.getElementById('auth-lock-screen');
  const mainContainer = document.getElementById('admin-main-container');
  if (lockScreen) lockScreen.classList.remove('hidden');
  if (mainContainer) mainContainer.classList.add('hidden');
}

function setupDirectLoginForm() {
  const form = document.getElementById('vault-direct-login');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('vault-direct-pass').value;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          setAdminToken(data.token);
          checkAuthAndInitialize();
        } else {
          alert(data.error || 'Access Denied: Incorrect Password');
        }
      } catch (err) {
        alert('Server unreachable');
      }
    });
  }
}

function adminLogout() {
  clearAdminToken();
  window.location.href = '/';
}

function updatePublicUrlDisplay() {
  const el = document.getElementById('display-public-url');
  if (el) {
    el.value = `${window.location.origin}/api/v1/uids/add`;
  }
}

// Tab Navigation
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (targetId === 'tab-logs') loadLogs();
      if (targetId === 'tab-keys') loadKeys();
      if (targetId === 'tab-docs') updateCodeSnippets();
    });
  });
}

// Form Setup
function setupForms() {
  const quickForm = document.getElementById('quick-gen-form');
  if (quickForm) {
    quickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('quick-name').value;
      const prefix = document.getElementById('quick-prefix').value;
      const days = document.getElementById('quick-days').value;
      const uidLimit = parseInt(document.getElementById('quick-max-calls').value, 10) || 0;

      await createKey({ name, prefix, days, uidLimit, maxCalls: uidLimit });
      quickForm.reset();
      document.getElementById('quick-prefix').value = 'HOMBRE';
      document.getElementById('quick-max-calls').value = '10';
    });
  }

  const fullForm = document.getElementById('full-gen-form');
  if (fullForm) {
    fullForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('gen-name').value;
      const prefix = document.getElementById('gen-prefix').value;
      const days = document.getElementById('gen-days').value;
      const uidLimit = parseInt(document.getElementById('gen-max-calls').value, 10) || 0;
      const customKey = document.getElementById('gen-custom-key').value;

      const newKey = await createKey({ name, prefix, days, uidLimit, maxCalls: uidLimit, customKey });
      if (newKey) {
        const resultBox = document.getElementById('gen-result-box');
        const resultText = document.getElementById('result-key-text');
        resultText.value = newKey.key;
        resultBox.classList.remove('hidden');
      }
    });
  }
}

function setQuickUidLimit(val) {
  const el = document.getElementById('quick-max-calls');
  if (el) el.value = val;
}

function setFullUidLimit(val) {
  const el = document.getElementById('gen-max-calls');
  if (el) el.value = val;
}

// Stats
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-token': getAdminToken() }
    });
    if (!res.ok) return;
    const data = await res.json();

    const elTotal = document.getElementById('stat-total-keys');
    const elActive = document.getElementById('stat-active-keys');
    const elUids = document.getElementById('stat-active-uids');
    const elSlots = document.getElementById('stat-slots-consumed');
    const elRequests = document.getElementById('stat-total-requests');
    const elRate = document.getElementById('stat-success-rate');
    const elUptime = document.getElementById('stat-uptime-desc');

    if (elTotal) elTotal.innerText = data.totalKeys;
    if (elActive) elActive.innerText = data.activeKeys;
    if (elUids) elUids.innerText = data.totalActiveUids || 0;
    if (elSlots) elSlots.innerText = data.totalSlotsConsumed || 0;
    if (elRequests) elRequests.innerText = data.totalRequests;

    if (data.totalRequests > 0) {
      const rate = Math.round((data.successfulRequests / data.totalRequests) * 100);
      if (elRate) elRate.innerText = `${rate}%`;
    } else {
      if (elRate) elRate.innerText = `100%`;
    }

    if (elUptime && data.uptimeSeconds) {
      const mins = Math.floor(data.uptimeSeconds / 60);
      const secs = data.uptimeSeconds % 60;
      elUptime.innerText = `Uptime: ${mins}m ${secs}s • Zero Degradation`;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Keys
async function loadKeys() {
  try {
    const res = await fetch('/api/admin/keys', {
      headers: { 'x-admin-token': getAdminToken() }
    });
    if (!res.ok) return;
    currentKeys = await res.json();
    renderKeysTable(currentKeys);
    populateKeySelects(currentKeys);
    updateCodeSnippets();
  } catch (err) {
    console.error('Failed to load keys:', err);
  }
}

async function createKey(payload) {
  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getAdminToken()
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Key Created: ${data.key.key}`);
      loadKeys();
      loadStats();
      return data.key;
    } else {
      alert(`Error: ${data.error || 'Failed to create key'}`);
    }
  } catch (err) {
    console.error('Error creating key:', err);
    alert('Failed to connect to backend server');
  }
  return null;
}

async function toggleKey(id) {
  try {
    const res = await fetch(`/api/admin/keys/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'x-admin-token': getAdminToken() }
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      loadKeys();
      loadStats();
    }
  } catch (err) {
    console.error('Error toggling key:', err);
  }
}

async function deleteKey(id) {
  if (!confirm('Are you sure you want to revoke and delete this key? Clients using it will immediately be blocked.')) {
    return;
  }
  try {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': getAdminToken() }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Key deleted permanently');
      loadKeys();
      loadStats();
    }
  } catch (err) {
    console.error('Error deleting key:', err);
  }
}

function renderKeysTable(keys) {
  const tbody = document.getElementById('keys-table-body');
  if (!tbody) return;

  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No API keys found. Generate one above!</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map(k => {
    let statusBadge = '<span class="badge badge-success">Active</span>';
    const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
    const effectiveLimit = k.uidLimit !== undefined ? k.uidLimit : (k.maxCalls || 0);
    const slotsConsumed = k.slotsConsumed !== undefined 
      ? k.slotsConsumed 
      : ((k.registeredUids && Array.isArray(k.registeredUids)) ? k.registeredUids.length : (k.uidsCount || k.usageCount || 0));
    const activeUids = (k.registeredUids && Array.isArray(k.registeredUids)) ? k.registeredUids.length : 0;
    const isLimitFull = effectiveLimit > 0 && slotsConsumed >= effectiveLimit;

    if (!k.isActive) {
      statusBadge = '<span class="badge badge-warning">Paused</span>';
    } else if (isExpired) {
      statusBadge = '<span class="badge badge-danger">Expired</span>';
    } else if (isLimitFull) {
      statusBadge = '<span class="badge badge-danger">Limit Full</span>';
    }

    const expiryStr = k.expiresAt 
      ? new Date(k.expiresAt).toLocaleDateString() 
      : '<span class="badge badge-neutral">Lifetime</span>';

    const createdStr = new Date(k.createdAt).toLocaleDateString();
    const percent = effectiveLimit > 0 ? Math.min(100, Math.round((slotsConsumed / effectiveLimit) * 100)) : 0;
    const barColor = percent >= 100 ? 'fill-red' : (percent >= 70 ? 'fill-yellow' : 'fill-green');
    const progressBar = effectiveLimit > 0 ? `
      <div class="quota-progress-track">
        <div class="quota-progress-fill ${barColor}" style="width: ${percent}%;"></div>
      </div>
    ` : '';

    const quotaStr = effectiveLimit > 0 
      ? `<span style="font-family: var(--font-mono); font-size: 12px; ${isLimitFull ? 'color: var(--accent-rose); font-weight: 700;' : ''}"><strong>${slotsConsumed}</strong> / ${effectiveLimit} Slots (${percent}%)</span>`
      : `<span style="font-family: var(--font-mono); font-size: 12px;"><strong>${slotsConsumed}</strong> (Unlimited)</span>`;

    const viewUidsBtn = `<button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick="openKeyUidsModal('${k.id}')">👁️ Active (${activeUids})</button>`;
    const addUidBtn = `<button type="button" class="btn btn-accent btn-sm" style="padding: 2px 7px; font-size: 11px; display: inline-flex; align-items: center; gap: 2px;" onclick="openKeyUidsModal('${k.id}', true)">➕ Add UID</button>`;

    return `
      <tr>
        <td><strong>${escapeHtml(k.name)}</strong></td>
        <td><span class="key-code">${escapeHtml(k.key)}</span></td>
        <td>${statusBadge}</td>
        <td>${expiryStr}</td>
        <td>
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px;">
            ${quotaStr}
            ${progressBar}
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
              ${viewUidsBtn}
              ${addUidBtn}
            </div>
          </div>
        </td>
        <td>${createdStr}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" title="Modify Key Quota / Name" onclick="openEditKeyModal('${k.id}')">⚙️</button>
            <button class="icon-btn" title="Copy Key" onclick="copyPlain('${escapeHtml(k.key)}')">📋</button>
            <button class="icon-btn" title="Toggle Status" onclick="toggleKey('${k.id}')">${k.isActive ? '⏸️' : '▶️'}</button>
            <button class="icon-btn icon-btn-danger" title="Delete Key" onclick="deleteKey('${k.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function applyKeyFilters() {
  const searchInput = document.getElementById('key-search-input');
  const statusFilter = document.getElementById('key-status-filter');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const status = statusFilter ? statusFilter.value : 'all';

  let filtered = currentKeys;
  if (status !== 'all') {
    filtered = filtered.filter(k => {
      const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
      const effectiveLimit = k.uidLimit !== undefined ? k.uidLimit : (k.maxCalls || 0);
      const slotsConsumed = k.slotsConsumed !== undefined 
        ? k.slotsConsumed 
        : ((k.registeredUids && Array.isArray(k.registeredUids)) ? k.registeredUids.length : (k.uidsCount || k.usageCount || 0));
      const isLimitFull = effectiveLimit > 0 && slotsConsumed >= effectiveLimit;

      if (status === 'active') return k.isActive && !isExpired && !isLimitFull;
      if (status === 'paused') return !k.isActive;
      if (status === 'expired') return isExpired;
      if (status === 'limit_full') return isLimitFull;
      return true;
    });
  }

  if (q) {
    filtered = filtered.filter(k => 
      k.key.toLowerCase().includes(q) || 
      (k.name && k.name.toLowerCase().includes(q)) ||
      (k.registeredUids && k.registeredUids.some(u => String(u).toLowerCase().includes(q)))
    );
  }

  renderKeysTable(filtered);
}

function filterKeysTable(query) {
  applyKeyFilters();
}

function exportKeysCSV() {
  if (!currentKeys || currentKeys.length === 0) {
    showToast('No keys to export');
    return;
  }
  const headers = ['Client Label', 'Bypass Key', 'Status', 'Expires', 'Slots Consumed', 'UID Limit', 'Active UIDs', 'Created At'];
  const rows = currentKeys.map(k => [
    `"${(k.name || '').replace(/"/g, '""')}"`,
    `"${k.key}"`,
    k.isActive ? 'Active' : 'Paused',
    k.expiresAt ? new Date(k.expiresAt).toISOString() : 'Lifetime',
    k.slotsConsumed || (k.registeredUids ? k.registeredUids.length : 0),
    k.uidLimit || 0,
    k.registeredUids ? k.registeredUids.length : 0,
    new Date(k.createdAt).toISOString()
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csvContent, 'hombre-managed-keys.csv', 'text/csv');
  showToast('Keys exported to CSV! 📥');
}

function populateKeySelects(keys) {
  const testerSelect = document.getElementById('test-key-select');
  const docsSelect = document.getElementById('docs-key-select');

  const optionsHtml = keys.map(k => 
    `<option value="${escapeHtml(k.key)}">${escapeHtml(k.name)} (${escapeHtml(k.key)})</option>`
  ).join('');

  if (testerSelect) {
    testerSelect.innerHTML = `<option value="">Select a key...</option>` + optionsHtml;
    if (keys.length > 0) testerSelect.value = keys[0].key;
  }

  if (docsSelect) {
    docsSelect.innerHTML = optionsHtml || `<option value="HOMBRE-SAMPLE-KEY">HOMBRE-SAMPLE-KEY</option>`;
    if (keys.length > 0) docsSelect.value = keys[0].key;
  }
}

// Live Tester
async function runLiveTest() {
  const keySelect = document.getElementById('test-key-select');
  const key = keySelect ? keySelect.value : '';
  const uid = document.getElementById('test-uid').value;
  const days = parseInt(document.getElementById('test-days').value, 10);
  const name = document.getElementById('test-name').value;

  const btn = document.getElementById('btn-run-test');
  const statusBadge = document.getElementById('response-status');
  const timeBadge = document.getElementById('response-time');
  const jsonBox = document.getElementById('response-json-box');

  if (!key) {
    alert('Please select or create an active HOMBRE API Key first!');
    return;
  }

  btn.disabled = true;
  btn.innerText = '⏳ Forwarding to Master API...';
  statusBadge.className = 'badge badge-neutral';
  statusBadge.innerText = 'Status: Sending...';
  jsonBox.innerHTML = `<code>Sending request to ${BASE_URL}/api/v1/uids/add ...</code>`;

  const startTime = performance.now();

  try {
    const res = await fetch('/api/v1/uids/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-KEY': key
      },
      body: JSON.stringify({ uid, days, name })
    });

    const elapsed = Math.round(performance.now() - startTime);
    timeBadge.innerText = `Latency: ${elapsed} ms`;

    const data = await res.json();
    statusBadge.innerText = `Status: ${res.status} ${res.statusText}`;

    if (res.ok) {
      statusBadge.className = 'badge badge-success';
    } else {
      statusBadge.className = 'badge badge-danger';
    }

    jsonBox.innerHTML = `<code>${escapeHtml(JSON.stringify(data, null, 2))}</code>`;
    
    loadStats();
    loadKeys();
  } catch (err) {
    statusBadge.className = 'badge badge-danger';
    statusBadge.innerText = 'Network Error';
    jsonBox.innerHTML = `<code>Error: ${escapeHtml(err.message)}</code>`;
  } finally {
    btn.disabled = false;
    btn.innerText = 'Send UID Bypass Request';
  }
}

// Code Snippets
function switchCodeTab(type) {
  document.querySelectorAll('.code-tab-item').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.code-box-display').forEach(b => {
    b.classList.add('hidden');
    b.classList.remove('active');
  });

  const btn = (typeof event !== 'undefined' && event) ? event.target : null;
  if (btn) btn.classList.add('active');

  const block = document.getElementById(`snippet-${type}`);
  if (block) {
    block.classList.remove('hidden');
    block.classList.add('active');
  }
}

function updateCodeSnippets() {
  const docsSelect = document.getElementById('docs-key-select');
  const selectedKey = (docsSelect && docsSelect.value) ? docsSelect.value : 'HOMBRE-YOUR-KEY-HERE';
  const endpoint = `${BASE_URL}/api/v1/uids/add`;

  const phpCode = `<?php
$ch = curl_init('${endpoint}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'X-AUTH-KEY: ${selectedKey}',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'uid' => '123456789',
    'days' => 30,
    'name' => 'MyUID',
  ]),
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;

  const pythonCode = `import requests

url = "${endpoint}"
headers = {
    "Content-Type": "application/json",
    "X-AUTH-KEY": "${selectedKey}"
}
payload = {
    "uid": "123456789",
    "days": 30,
    "name": "MyUID"
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Response:", response.json())`;

  const jsCode = `async function addUID() {
  const response = await fetch('${endpoint}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-KEY': '${selectedKey}'
    },
    body: JSON.stringify({
      uid: '123456789',
      days: 30,
      name: 'MyUID'
    })
  });

  const result = await response.json();
  console.log(result);
}

addUID();`;

  const curlCode = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-AUTH-KEY: ${selectedKey}" \\
  -d '{"uid":"123456789","days":30,"name":"MyUID"}'`;

  const elPhp = document.getElementById('code-php');
  const elPy = document.getElementById('code-python');
  const elJs = document.getElementById('code-js');
  const elCurl = document.getElementById('code-curl');

  if (elPhp) elPhp.innerText = phpCode;
  if (elPy) elPy.innerText = pythonCode;
  if (elJs) elJs.innerText = jsCode;
  if (elCurl) elCurl.innerText = curlCode;
}

// Logs
let currentLogs = [];

async function loadLogs() {
  try {
    const res = await fetch('/api/admin/logs', {
      headers: { 'x-admin-token': getAdminToken() }
    });
    if (!res.ok) return;
    currentLogs = await res.json();
    renderLogsTable(currentLogs);
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function applyLogFilters() {
  const logSearch = document.getElementById('log-search-input');
  const statusFilter = document.getElementById('log-status-filter');
  const q = logSearch ? logSearch.value.toLowerCase().trim() : '';
  const status = statusFilter ? statusFilter.value : 'all';

  let filtered = currentLogs;
  if (status !== 'all') {
    const code = parseInt(status, 10);
    filtered = filtered.filter(l => l.status === code);
  }

  if (q) {
    filtered = filtered.filter(l => 
      (l.key && l.key.toLowerCase().includes(q)) ||
      (l.clientName && l.clientName.toLowerCase().includes(q)) ||
      (l.uid && String(l.uid).toLowerCase().includes(q)) ||
      (l.status && String(l.status).toLowerCase().includes(q)) ||
      (l.ip && String(l.ip).toLowerCase().includes(q))
    );
  }

  renderLogsTable(filtered);
}

function filterLogsTable(query) {
  applyLogFilters();
}

function exportLogsCSV() {
  if (!currentLogs || currentLogs.length === 0) {
    showToast('No logs to export');
    return;
  }
  const headers = ['Timestamp', 'Bypass Key', 'Client Name', 'Target UID', 'Status', 'Latency (ms)', 'Caller IP'];
  const rows = currentLogs.map(l => [
    new Date(l.timestamp).toISOString(),
    `"${l.key || ''}"`,
    `"${(l.clientName || '').replace(/"/g, '""')}"`,
    `"${l.uid || ''}"`,
    l.status,
    l.durationMs || 0,
    `"${l.ip || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csvContent, 'hombre-request-logs.csv', 'text/csv');
  showToast('Logs exported to CSV! 📥');
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No request logs match your filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const timeStr = new Date(l.timestamp).toLocaleTimeString();
    const statusClass = l.status >= 200 && l.status < 300 
      ? 'badge badge-success' 
      : 'badge badge-danger';

    return `
      <tr>
        <td>${timeStr}</td>
        <td><span class="key-code">${escapeHtml(l.key || 'N/A')}</span></td>
        <td>${escapeHtml(l.clientName || 'N/A')}</td>
        <td><code>${escapeHtml(l.uid || 'N/A')}</code></td>
        <td><span class="${statusClass}">${l.status}</span></td>
        <td>${l.durationMs || 0} ms</td>
        <td><small class="text-muted">${escapeHtml(l.ip || 'local')}</small></td>
      </tr>
    `;
  }).join('');
}

async function clearLogs() {
  if (!confirm('Clear all logs?')) return;
  try {
    await fetch('/api/admin/logs', {
      method: 'DELETE',
      headers: { 'x-admin-token': getAdminToken() }
    });
    showToast('Logs cleared');
    loadLogs();
    loadStats();
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

// ==========================================
// UID INSPECTION AUDIT MODAL (Per-Key UIDs)
// ==========================================
let currentModalKeyId = null;
let currentModalUids = [];

function setupModalAddUidForm() {
  const form = document.getElementById('modal-add-uid-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentModalKeyId) {
      alert('Please select or open a key first.');
      return;
    }

    const uidInput = document.getElementById('modal-add-uid');
    const nameInput = document.getElementById('modal-add-name');
    const daysInput = document.getElementById('modal-add-days');
    const btn = document.getElementById('btn-modal-add-uid');

    const uid = uidInput ? uidInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const days = daysInput ? parseInt(daysInput.value, 10) || 30 : 30;

    if (!uid) return;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Adding...</span>';

    try {
      const res = await fetch(`/api/admin/keys/${currentModalKeyId}/uids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': getAdminToken()
        },
        body: JSON.stringify({ uid, name, days })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `UID ${uid} added! ✅`);
        if (uidInput) uidInput.value = '';
        if (nameInput) nameInput.value = '';
        currentModalUids = data.uids || [];
        renderModalUidsTable(currentModalUids);
        const countEl = document.getElementById('modal-uids-count');
        if (countEl) countEl.innerText = `${currentModalUids.length} UIDs`;
        loadKeys();
        loadStats();
      } else {
        alert(data.error || 'Failed to add UID');
      }
    } catch (err) {
      alert('Network error while adding UID');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>➕ Add UID</span>';
    }
  });
}

async function removeUidFromKey(uid) {
  if (!currentModalKeyId || !uid) return;

  if (!confirm(`Are you sure you want to remove UID "${uid}" from this key?\n\n• UID will be removed from BOTH HOMBRE Gateway & Master Upstream API.\n• Note: Consumed quota slot remains consumed permanently (non-refundable).`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/keys/${currentModalKeyId}/uids/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': getAdminToken() }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || `UID ${uid} removed from both APIs! 🗑️`);
      currentModalUids = data.uids || [];
      renderModalUidsTable(currentModalUids);
      const countEl = document.getElementById('modal-uids-count');
      if (countEl) countEl.innerText = `${currentModalUids.length} Active UIDs • ${data.slotsConsumed || ''} Slots Used`;
      loadKeys();
      loadStats();
    } else {
      alert(data.error || 'Failed to remove UID');
    }
  } catch (err) {
    alert('Network error while removing UID');
  }
}

async function openKeyUidsModal(keyId, focusAdd = false) {
  currentModalKeyId = keyId;
  const modal = document.getElementById('key-uids-modal');
  const titleEl = document.getElementById('modal-key-title');
  const subtitleEl = document.getElementById('modal-key-code');
  const countEl = document.getElementById('modal-uids-count');
  const tbody = document.getElementById('modal-uids-table-body');
  const searchInput = document.getElementById('modal-search-input');

  if (searchInput) searchInput.value = '';
  if (modal) modal.classList.remove('hidden');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Loading registered UIDs...</td></tr>`;

  if (focusAdd) {
    setTimeout(() => {
      const addInput = document.getElementById('modal-add-uid');
      if (addInput) addInput.focus();
    }, 150);
  }

  try {
    const res = await fetch(`/api/admin/keys/${keyId}/uids`, {
      headers: { 'x-admin-token': getAdminToken() }
    });
    if (!res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load UIDs for this key</td></tr>`;
      return;
    }
    const data = await res.json();
    currentModalUids = data.uids || [];
    const slots = data.slotsConsumed !== undefined ? data.slotsConsumed : currentModalUids.length;
    
    if (titleEl) titleEl.innerText = `${data.name || 'Key'} — Registered UIDs`;
    if (subtitleEl) subtitleEl.innerText = data.key;
    if (countEl) countEl.innerText = `${currentModalUids.length} Active UIDs • ${slots}/${data.limit > 0 ? data.limit : 'Unlimited'} Slots Consumed (Non-Refundable)`;

    renderModalUidsTable(currentModalUids);
  } catch (err) {
    console.error('Error fetching key UIDs:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Network error fetching UIDs</td></tr>`;
  }
}

function renderModalUidsTable(uids) {
  const tbody = document.getElementById('modal-uids-table-body');
  if (!tbody) return;

  if (uids.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No UIDs registered with this key yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = uids.map((item, idx) => {
    const dateStr = item.addedAt ? new Date(item.addedAt).toLocaleString() : 'N/A';
    return `
      <tr>
        <td style="color: var(--text-tertiary); font-size: 11px;">${idx + 1}</td>
        <td><code style="font-weight: 700; color: #fff; font-size: 13px;">${escapeHtml(item.uid)}</code></td>
        <td>${escapeHtml(item.name || 'N/A')}</td>
        <td><span class="badge badge-subtle">${item.days || 30} Days</span></td>
        <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
        <td><small class="text-muted">${escapeHtml(item.ip || 'N/A')}</small></td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 5px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" title="Copy UID" onclick="copyPlain('${escapeHtml(item.uid)}')">📋</button>
            <button type="button" class="btn btn-danger-outline btn-sm" style="padding: 2px 7px; font-size: 11px;" title="Remove UID & Free Slot" onclick="removeUidFromKey('${escapeHtml(item.uid)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterModalUids(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderModalUidsTable(currentModalUids);
    return;
  }
  const filtered = currentModalUids.filter(u => 
    String(u.uid).toLowerCase().includes(q) || 
    (u.name && String(u.name).toLowerCase().includes(q)) ||
    (u.ip && String(u.ip).toLowerCase().includes(q))
  );
  renderModalUidsTable(filtered);
}

function closeKeyUidsModal() {
  const modal = document.getElementById('key-uids-modal');
  if (modal) modal.classList.add('hidden');
}

function copyAllModalUids() {
  if (!currentModalUids || currentModalUids.length === 0) {
    showToast('No UIDs to copy');
    return;
  }
  const uidList = currentModalUids.map(u => u.uid).join('\n');
  navigator.clipboard.writeText(uidList);
  showToast(`Copied ${currentModalUids.length} UIDs to clipboard! 📋`);
}

// ==========================================
// EDIT KEY MODAL CONTROLLER
// ==========================================
let currentEditKeyId = null;

function openEditKeyModal(keyId) {
  const k = currentKeys.find(item => item.id === keyId);
  if (!k) return;

  currentEditKeyId = keyId;
  const modal = document.getElementById('edit-key-modal');
  const codeEl = document.getElementById('edit-key-code');
  const idInput = document.getElementById('edit-key-id');
  const nameInput = document.getElementById('edit-key-name');
  const limitInput = document.getElementById('edit-key-limit');
  const addDaysInput = document.getElementById('edit-key-add-days');

  if (codeEl) codeEl.innerText = k.key;
  if (idInput) idInput.value = k.id;
  if (nameInput) nameInput.value = k.name || '';
  if (limitInput) limitInput.value = k.uidLimit !== undefined ? k.uidLimit : (k.maxCalls || 0);
  if (addDaysInput) addDaysInput.value = '';

  if (modal) modal.classList.remove('hidden');
}

function closeEditKeyModal() {
  const modal = document.getElementById('edit-key-modal');
  if (modal) modal.classList.add('hidden');
}

function setupEditKeyForm() {
  const form = document.getElementById('edit-key-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEditKeyId) return;

    const name = document.getElementById('edit-key-name').value;
    const uidLimit = document.getElementById('edit-key-limit').value;
    const additionalDays = document.getElementById('edit-key-add-days').value;
    const btn = document.getElementById('btn-save-key-edit');

    btn.disabled = true;
    btn.innerText = 'Saving...';

    try {
      const res = await fetch(`/api/admin/keys/${currentEditKeyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': getAdminToken()
        },
        body: JSON.stringify({ name, uidLimit, additionalDays })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Key settings updated successfully! ✅');
        closeEditKeyModal();
        loadKeys();
        loadStats();
      } else {
        alert(data.error || 'Failed to update key');
      }
    } catch (err) {
      alert('Network error updating key');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Save Changes';
    }
  });
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeKeyUidsModal();
    closeEditKeyModal();
  }
});

// Toast & Helpers
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast || !toastMsg) return;
  toastMsg.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function copyPlain(text) {
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard! 📋');
}

function copyResultKey() {
  const text = document.getElementById('result-key-text').value;
  navigator.clipboard.writeText(text);
  showToast('Key copied to clipboard! 📋');
}

function copyText(elemId) {
  const el = document.getElementById(elemId);
  if (el) {
    const val = (el.value !== undefined && el.value !== '') ? el.value : el.innerText;
    navigator.clipboard.writeText(val);
    showToast('Copied to clipboard! 📋');
  }
}

function copySnippet(elemId) {
  const el = document.getElementById(elemId);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
    showToast('Code snippet copied! 📋');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// ADMIN SCROLL PROGRESS & CARD SPOTLIGHT
// ==========================================
function setupAdminAnimations() {
  const progressBar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, scrollPercent))}%`;
    }
  }, { passive: true });

  // Spotlight Cursor Tracking for Admin Cards
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.spotlight-card');
    if (card) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    }
  });
}
