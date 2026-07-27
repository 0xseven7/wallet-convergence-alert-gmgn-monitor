(function () {
  'use strict';

  const RELAY_SITE_OPEN_EVENT = 'gcp-relay-site-external-open';
  const RELAY_SITE_HOSTS = new Set([
    'market-watch.macmini.lan'
  ]);

  if (!isRelaySite()) {
    return;
  }

  const originalWindowOpen = window.open;

  window.open = function relaySiteWindowOpen(rawUrl, target, features) {
    const externalUrl = normalizeExternalUrl(rawUrl);
    if (externalUrl) {
      window.dispatchEvent(new CustomEvent(RELAY_SITE_OPEN_EVENT, {
        detail: {
          url: externalUrl,
          origin: location.origin,
          source: 'window.open'
        }
      }));
      return null;
    }

    return originalWindowOpen.apply(this, [rawUrl, target, features]);
  };

  function isRelaySite() {
    return location.protocol === 'https:'
      && RELAY_SITE_HOSTS.has(location.hostname);
  }

  function normalizeExternalUrl(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || ''), location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      if (parsed.origin === location.origin) {
        return '';
      }
      return parsed.href;
    } catch (_error) {
      return '';
    }
  }
})();
