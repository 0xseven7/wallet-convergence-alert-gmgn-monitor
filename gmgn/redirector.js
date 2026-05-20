const OPEN_LINK_MESSAGE = 'open-in-main-window';
const REGISTER_MONITOR_TAB_MESSAGE = 'register-monitor-tab';
const ALLOW_MONITOR_NAVIGATION_MESSAGE = 'allow-monitor-navigation';
const PAGE_OPEN_EVENT = 'gmgn-monitor-open-url';
const PREDICTION_LINK_SELECTOR = 'a[href*="future.news"]';
const COOKING_COMPONENT_SELECTOR = '[data-sentry-component="CookingCoinButton"]';
const COOKING_NAV_TEXT_RE = /\b(cook|cooking)\b/i;
const DEBUG_PREFIX = '[GMGN Monitor Link Redirector]';
const FOLLOW_PATH_RE = /^\/(?:follow(?:\/|$)|(?:sol|eth|bsc|base|tron|blast)\/follow(?:\/|$))/i;

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

function registerMonitorTab() {
  chrome.runtime.sendMessage({
    type: REGISTER_MONITOR_TAB_MESSAGE,
    url: window.location.href
  });
}

function initializeMonitorRedirect() {
  if (!isFollowPage()) {
    return;
  }

  registerMonitorTab();

  document.addEventListener(
    'click',
    (event) => {
      if (!isFollowPage()) {
        return;
      }

      if (!isPrimaryUnmodifiedClick(event)) {
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) {
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

    const customEvent = event;
    const detail = customEvent.detail;
    if (!detail || !detail.url) {
      return;
    }

    const resolvedUrl = normalizeUrl(detail.url);
    if (!resolvedUrl || !isExternalToGmgn(resolvedUrl)) {
      return;
    }

    chrome.runtime.sendMessage({
      type: OPEN_LINK_MESSAGE,
      url: resolvedUrl
    });
  });
}

function redirectToMainWindow(event, url) {
  suppressEvent(event);

  chrome.runtime.sendMessage({
    type: OPEN_LINK_MESSAGE,
    url
  });
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
