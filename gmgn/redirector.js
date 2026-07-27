const OPEN_LINK_MESSAGE = 'open-in-main-window';
const MONITOR_SCREEN_LINK_SOURCE = 'gmgn-monitor-screen';
const REGISTER_MONITOR_TAB_MESSAGE = 'register-monitor-tab';
const GET_MONITOR_SCREEN_STATUS_MESSAGE = 'get-monitor-screen-status';
const ALLOW_MONITOR_NAVIGATION_MESSAGE = 'allow-monitor-navigation';
const MONITOR_STATE_STORAGE_KEY = 'monitorState';
const PAGE_OPEN_EVENT = 'gmgn-monitor-open-url';
const MONITOR_SCREEN_BUTTON_ID = 'gcp-monitor-screen-toggle';
const MONITOR_SCREEN_STYLE_ID = 'gcp-monitor-screen-toggle-style';
const PREDICTION_LINK_SELECTOR = 'a[href*="future.news"]';
const COOKING_COMPONENT_SELECTOR = '[data-sentry-component="CookingCoinButton"]';
const COOKING_NAV_TEXT_RE = /\b(cook|cooking)\b/i;
const DEBUG_PREFIX = '[GMGN Monitor Link Redirector]';
const FOLLOW_PATH_RE = /^\/(?:follow(?:\/|$)|(?:sol|eth|bsc|base|tron|blast|robinhood)\/follow(?:\/|$))/i;
let monitorScreenActive = false;
let routeWatcherInstalled = false;

initializeNavigationCleanup();
initializeMonitorRedirect();

function isPrimaryUnmodifiedClick(event) {
  return event.button === 0
    && !event.defaultPrevented
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

function shouldKeepInMonitorWindow(anchor) {
  if (anchor.hasAttribute('download')) {
    return true;
  }

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
    return true;
  }

  return Boolean(anchor.closest('nav, header nav, [role="navigation"], [aria-label*="nav" i], .nav, .navbar, .navigation'));
}

function shouldIgnoreMonitorRedirect(event, anchor) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return true;
  }

  if (target.closest('.gcp-watch-toggle, .gcp-orig-star, .gcp-blacklist-toggle, .gcp-alert-hide-btn, .gcp-mint-tag')) {
    return true;
  }

  if (target.closest('[data-sentry-component*="Edit" i], [data-sentry-component*="Rename" i], [data-sentry-component*="Remark" i]')) {
    return true;
  }

  const interactive = target.closest('button, input, textarea, select, option, label, [contenteditable="true"], [contenteditable=""], [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [aria-haspopup]');
  if (interactive && interactive !== anchor) {
    return true;
  }

  const labelledControl = target.closest('[aria-label], [title]');
  if (labelledControl && labelledControl !== anchor) {
    const label = `${labelledControl.getAttribute('aria-label') || ''} ${labelledControl.getAttribute('title') || ''}`.trim();
    if (/(edit|rename|remark|note|tag|label|修改|编辑|重命名|备注|标记|标签|命名)/i.test(label)) {
      return true;
    }
  }

  const href = anchor.getAttribute('href') || '';
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return true;
  }

  return false;
}

function isExternalToGmgn(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname !== 'gmgn.ai' && !parsed.hostname.endsWith('.gmgn.ai');
  } catch (_error) {
    return false;
  }
}

function normalizeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.href;
  } catch (_error) {
    return null;
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response || null);
      });
    } catch (_error) {
      resolve(null);
    }
  });
}

async function registerMonitorTab() {
  const response = await sendRuntimeMessage({
    type: REGISTER_MONITOR_TAB_MESSAGE,
    url: window.location.href
  });
  monitorScreenActive = !!(response && response.isMonitorScreen);
  updateMonitorScreenButton(response);
  return response;
}

async function refreshMonitorScreenStatus() {
  const response = await sendRuntimeMessage({
    type: GET_MONITOR_SCREEN_STATUS_MESSAGE
  });
  monitorScreenActive = !!(response && response.ok && response.isMonitorScreen);
  updateMonitorScreenButton(response);
  return response;
}

function initializeMonitorRedirect() {
  syncMonitorRedirectForRoute();
  installMonitorRouteWatcher();

  document.addEventListener(
    'click',
    (event) => {
      if (!isFollowPage()) {
        return;
      }

      if (!monitorScreenActive) {
        return;
      }

      if (!isPrimaryUnmodifiedClick(event)) {
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) {
        return;
      }

      if (shouldIgnoreMonitorRedirect(event, anchor)) {
        return;
      }

      if (isPredictionLink(anchor)) {
        suppressEvent(event);
        debugLog('Blocked prediction link click.', anchor.href);
        return;
      }

      const resolvedUrl = normalizeUrl(anchor.href);
      if (!resolvedUrl) {
        return;
      }

      if (isExternalToGmgn(resolvedUrl)) {
        redirectToMainWindow(event, resolvedUrl);
        return;
      }

      if (shouldKeepInMonitorWindow(anchor)) {
        chrome.runtime.sendMessage({
          type: ALLOW_MONITOR_NAVIGATION_MESSAGE,
          url: resolvedUrl
        });
        return;
      }

      redirectToMainWindow(event, resolvedUrl);
    },
    true
  );

  window.addEventListener(PAGE_OPEN_EVENT, (event) => {
    if (!isFollowPage()) {
      return;
    }

    if (!monitorScreenActive) {
      return;
    }

    const customEvent = event;
    const detail = customEvent.detail;
    if (!detail || !detail.url) {
      return;
    }

    const resolvedUrl = normalizeUrl(detail.url);
    if (!resolvedUrl || !isExternalToGmgn(resolvedUrl)) {
      return;
    }

    void handoffLinkToMainWindow(resolvedUrl);
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[MONITOR_STATE_STORAGE_KEY]) {
        return;
      }

      if (isFollowPage()) {
        ensureMonitorScreenButtonWhenReady();
        void refreshMonitorScreenStatus();
      }
    });
  }
}

function syncMonitorRedirectForRoute() {
  if (isFollowPage()) {
    ensureMonitorScreenButtonWhenReady();
    void refreshMonitorScreenStatus();
    return;
  }

  monitorScreenActive = false;
  removeMonitorScreenButton();
}

function installMonitorRouteWatcher() {
  if (routeWatcherInstalled) {
    return;
  }

  routeWatcherInstalled = true;
  const syncAfterNavigation = () => queueMicrotask(syncMonitorRedirectForRoute);
  const nativePushState = history.pushState;
  const nativeReplaceState = history.replaceState;

  history.pushState = function patchedMonitorPushState(...args) {
    const result = nativePushState.apply(this, args);
    syncAfterNavigation();
    return result;
  };

  history.replaceState = function patchedMonitorReplaceState(...args) {
    const result = nativeReplaceState.apply(this, args);
    syncAfterNavigation();
    return result;
  };

  window.addEventListener('popstate', syncMonitorRedirectForRoute);
  window.addEventListener('hashchange', syncMonitorRedirectForRoute);
}

function ensureMonitorScreenButtonWhenReady() {
  if (!isFollowPage()) {
    return;
  }

  if (document.body) {
    ensureMonitorScreenButton();
    return;
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      if (isFollowPage()) {
        ensureMonitorScreenButton();
      }
    },
    { once: true }
  );
}

function ensureMonitorScreenButton() {
  if (!document.body || document.getElementById(MONITOR_SCREEN_BUTTON_ID)) {
    return;
  }

  ensureMonitorScreenButtonStyle();

  const button = document.createElement('button');
  button.id = MONITOR_SCREEN_BUTTON_ID;
  button.type = 'button';
  button.textContent = '\u8bbe\u4e3a\u76d1\u63a7\u5c4f';
  button.title = '\u628a\u5f53\u524d Chrome \u7a97\u53e3\u8bbe\u4e3a GMGN \u76d1\u63a7\u5c4f';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.disabled = true;
    try {
      await registerMonitorTab();
    } finally {
      button.disabled = false;
    }
  });

  document.body.appendChild(button);
}

function removeMonitorScreenButton() {
  const button = document.getElementById(MONITOR_SCREEN_BUTTON_ID);
  if (button) {
    button.remove();
  }
}

function ensureMonitorScreenButtonStyle() {
  if (document.getElementById(MONITOR_SCREEN_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = MONITOR_SCREEN_STYLE_ID;
  style.textContent = `
    #${MONITOR_SCREEN_BUTTON_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.92);
      color: #e5e7eb;
      cursor: pointer;
      font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 9px 12px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }
    #${MONITOR_SCREEN_BUTTON_ID}.is-active {
      border-color: rgba(34, 197, 94, 0.8);
      background: rgba(20, 83, 45, 0.94);
      color: #dcfce7;
    }
    #${MONITOR_SCREEN_BUTTON_ID}:disabled {
      cursor: wait;
      opacity: 0.72;
    }
  `;
  document.documentElement.appendChild(style);
}

function updateMonitorScreenButton(status) {
  const button = document.getElementById(MONITOR_SCREEN_BUTTON_ID);
  if (!button) {
    return;
  }

  const active = !!(status && status.ok && status.isMonitorScreen);
  button.classList.toggle('is-active', active);
  button.textContent = active
    ? '\u5df2\u8bbe\u4e3a\u76d1\u63a7\u5c4f'
    : '\u8bbe\u4e3a\u76d1\u63a7\u5c4f';
  button.title = active
    ? '\u5f53\u524d Chrome \u7a97\u53e3\u5df2\u662f GMGN \u76d1\u63a7\u5c4f'
    : '\u628a\u5f53\u524d Chrome \u7a97\u53e3\u8bbe\u4e3a GMGN \u76d1\u63a7\u5c4f';
}

function redirectToMainWindow(event, url) {
  suppressEvent(event);
  void handoffLinkToMainWindow(url);
}

async function handoffLinkToMainWindow(url) {
  const response = await sendRuntimeMessage({
    type: OPEN_LINK_MESSAGE,
    url,
    source: MONITOR_SCREEN_LINK_SOURCE,
    sourceOrigin: window.location.origin,
    allowAnyHttpUrl: true
  });
  if (response && response.ok) {
    return true;
  }

  // Fail open: the background tab-navigation guard will hand this URL to the
  // main screen and restore the monitor route. This also recovers stale content
  // scripts after an extension reload instead of leaving every link inert.
  window.location.assign(url);
  return false;
}

function initializeNavigationCleanup() {
  let scheduled = false;
  let observerAttached = false;
  let cleanupIntervalId = null;

  const scheduleCleanup = () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      removeUndesiredNavigationItems();
    });
  };

  const observer = new MutationObserver(() => {
    scheduleCleanup();
  });

  const attachObserver = () => {
    if (observerAttached || !document.documentElement) {
      return;
    }

    observerAttached = true;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  attachObserver();
  scheduleCleanup();
  cleanupIntervalId = window.setInterval(removeUndesiredNavigationItems, 1500);

  if (!observerAttached) {
    document.addEventListener('DOMContentLoaded', attachObserver, { once: true });
  }

  window.addEventListener(
    'pagehide',
    () => {
      if (cleanupIntervalId !== null) {
        window.clearInterval(cleanupIntervalId);
      }
    },
    { once: true }
  );
}

function removeUndesiredNavigationItems() {
  removePredictionNavigationItems();
  removeCookingComponentItems();
  removeCookingNavigationItems();
}

function removePredictionNavigationItems() {
  const predictionLinks = document.querySelectorAll(PREDICTION_LINK_SELECTOR);

  if (predictionLinks.length > 0) {
    debugLog(`Found ${predictionLinks.length} prediction link(s).`);
  }

  for (const element of predictionLinks) {
    removeNavigationItem(element, 'prediction navigation item');
  }
}

function removeCookingComponentItems() {
  const cookingComponents = document.querySelectorAll(COOKING_COMPONENT_SELECTOR);

  if (cookingComponents.length > 0) {
    debugLog(`Found ${cookingComponents.length} CookingCoinButton component(s).`);
  }

  for (const element of cookingComponents) {
    const detail = element.textContent.replace(/\s+/g, ' ').trim() || 'CookingCoinButton';
    debugLog('Removed CookingCoinButton component.', detail);
    element.remove();
  }
}

function removeCookingNavigationItems() {
  const seenTargets = new Set();
  const candidateSelectors = [
    'nav a[href]',
    'nav button',
    'nav [role="button"]',
    'nav [role="link"]',
    'header nav a[href]',
    'header nav button',
    '[role="navigation"] a[href]',
    '[role="navigation"] button',
    '.nav a[href]',
    '.nav button',
    '.navbar a[href]',
    '.navbar button',
    '.navigation a[href]',
    '.navigation button'
  ];

  for (const element of document.querySelectorAll(candidateSelectors.join(', '))) {
    if (!matchesCookingNavigationItem(element)) {
      continue;
    }

    const target = element.closest('li, [role="listitem"], .item, .menu-item, .nav-item, .navbar-item, button, a') || element;
    if (seenTargets.has(target)) {
      continue;
    }

    seenTargets.add(target);
    removeNavigationItem(element, 'cook navigation item');
  }
}

function matchesCookingNavigationItem(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  const text = element.textContent.replace(/\s+/g, ' ').trim();
  if (!text) {
    return false;
  }

  return COOKING_NAV_TEXT_RE.test(text);
}

function removeNavigationItem(element, label = 'navigation item') {
  const removableContainer = element.closest('li, [role="listitem"], .item, .menu-item, .nav-item, .navbar-item, button, a');
  const target = removableContainer || element;
  const detail = element.href || element.textContent.replace(/\s+/g, ' ').trim();
  debugLog(`Removed ${label}.`, detail);
  target.remove();
}

function isPredictionLink(anchor) {
  return anchor.matches(PREDICTION_LINK_SELECTOR);
}

function isFollowPage() {
  return FOLLOW_PATH_RE.test(window.location.pathname);
}

function suppressEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function debugLog(message, detail) {
  if (detail) {
    console.info(DEBUG_PREFIX, message, detail);
    return;
  }

  console.info(DEBUG_PREFIX, message);
}
