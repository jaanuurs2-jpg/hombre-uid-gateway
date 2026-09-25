// HOMBRE Public Landing Page Logic & Secret Shortcut Listener

const RENDER_PROD_URL = 'https://hombre-uid-gateway.onrender.com';
const BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.origin.startsWith('http'))
  ? RENDER_PROD_URL
  : window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  setupSecretKeyboardShortcut();
  setupSecretLoginForm();
  populatePublicCodeSnippets();
  setupScrollAnimations();
  setupCardSpotlight();
  setupSmoothNavigation();
});

// ==========================================
// SECRET COMMAND LISTENER:
// 1. Hotkey: Ctrl + Alt + V (Mac: Cmd + Alt + V)
// 2. Secret typed command: Type "admin" or "vault" anywhere on page
// ==========================================
function setupSecretKeyboardShortcut() {
  let typedBuffer = '';
  let clearTimer = null;

  document.addEventListener('keydown', (e) => {
    // Escape key closes modal
    if (e.key === 'Escape') {
      closeAdminModal();
      return;
    }

    // 1. Hotkey: Ctrl + Alt + V (Mac: Cmd + Alt + V)
    const isModifier = e.ctrlKey || e.metaKey;
    if (isModifier && e.altKey && (e.key === 'V' || e.key === 'v' || e.code === 'KeyV' || e.keyCode === 86)) {
      e.preventDefault();
      e.stopPropagation();
      openAdminModal();
      return;
    }

    // Don't capture typed characters if typing in an input
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    // 2. Secret word typing: "admin", "vault", "hombre"
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      typedBuffer += e.key.toLowerCase();
      if (typedBuffer.length > 20) typedBuffer = typedBuffer.slice(-20);

      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => { typedBuffer = ''; }, 3000);

      if (typedBuffer.endsWith('admin') || typedBuffer.endsWith('vault') || typedBuffer.endsWith('hombre')) {
        typedBuffer = '';
        openAdminModal();
      }
    }
  });
}

function openAdminModal() {
  const modal = document.getElementById('admin-secret-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('secret-admin-pass');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 150);
    }
    const errBox = document.getElementById('secret-login-error');
    if (errBox) errBox.classList.add('hidden');
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-secret-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Close modal when clicking outside box
window.addEventListener('click', (e) => {
  const modal = document.getElementById('admin-secret-modal');
  if (e.target === modal) {
    closeAdminModal();
  }
});

// Secret Admin Login Form Submission
function setupSecretLoginForm() {
  const form = document.getElementById('secret-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passInput = document.getElementById('secret-admin-pass');
    const password = passInput ? passInput.value.trim() : '';
    const btn = document.getElementById('btn-secret-unlock');
    const errorBox = document.getElementById('secret-login-error');

    if (!password) return;

    btn.disabled = true;
    btn.innerText = '⚡ Authenticating...';
    errorBox.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        btn.innerText = '🔓 Access Granted! Redirecting...';
        btn.style.background = '#10b981';
        
        sessionStorage.setItem('hombre_admin_token', data.token);
        localStorage.setItem('hombre_admin_token', data.token);

        setTimeout(() => {
          window.location.href = '/admin';
        }, 600);
      } else {
        errorBox.innerText = `❌ ${data.error || 'Access Denied: Incorrect Passcode'}`;
        errorBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerText = '🔓 Unlock Admin Terminal';
        passInput.select();
      }
    } catch (err) {
      errorBox.innerText = '❌ Failed to reach authentication server.';
      errorBox.classList.remove('hidden');
      btn.disabled = false;
      btn.innerText = '🔓 Unlock Admin Terminal';
    }
  });
}

// ==========================================
// PUBLIC LIVE DEMO TESTER
// ==========================================
async function runPublicDemoTest() {
  const keyInput = document.getElementById('demo-key-input');
  const uidInput = document.getElementById('demo-uid-input');
  const daysInput = document.getElementById('demo-days-input');
  const nameInput = document.getElementById('demo-name-input');

  const statusBadge = document.getElementById('demo-status-badge');
  const timeBadge = document.getElementById('demo-time-badge');
  const outputBox = document.getElementById('demo-output-box');

  const key = keyInput ? keyInput.value.trim() : '';
  const uid = uidInput ? uidInput.value.trim() : '';
  const days = parseInt(daysInput.value, 10) || 30;
  const name = nameInput ? nameInput.value.trim() : 'DemoUser';

  if (!key) {
    alert('Please enter your HOMBRE API key (e.g. HOMBRE-XXXX). If you are the admin, use Ctrl+Shift+V to generate one.');
    if (keyInput) keyInput.focus();
    return;
  }

  statusBadge.className = 'badge badge-neutral';
  statusBadge.innerText = 'Status: Forwarding...';
  outputBox.innerHTML = `<code>Sending payload to ${RENDER_PROD_URL}/api/v1/uids/add ...</code>`;

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

    outputBox.innerHTML = `<code>${escapeHtml(JSON.stringify(data, null, 2))}</code>`;
  } catch (err) {
    statusBadge.className = 'badge badge-danger';
    statusBadge.innerText = 'Network Error';
    outputBox.innerHTML = `<code>Error: ${escapeHtml(err.message)}</code>`;
  }
}

// ==========================================
// CODE INTEGRATION TABS & PREVIEWS
// ==========================================
function switchPublicCodeTab(type) {
  document.querySelectorAll('.code-tab-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.code-box-display').forEach(b => {
    b.classList.add('hidden');
    b.classList.remove('active');
  });

  if (event && event.target) event.target.classList.add('active');
  const target = document.getElementById(`pcode-${type}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
}

function populatePublicCodeSnippets() {
  const endpoint = `${RENDER_PROD_URL}/api/v1/uids/add`;
  const sampleKey = 'HOMBRE-YOUR-KEY-HERE';

  // PHP
  const php = `<?php
$ch = curl_init('${endpoint}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'X-AUTH-KEY: ${sampleKey}',
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
  const python = `import requests

url = "${endpoint}"
headers = {
    "Content-Type": "application/json",
    "X-AUTH-KEY": "${sampleKey}"
}
payload = {
    "uid": "123456789",
    "days": 30,
    "name": "MyUID"
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Response:", response.json())`;

  // JavaScript
  const js = `async function addUID() {
  const response = await fetch('${endpoint}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-KEY': '${sampleKey}'
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
  const curl = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-AUTH-KEY: ${sampleKey}" \\
  -d '{"uid":"123456789","days":30,"name":"MyUID"}'`;

  const elPhp = document.getElementById('pcode-php-content');
  const elPy = document.getElementById('pcode-python-content');
  const elJs = document.getElementById('pcode-js-content');
  const elCurl = document.getElementById('pcode-curl-content');

  if (elPhp) elPhp.innerText = php;
  if (elPy) elPy.innerText = python;
  if (elJs) elJs.innerText = js;
  if (elCurl) elCurl.innerText = curl;
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
// SCROLL PROGRESS & REVEAL ANIMATIONS
// ==========================================
function setupScrollAnimations() {
  const progressBar = document.getElementById('scroll-progress');
  const header = document.querySelector('.landing-header');

  // 1. Scroll Progress Bar & Sticky Header Elevation
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, scrollPercent))}%`;
    }

    if (header) {
      if (scrollTop > 25) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  }, { passive: true });

  // 2. IntersectionObserver for Scroll Reveals
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');

          // Trigger counter animation if it's the metrics strip
          if (entry.target.classList.contains('metrics-strip')) {
            animateLatencyMetric();
          }

          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.12
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback for older browsers
    revealElements.forEach(el => el.classList.add('is-visible'));
  }
}

// Dynamic Counter Animation for Latency Metric
function animateLatencyMetric() {
  const el = document.getElementById('metric-latency');
  if (!el) return;

  const target = 38;
  let current = 99;
  const duration = 900;
  const stepTime = 25;
  const steps = duration / stepTime;
  const decrement = (current - target) / steps;

  const timer = setInterval(() => {
    current -= decrement;
    if (current <= target) {
      current = target;
      clearInterval(timer);
      el.innerText = `< ${target} ms`;
    } else {
      el.innerText = `< ${Math.round(current)} ms`;
    }
  }, stepTime);
}

// 3. Card Spotlight Cursor Tracking
function setupCardSpotlight() {
  const cards = document.querySelectorAll('.spotlight-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

// 4. Smooth Anchor Link Scrolling
function setupSmoothNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
}
