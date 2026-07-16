(function () {
  'use strict';

  const STYLE_ID = 'gmgn-main-screen-ui-cleanup-style';
  const CLEANUP_RUN_DELAYS_MS = [0, 800, 2000, 4500];
  const IDLE_TIMEOUT_MS = 1200;
  let cachedSettings = { hideGmgnHeaderActions: true };

  function isGmgnHost() {
    return /(^|\.)gmgn\.ai$/i.test(window.location.hostname);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-gmgn-main-screen-hidden="1"] {
        display: none !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function loadSettings(callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      callback({ hideGmgnHeaderActions: true });
      return;
    }
    chrome.runtime.sendMessage({ type: 'gmgn-main-screen-get-settings' }, (response) => {
      callback(response?.settings || { hideGmgnHeaderActions: true });
    });
  }

  function requestIdle(callback) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
      return;
    }
    window.setTimeout(callback, 100);
  }

  function getTopChromeRoots() {
    const roots = Array.from(document.querySelectorAll('header, nav, [role="navigation"]'));
    return roots.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect && rect.top <= 180 && rect.height <= 260;
    });
  }

  function queryTopChromeElements(selector) {
    const seen = new Set();
    const matches = [];

    for (const root of getTopChromeRoots()) {
      const candidates = [];
      if (root.matches(selector)) {
        candidates.push(root);
      }
      candidates.push(...root.querySelectorAll(selector));

      for (const element of candidates) {
        if (!seen.has(element)) {
          seen.add(element);
          matches.push(element);
        }
      }
    }

    return matches;
  }

  function cleanupHeaderActions(settings) {
    if (!settings.hideGmgnHeaderActions) {
      return;
    }
    cleanupWorldCupNavigationItem();
    const selectors = [
      'button[aria-label*="Telegram" i]',
      'button[aria-label*="Twitter" i]',
      'button[aria-label*="X" i]',
      'a[href*="t.me"]',
      'a[href*="twitter.com"]',
      'a[href*="x.com"]'
    ];
    for (const selector of selectors) {
      for (const element of queryTopChromeElements(selector)) {
        if (isLikelyHeaderElement(element)) {
          element.setAttribute('data-gmgn-main-screen-hidden', '1');
        }
      }
    }
  }

  function isLikelyHeaderElement(element) {
    const rect = element.getBoundingClientRect();
    if (!rect || rect.top > 140 || rect.width > 220 || rect.height > 80) {
      return false;
    }
    const text = String(element.textContent || element.getAttribute('aria-label') || '').trim();
    return !text || /telegram|twitter|^x$/i.test(text);
  }

  function cleanupWorldCupNavigationItem() {
    const selectors = [
      'nav a',
      'nav button',
      'nav [role="link"]',
      'nav [role="button"]',
      'header a',
      'header button',
      '[role="navigation"] a',
      '[role="navigation"] button'
    ];
    for (const element of queryTopChromeElements(selectors.join(', '))) {
      if (!isLikelyWorldCupNavItem(element)) {
        continue;
      }
      const target = element.closest('li, [role="listitem"], a, button') || element;
      target.setAttribute('data-gmgn-main-screen-hidden', '1');
    }
  }

  function isLikelyWorldCupNavItem(element) {
    const rect = element.getBoundingClientRect();
    if (!rect || rect.top > 140 || rect.width > 260 || rect.height > 90) {
      return false;
    }

    const label = [
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('href')
    ].filter(Boolean).join(' ');

    return /世界杯|世界盃|world\s*cup|worldcup/i.test(label);
  }

  function run() {
    ensureStyle();
    cleanupHeaderActions(cachedSettings);
  }

  function scheduleRun(delayMs) {
    window.setTimeout(() => {
      requestIdle(run);
    }, delayMs);
  }

  if (!isGmgnHost()) {
    return;
  }

  loadSettings((settings) => {
    cachedSettings = settings;
    for (const delayMs of CLEANUP_RUN_DELAYS_MS) {
      scheduleRun(delayMs);
    }
  });
})();
