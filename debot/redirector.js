const DEBUG_PREFIX = '[Debot Header Cleanup]';
const STYLE_ID = 'debot-hide-likwid-header-link';
const LIKWID_PATH_RE = /^\/likwid(?:\/|$)/i;
const HEADER_SCOPE_SELECTOR = [
  'header',
  'nav',
  '[role="banner"]',
  '[role="navigation"]',
  '[class*="header" i]',
  '[class*="navbar" i]',
  '[class*="nav" i]'
].join(', ');

injectHideStyle();
initializeLikwidCleanup();

function injectHideStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const parent = document.head || document.documentElement;
  if (!parent) {
    document.addEventListener('DOMContentLoaded', injectHideStyle, { once: true });
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    header a[href*="/likwid"],
    nav a[href*="/likwid"],
    [role="banner"] a[href*="/likwid"],
    [role="navigation"] a[href*="/likwid"],
    [class*="header" i] a[href*="/likwid"],
    [class*="navbar" i] a[href*="/likwid"],
    [class*="nav" i] a[href*="/likwid"] {
      display: none !important;
    }
  `;

  parent.appendChild(style);
}

function initializeLikwidCleanup() {
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
      removeLikwidHeaderButtons();
    });
  };

  const observer = new MutationObserver(scheduleCleanup);

  const attachObserver = () => {
    if (observerAttached || !document.documentElement) {
      return;
    }

    observerAttached = true;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  document.addEventListener('click', blockLikwidHeaderClick, true);
  attachObserver();
  scheduleCleanup();
  cleanupIntervalId = window.setInterval(removeLikwidHeaderButtons, 1500);

  if (!observerAttached) {
    document.addEventListener('DOMContentLoaded', attachObserver, { once: true });
  }

  window.addEventListener(
    'pagehide',
    () => {
      document.removeEventListener('click', blockLikwidHeaderClick, true);
      observer.disconnect();
      if (cleanupIntervalId !== null) {
        window.clearInterval(cleanupIntervalId);
      }
    },
    { once: true }
  );
}

function removeLikwidHeaderButtons() {
  const anchors = document.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    if (!isLikwidLink(anchor) || !isInHeaderScope(anchor)) {
      continue;
    }

    const target = getRemovableTarget(anchor);
    debugLog('Removed /likwid header button.', anchor.href || anchor.getAttribute('href') || '');
    target.remove();
  }
}

function blockLikwidHeaderClick(event) {
  const element = event.target instanceof Element
    ? event.target.closest('a[href], button, [role="button"], [role="link"]')
    : null;
  if (!element || !isInHeaderScope(element)) {
    return;
  }

  const anchor = element.matches('a[href]') ? element : element.querySelector('a[href]');
  if (!anchor || !isLikwidLink(anchor)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  getRemovableTarget(anchor).remove();
  debugLog('Blocked /likwid header click.', anchor.href || anchor.getAttribute('href') || '');
}

function isLikwidLink(anchor) {
  const rawHref = anchor.getAttribute('href') || anchor.href || '';
  if (!rawHref) {
    return false;
  }

  try {
    const parsed = new URL(rawHref, window.location.origin);
    return LIKWID_PATH_RE.test(parsed.pathname);
  } catch (_error) {
    return false;
  }
}

function isInHeaderScope(element) {
  return Boolean(element.closest(HEADER_SCOPE_SELECTOR));
}

function getRemovableTarget(anchor) {
  return anchor.closest('li, [role="listitem"], .item, .menu-item, .nav-item, .navbar-item, button, a') || anchor;
}

function debugLog(message, detail) {
  if (detail) {
    console.info(DEBUG_PREFIX, message, detail);
    return;
  }

  console.info(DEBUG_PREFIX, message);
}
