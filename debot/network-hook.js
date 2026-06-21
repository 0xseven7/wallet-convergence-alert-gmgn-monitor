(function () {
  'use strict';

  if (window.__debotTrackHookInstalled) return;
  window.__debotTrackHookInstalled = true;

  const MESSAGE_FLAG = '__gcpDebot';
  const TRACK_CHANNEL = 'wallet-track-transactions';
  const TRACK_PATH_RE = /\/api\/wallet\/track\/transactions(?:\?|$)/;
  const MAX_BODY_LENGTH = 1000000;

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function isTrackTransactionsUrl(url) {
    return TRACK_PATH_RE.test(String(url || ''));
  }

  function sanitizeUrl(url) {
    try {
      const parsed = new URL(String(url || ''), window.location.href);
      if (parsed.searchParams.has('request_id')) {
        parsed.searchParams.set('request_id', '<redacted>');
      }
      return parsed.pathname + parsed.search;
    } catch (_error) {
      return String(url || '').replace(/request_id=[^&]+/g, 'request_id=<redacted>');
    }
  }

  function postTrackResponse(url, text, source) {
    if (!text || text.length > MAX_BODY_LENGTH) return;
    window.postMessage({
      [MESSAGE_FLAG]: true,
      channel: TRACK_CHANNEL,
      payload: {
        source,
        url: sanitizeUrl(url),
        text
      }
    }, '*');
  }

  const NativeXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new NativeXHR();
    let requestUrl = '';
    const nativeOpen = xhr.open;

    xhr.open = function patchedOpen(method, url) {
      requestUrl = getUrl(url);
      return nativeOpen.apply(xhr, arguments);
    };

    xhr.addEventListener('load', function onLoad() {
      try {
        if (!isTrackTransactionsUrl(requestUrl)) return;
        postTrackResponse(requestUrl, xhr.responseText, 'xhr');
      } catch (_error) {}
    });

    return xhr;
  }

  try {
    for (const key in NativeXHR) {
      PatchedXHR[key] = NativeXHR[key];
    }
  } catch (_error) {}
  PatchedXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = async function patchedFetch(input, init) {
      const url = getUrl(input);
      const response = await nativeFetch.apply(this, arguments);
      try {
        if (isTrackTransactionsUrl(url)) {
          response.clone().text()
            .then((text) => postTrackResponse(url, text, 'fetch'))
            .catch(() => {});
        }
      } catch (_error) {}
      return response;
    };
  }

  console.info('[Debot Track Hook] installed');
})();
