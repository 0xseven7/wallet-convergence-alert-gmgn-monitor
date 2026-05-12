(() => {
  'use strict';

  if (globalThis.__walletConvergenceDevReloadClientLoaded) {
    return;
  }
  globalThis.__walletConvergenceDevReloadClientLoaded = true;

  const DEV_AUTO_RELOAD_TRIGGER_MESSAGE = 'dev-auto-reload-trigger';
  const STATUS_URLS = [
    'http://127.0.0.1:17373/status',
    'http://localhost:17373/status'
  ];
  const SUCCESS_POLL_INTERVAL_MS = 1500;
  const MAX_FAILURE_POLL_INTERVAL_MS = 15000;

  let lastToken = null;
  let preferredStatusUrl = STATUS_URLS[0];
  let nextDelayMs = SUCCESS_POLL_INTERVAL_MS;
  let reloadRequested = false;
  let stopped = false;

  window.addEventListener('beforeunload', () => {
    stopped = true;
  }, { once: true });

  void pollLoop();

  async function pollLoop() {
    while (!stopped && !reloadRequested) {
      try {
        const status = await fetchDevStatus();
        const token = typeof status.token === 'string' ? status.token : '';
        if (token) {
          if (lastToken === null) {
            lastToken = token;
          } else if (token !== lastToken) {
            lastToken = token;
            reloadRequested = true;
            try {
              await chrome.runtime.sendMessage({
                type: DEV_AUTO_RELOAD_TRIGGER_MESSAGE,
                token
              });
            } catch (_error) {
              reloadRequested = false;
            }
            return;
          }
        }
        nextDelayMs = SUCCESS_POLL_INTERVAL_MS;
      } catch (_error) {
        nextDelayMs = Math.min(
          MAX_FAILURE_POLL_INTERVAL_MS,
          Math.max(SUCCESS_POLL_INTERVAL_MS, Math.round(nextDelayMs * 1.8))
        );
      }

      await sleep(nextDelayMs);
    }
  }

  async function fetchDevStatus() {
    let lastError = null;
    for (const statusUrl of buildStatusUrlCandidates()) {
      try {
        const response = await fetch(statusUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Dev reload status failed with ${response.status}`);
        }
        const payload = await response.json();
        preferredStatusUrl = statusUrl;
        return payload;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Unable to reach dev reload status endpoint.');
  }

  function buildStatusUrlCandidates() {
    if (!preferredStatusUrl) {
      return STATUS_URLS.slice();
    }
    return [preferredStatusUrl, ...STATUS_URLS.filter((url) => url !== preferredStatusUrl)];
  }

  function sleep(delayMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
})();
