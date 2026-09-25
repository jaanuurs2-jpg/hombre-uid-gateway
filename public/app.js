// HOMBRE API Gateway Client Logic

let currentKeys = [];
const RENDER_PROD_URL = 'https://hombre-uid-gateway.onrender.com';
const BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.origin.startsWith('http'))
  ? RENDER_PROD_URL
  : window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupForms();
  loadStats();
  loadKeys();
  loadLogs();
  updatePublicUrlDisplay();

  // Search filter for keys table
  const searchInput = document.getElementById('key-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterKeysTable(e.target.value);
    });
  }
});

function updatePublicUrlDisplay() {
  const el = document.getElementById('display-public-url');
  if (el) {
    el.innerText = `${RENDER_PROD_URL}/api/v1/uids/add`;
  }
}

// ================= Tab Navigation =================
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

// ================= Forms Handling =================
function setupForms() {
  // Quick Generator Form
  const quickForm = document.getElementById('quick-gen-form');
  if (quickForm) {
    quickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('quick-name').value;
      const prefix = document.getElementById('quick-prefix').value;
      const days = document.getElementById('quick-days').value;
      const maxCalls = document.getElementById('quick-max-calls').value;

      await createKey({ name, prefix, days, maxCalls });
      quickForm.reset();
      document.getElementById('quick-prefix').value = 'HOMBRE';
    });
  }

  // Full Custom Generator Form
  const fullForm = document.getElementById('full-gen-form');
  if (fullForm) {
    fullForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('gen-name').value;
      const prefix = document.getElementById('gen-prefix').value;
      const days = document.getElementById('gen-days').value;
      const maxCalls = document.getElementById('gen-max-calls').value;
      const customKey = document.getElementById('gen-custom-key').value;

      const newKey = await createKey({ name, prefix, days, maxCalls, customKey });
      if (newKey) {
        const resultBox = document.getElementById('gen-result-box');
        const resultText = document.getElementById('result-key-text');
        resultText.value = newKey.key;
        resultBox.classList.remove('hidden');
      }
    });
  }
}

// ================= API Calls =================

// 1. Load Stats
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('stat-total-keys').innerText = data.totalKeys;
    document.getElementById('stat-active-keys').innerText = data.activeKeys;
    document.getElementById('stat-total-requests').innerText = data.totalRequests;

    if (data.totalRequests > 0) {
      const rate = Math.round((data.successfulRequests / data.totalRequests) * 100);
      document.getElementById('stat-success-rate').innerText = `${rate}%`;
    } else {
      document.getElementById('stat-success-rate').innerText = `100%`;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// 2. Load Keys
async function loadKeys() {
  try {
    const res = await fetch('/api/admin/keys');
    if (!res.ok) return;
    currentKeys = await res.json();
    renderKeysTable(currentKeys);
    populateKeySelects(currentKeys);
    updateCodeSnippets();
  } catch (err) {
    console.error('Failed to load keys:', err);
  }
}

// 3. Create Key
async function createKey(payload) {
  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// 4. Toggle Key Active / Paused
async function toggleKey(id) {
  try {
    const res = await fetch(`/api/admin/keys/${id}/toggle`, { method: 'PATCH' });
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

// 5. Delete Key
async function deleteKey(id) {
  if (!confirm('Are you sure you want to revoke and delete this key? Clients using it will immediately be blocked.')) {
    return;
  }
  try {
    const res = await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
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

// 6. Render Keys Table
function renderKeysTable(keys) {
  const tbody = document.getElementById('keys-table-body');
  if (!tbody) return;

  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No API keys found. Generate one above!</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map(k => {
    // Status calculation
    let statusBadge = '<span class="badge badge-success">Active</span>';
    const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
    const isQuotaExceeded = k.maxCalls > 0 && k.usageCount >= k.maxCalls;

    if (!k.isActive) {
      statusBadge = '<span class="badge badge-warning">Paused</span>';
    } else if (isExpired) {
      statusBadge = '<span class="badge badge-danger">Expired</span>';
    } else if (isQuotaExceeded) {
      statusBadge = '<span class="badge badge-danger">Quota Full</span>';
    }

    // Expiry date format
    const expiryStr = k.expiresAt 
      ? new Date(k.expiresAt).toLocaleDateString() 
      : '<span class="badge badge-neutral">Lifetime</span>';

    // Created date
    const createdStr = new Date(k.createdAt).toLocaleDateString();

    // Quota display
    const quotaStr = k.maxCalls > 0 
      ? `<strong>${k.usageCount}</strong> / ${k.maxCalls}`
      : `<strong>${k.usageCount}</strong> (Unlimited)`;

    return `
      <tr>
        <td><strong>${escapeHtml(k.name)}</strong></td>
        <td>
          <span class="key-code">${escapeHtml(k.key)}</span>
        </td>
        <td>${statusBadge}</td>
        <td>${expiryStr}</td>
        <td>${quotaStr}</td>
        <td>${createdStr}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" title="Copy Key" onclick="copyPlain('${escapeHtml(k.key)}')">📋</button>
            <button class="icon-btn" title="Toggle Status" onclick="toggleKey('${k.id}')">${k.isActive ? '⏸️' : '▶️'}</button>
            <button class="icon-btn icon-btn-danger" title="Delete Key" onclick="deleteKey('${k.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterKeysTable(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderKeysTable(currentKeys);
    return;
  }
  const filtered = currentKeys.filter(k => 
    k.key.toLowerCase().includes(q) || 
    (k.name && k.name.toLowerCase().includes(q))
  );
  renderKeysTable(filtered);
}

// 7. Populate Select Dropdowns
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

// ================= LIVE TESTER =================
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
  jsonBox.innerHTML = `<code>Sending request to ${RENDER_PROD_URL}/api/v1/uids/add ...</code>`;

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
    
    // Refresh stats and logs
    loadStats();
    loadKeys();
  } catch (err) {
    statusBadge.className = 'badge badge-danger';
    statusBadge.innerText = 'Network Error';
    jsonBox.innerHTML = `<code>Error: ${escapeHtml(err.message)}</code>`;
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 Send Request (POST /api/v1/uids/add)';
  }
}

// ================= CODE SNIPPETS =================
function switchCodeTab(type) {
  document.querySelectorAll('.code-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.code-display-block').forEach(b => b.classList.remove('active'));

  const btn = event.target;
  if (btn) btn.classList.add('active');

  const block = document.getElementById(`snippet-${type}`);
  if (block) block.classList.add('active');
}

function updateCodeSnippets() {
  const docsSelect = document.getElementById('docs-key-select');
  const selectedKey = (docsSelect && docsSelect.value) ? docsSelect.value : 'HOMBRE-YOUR-KEY-HERE';
  const endpoint = `${RENDER_PROD_URL}/api/v1/uids/add`;

  // PHP
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

  // Python
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

  // JavaScript (Fetch)
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

  // cURL
  const curlCode = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-AUTH-KEY: ${selectedKey}" \\
  -d '{"uid":"123456789","days":30,"name":"MyUID"}'`;

  document.getElementById('code-php').innerText = phpCode;
  document.getElementById('code-python').innerText = pythonCode;
  document.getElementById('code-js').innerText = jsCode;
  document.getElementById('code-curl').innerText = curlCode;
}

// ================= TRAFFIC LOGS =================
async function loadLogs() {
  try {
    const res = await fetch('/api/admin/logs');
    if (!res.ok) return;
    const logs = await res.json();
    renderLogsTable(logs);
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No request logs recorded yet.</td></tr>`;
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
    await fetch('/api/admin/logs', { method: 'DELETE' });
    showToast('Logs cleared');
    loadLogs();
    loadStats();
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

// ================= HELPERS & TOAST =================
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
  showToast('Key copied to clipboard! 📋');
}

function copyResultKey() {
  const text = document.getElementById('result-key-text').value;
  navigator.clipboard.writeText(text);
  showToast('Key copied to clipboard! 📋');
}

function copyText(elemId) {
  const el = document.getElementById(elemId);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
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
