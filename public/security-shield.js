/**
 * HOMBRE MILITARY-GRADE ANTI-INSPECT & ANTI-TAMPER SECURITY SHIELD
 * 
 * Protects application against:
 * - Developer Tools (F12, Inspect, Console, DOM explorer)
 * - View-Source (Ctrl+U / Cmd+U)
 * - Save-Page / Print-Page exploitation
 * - Context menu right-click interception
 * - Console tampering & variable extraction
 * - Text scraping & element dragging
 * 
 * *Special bypass reserved for Admin shortcut: Ctrl + Alt + V
 */

(function () {
  'use strict';

  // State
  let devtoolsDetected = false;
  let devtoolsOverlay = null;

  // 1. DISABLE CONTEXT MENU (RIGHT-CLICK)
  document.addEventListener('contextmenu', (e) => {
    // Check if clicking inside an allowed input field where pasting might happen
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      // Allow or restrict as preferred; usually right-click is fully disabled
    }
    e.preventDefault();
    showSecurityWarning('Right-click context menu is strictly disabled on this terminal.');
    return false;
  }, { capture: true });

  // 2. BLOCK SNOOPING & DEVTOOLS SHORTCUTS
  window.addEventListener('keydown', (e) => {
    // Preserve HOMBRE Admin Vault shortcut: Ctrl + Alt + V (or Cmd + Alt + V)
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'V' || e.key === 'v' || e.code === 'KeyV' || e.keyCode === 86)) {
      return; // ALLOW admin vault shortcut
    }

    // F12 key
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsLockdown();
      return false;
    }

    // Ctrl+Shift+I / Cmd+Alt+I (Inspect Element)
    if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73))) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsLockdown();
      return false;
    }

    // Ctrl+Shift+J / Cmd+Alt+J (Console)
    if ((e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) ||
        (e.metaKey && e.altKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74))) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsLockdown();
      return false;
    }

    // Ctrl+Shift+C / Cmd+Shift+C (Inspect DOM Element)
    if ((e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) ||
        (e.metaKey && e.altKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67))) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsLockdown();
      return false;
    }

    // Ctrl+Shift+K (Firefox DevTools Console)
    if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k' || e.keyCode === 75)) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsLockdown();
      return false;
    }

    // Ctrl+U / Cmd+U (View Page Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      showSecurityWarning('Viewing page source is restricted by security policy.');
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
      e.preventDefault();
      e.stopPropagation();
      showSecurityWarning('Saving page assets is blocked.');
      return false;
    }

    // Ctrl+P / Cmd+P (Print / PDF Page Inspection)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.keyCode === 80)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. DISABLE DRAG AND DROP EXPLOITATION
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 4. CONSOLE NEUTRALIZATION & ANTI-DEBUGGER DEFENSE
  function secureConsole() {
    const banner = () => {
      try {
        console.clear();
        console.log(
          '%c⚠️ HOMBRE SECURITY SHIELD ACTIVE ⚠️\n%cUnauthorized inspection, reverse-engineering, or tampering with this gateway is strictly forbidden.\nAll client requests are authenticated and cryptographically verified on the backend.',
          'color: #ff3344; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px rgba(255,51,68,0.5);',
          'color: #94a3b8; font-size: 13px; font-family: monospace; line-height: 1.6;'
        );
      } catch (err) {}
    };

    // Periodic clearing and defense banner
    setInterval(banner, 1800);
    banner();

    // Prevent console debugging tampering
    const noop = function () {};
    ['debug', 'info', 'table', 'dir', 'trace'].forEach(method => {
      try {
        if (window.console && window.console[method]) {
          window.console[method] = noop;
        }
      } catch (e) {}
    });
  }
  secureConsole();

  // 5. DEVTOOLS OPEN DETECTION & SCREEN LOCKDOWN
  function createLockdownOverlay() {
    if (devtoolsOverlay) return;
    devtoolsOverlay = document.createElement('div');
    devtoolsOverlay.id = 'hombre-security-lockdown';
    devtoolsOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 7, 13, 0.98);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      z-index: 999999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    `;

    devtoolsOverlay.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 0 35px rgba(239, 68, 68, 0.3);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h2 style="font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 12px; letter-spacing: 0.5px;">INSPECTION PROTOCOL BLOCKED</h2>
      <p style="font-size: 14px; color: #94a3b8; max-width: 460px; line-height: 1.6; margin-bottom: 24px;">
        Developer Tools and DOM inspection have been detected. For endpoint security and air-gapped system protection, the interface is locked.
      </p>
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px 20px; font-family: monospace; font-size: 12px; color: #38bdf8;">
        🔒 Close Developer Tools / Inspector to restore interface
      </div>
    `;

    document.body.appendChild(devtoolsOverlay);
  }

  function removeLockdownOverlay() {
    if (devtoolsOverlay && devtoolsOverlay.parentNode) {
      devtoolsOverlay.parentNode.removeChild(devtoolsOverlay);
      devtoolsOverlay = null;
    }
  }

  function triggerDevToolsLockdown() {
    devtoolsDetected = true;
    createLockdownOverlay();
  }

  // Active DevTools window dimension & debugger detector
  function checkDevTools() {
    // Avoid false positives on touch/mobile devices
    if (navigator.maxTouchPoints > 1 || window.innerWidth <= 768) return;

    const widthThreshold = (window.outerWidth - window.innerWidth) > 220;
    const heightThreshold = (window.outerHeight - window.innerHeight) > 220;

    if (widthThreshold || heightThreshold) {
      if (!devtoolsDetected) {
        triggerDevToolsLockdown();
      }
    } else {
      if (devtoolsDetected) {
        devtoolsDetected = false;
        removeLockdownOverlay();
      }
    }
  }

  window.addEventListener('resize', checkDevTools);
  setInterval(checkDevTools, 1200);

  // 6. TIMED DEBUGGER TRAP (Interrupts step execution in devtools)
  setInterval(() => {
    if (navigator.maxTouchPoints > 1) return;
    const startTime = performance.now();
    try {
      (function () {}['constructor']('debugger')());
    } catch (e) {}
    const duration = performance.now() - startTime;
    if (duration > 350) {
      triggerDevToolsLockdown();
    }
  }, 2500);

  // 7. TOAST NOTIFICATION FOR BLOCKED ACTIONS
  function showSecurityWarning(message) {
    let toast = document.getElementById('hombre-security-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hombre-security-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-left: 4px solid #ef4444;
        color: #f8fafc;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.2);
        z-index: 99999999;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: opacity 0.3s ease, transform 0.3s ease;
        transform: translateY(20px);
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;

    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    if (window._securityToastTimer) clearTimeout(window._securityToastTimer);
    window._securityToastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 2800);
  }

  // 8. DISABLE SELECTION ON NON-INPUT ELEMENTS
  const style = document.createElement('style');
  style.innerHTML = `
    body, html {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
    input, textarea, [contenteditable="true"], .selectable, code, pre {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);

})();
