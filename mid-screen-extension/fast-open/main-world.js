(() => {
  'use strict';

  const CHANNEL = 'gmgn-main-screen-fast-open';
  const NAVIGATE_EVENT = `${CHANNEL}:navigate`;
  const RESULT_EVENT = `${CHANNEL}:result`;
  const CAPTURE_EVENT = `${CHANNEL}:capture`;
  const host = location.hostname.toLowerCase();
  const isGmgnPage = host === 'gmgn.ai' || host.endsWith('.gmgn.ai');

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.channel !== CHANNEL || event.data?.type !== NAVIGATE_EVENT) {
      return;
    }
    const requestId = String(event.data.requestId || '');
    const href = normalizeFastUrl(event.data.href);
    if (!requestId || !href || !isSameFastSite(location.href, href)) {
      postResult(requestId, false, 'blocked');
      return;
    }
    void navigateWithinShell(href).then((result) => {
      postResult(requestId, result.ok, result.reason);
    });
  });

  if (isGmgnPage && !window.__gmgnMainScreenFastOpenInstalled) {
    window.__gmgnMainScreenFastOpenInstalled = true;
    const nativeOpen = window.open.bind(window);
    window.open = function fastOpenWindow(url, target, features) {
      const href = resolveUrl(url);
      if (!isCapturableFromGmgn(href)) {
        return nativeOpen(url, target, features);
      }
      window.postMessage({
        channel: CHANNEL,
        type: CAPTURE_EVENT,
        href
      }, location.origin);
      return null;
    };

    document.addEventListener('click', (event) => {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0) {
        return;
      }
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || !(anchor.target === '_blank' || event.ctrlKey || event.metaKey)) {
        return;
      }
      const href = resolveUrl(anchor.href);
      if (!isCapturableFromGmgn(href)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      window.postMessage({
        channel: CHANNEL,
        type: CAPTURE_EVENT,
        href
      }, location.origin);
    }, true);
  }

  async function navigateWithinShell(href) {
    if (sameRoute(location.href, href)) {
      return { ok: true, reason: 'already-open' };
    }

    const documentBefore = document;
    const fingerprintBefore = pageFingerprint();
    const matchingLink = findMatchingLink(href);
    if (matchingLink) {
      matchingLink.click();
      if (await waitForNavigation(href, documentBefore, fingerprintBefore, 900)) {
        return { ok: true, reason: 'internal-link' };
      }
    }

    try {
      history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      if (await waitForNavigation(href, documentBefore, fingerprintBefore, 900)) {
        return { ok: true, reason: 'spa-history' };
      }
    } catch (_error) {
      // The service worker performs a normal tab navigation below.
    }
    return { ok: false, reason: 'shell-did-not-render' };
  }

  function findMatchingLink(href) {
    const targetKey = routeKey(href);
    for (const anchor of document.querySelectorAll('a[href]')) {
      const candidate = resolveUrl(anchor.getAttribute('href'));
      if (candidate && routeKey(candidate) === targetKey && isSameFastSite(candidate, href)) {
        return anchor;
      }
    }
    return null;
  }

  function waitForNavigation(href, documentBefore, fingerprintBefore, timeoutMs) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        const routeArrived = sameRoute(location.href, href);
        const shellChanged = document !== documentBefore || pageFingerprint() !== fingerprintBefore;
        if (routeArrived && shellChanged) {
          resolve(true);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(check, 45);
      };
      check();
    });
  }

  function pageFingerprint() {
    const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    return `${document.title}|${String(main?.textContent || '').trim().slice(0, 180)}`;
  }

  function postResult(requestId, ok, reason) {
    window.postMessage({
      channel: CHANNEL,
      type: RESULT_EVENT,
      requestId,
      ok: Boolean(ok),
      reason: String(reason || '')
    }, location.origin);
  }

  function normalizeFastUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ''), location.href);
      if (url.protocol !== 'https:') {
        return '';
      }
      if (isXHost(url.hostname)) {
        url.hostname = 'x.com';
        return url.toString();
      }
      if (isGmgnHost(url.hostname)) {
        return url.toString();
      }
    } catch (_error) {}
    return '';
  }

  function resolveUrl(rawUrl) {
    try {
      return new URL(String(rawUrl || ''), location.href).toString();
    } catch (_error) {
      return '';
    }
  }

  function routeKey(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
    } catch (_error) {
      return '';
    }
  }

  function sameRoute(left, right) {
    return routeKey(left) === routeKey(right);
  }

  function isSameFastSite(left, right) {
    try {
      const leftHost = new URL(left).hostname;
      const rightHost = new URL(right).hostname;
      return (isXHost(leftHost) && isXHost(rightHost))
        || (isGmgnHost(leftHost) && isGmgnHost(rightHost));
    } catch (_error) {
      return false;
    }
  }

  function isCapturableFromGmgn(href) {
    try {
      const url = new URL(href);
      if (isXHost(url.hostname) || url.hostname.toLowerCase() === 't.co') {
        return true;
      }
      return isGmgnHost(url.hostname) && /\/token\//i.test(url.pathname);
    } catch (_error) {
      return false;
    }
  }

  function isXHost(value) {
    const valueHost = String(value || '').toLowerCase();
    return valueHost === 'x.com'
      || valueHost.endsWith('.x.com')
      || valueHost === 'twitter.com'
      || valueHost.endsWith('.twitter.com');
  }

  function isGmgnHost(value) {
    const valueHost = String(value || '').toLowerCase();
    return valueHost === 'gmgn.ai' || valueHost.endsWith('.gmgn.ai');
  }
})();
