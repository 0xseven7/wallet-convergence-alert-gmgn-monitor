(() => {
  'use strict';

  const CHANNEL = 'gmgn-main-screen-fast-open';
  const NAVIGATE_EVENT = `${CHANNEL}:navigate`;
  const RESULT_EVENT = `${CHANNEL}:result`;
  const CAPTURE_EVENT = `${CHANNEL}:capture`;
  const NAVIGATE_MESSAGE = 'gmgn-main-screen-fast-navigate';
  const OPEN_MESSAGE = 'gmgn-main-screen-fast-open';
  const pending = new Map();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== NAVIGATE_MESSAGE || !message.href) {
      return false;
    }
    navigateMainWorld(message.href)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, reason: errorMessage(error) }));
    return true;
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.channel !== CHANNEL) {
      return;
    }
    if (event.data.type === RESULT_EVENT) {
      const requestId = String(event.data.requestId || '');
      const waiter = pending.get(requestId);
      if (!waiter) {
        return;
      }
      pending.delete(requestId);
      clearTimeout(waiter.timer);
      waiter.resolve({
        ok: Boolean(event.data.ok),
        reason: String(event.data.reason || '')
      });
      return;
    }
    if (event.data.type === CAPTURE_EVENT && event.data.href) {
      chrome.runtime.sendMessage({
        type: OPEN_MESSAGE,
        url: String(event.data.href)
      }).catch(() => {});
    }
  });

  function navigateMainWorld(href) {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ ok: false, reason: 'bridge-timeout' });
      }, 2200);
      pending.set(requestId, { resolve, timer });
      window.postMessage({
        channel: CHANNEL,
        type: NAVIGATE_EVENT,
        requestId,
        href: String(href)
      }, location.origin);
    });
  }

  function errorMessage(error) {
    return error && error.message ? error.message : String(error);
  }
})();
