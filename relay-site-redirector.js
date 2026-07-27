(function () {
  'use strict';

  const OPEN_LINK_MESSAGE = 'open-in-main-window';
  const RELAY_SITE_OPEN_EVENT = 'gcp-relay-site-external-open';
  const RELAY_SITE_SOURCE = 'monitor-relay-site';
  const RELAY_SITE_HOSTS = new Set([
    'market-watch.macmini.lan'
  ]);

  if (!isRelaySite()) {
    return;
  }

  document.addEventListener('click', handleAnchorEvent, true);
  document.addEventListener('auxclick', handleAnchorEvent, true);
  document.addEventListener('submit', handleFormSubmit, true);
  window.addEventListener(RELAY_SITE_OPEN_EVENT, handlePageOpenEvent);

  function handleAnchorEvent(event) {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) {
      return;
    }

    const externalUrl = normalizeExternalUrl(anchor.getAttribute('href') || anchor.href || '');
    if (!externalUrl) {
      return;
    }

    suppressEvent(event);
    void openInMainScreen(externalUrl);
  }

  function handleFormSubmit(event) {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') {
      return;
    }

    const externalUrl = normalizeExternalUrl(form.getAttribute('action') || form.action || '');
    if (!externalUrl) {
      return;
    }

    suppressEvent(event);
    void openInMainScreen(externalUrl);
  }

  function handlePageOpenEvent(event) {
    const externalUrl = normalizeExternalUrl(event?.detail?.url || '');
    if (!externalUrl) {
      return;
    }

    void openInMainScreen(externalUrl);
  }

  async function openInMainScreen(url) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: OPEN_LINK_MESSAGE,
        url,
        relayBaseUrl: location.origin,
        relayOnly: true,
        allowAnyHttpUrl: true,
        source: RELAY_SITE_SOURCE,
        sourceOrigin: location.origin
      });
    } catch (_error) {
      // Do not fall back to opening in the monitor profile.
    }
  }

  function suppressEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

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
