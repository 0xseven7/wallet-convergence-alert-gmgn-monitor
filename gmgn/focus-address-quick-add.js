(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.__gcpFocusAddressQuickAddLoaded) return;
  if (typeof window !== 'undefined') {
    window.__gcpFocusAddressQuickAddLoaded = true;
  }

  const QUICK_ADD_MESSAGE = 'gmgn-focus-address-quick-add';
  const BUTTON_ID = 'gcp-focus-address-quick-add-btn';
  const TOOLBAR_ID = 'gcp-focus-address-quick-add-toolbar';
  const STYLE_ID = 'gcp-focus-address-quick-add-style';
  const LOCAL_SOURCE = 'gmgn-monitor-address-page';
  const ROUTE_POLL_INTERVAL_MS = 2000;
  const IDLE_TIMEOUT_MS = 900;
  const IDLE_FALLBACK_DELAY_MS = 120;

  function normalizeFocusChainName(value) {
    let normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'solana') normalized = 'sol';
    if (normalized === 'ethereum') normalized = 'eth';
    if (normalized === 'bnb' || normalized === 'binance' || normalized === 'binance-smart-chain') normalized = 'bsc';
    const compact = normalized.replace(/[\s_-]+/g, '');
    if (normalized === 'rh' || normalized === 'robin' || compact === 'robinhood' || compact === 'robinhoodchain') {
      normalized = 'robinhood';
    }
    if (!/^(sol|eth|bsc|base|tron|blast|robinhood)$/.test(normalized)) return '';
    return normalized;
  }

  function normalizeFocusAddress(value) {
    return String(value || '').trim();
  }

  function normalizeFocusAddressKey(address) {
    const normalized = normalizeFocusAddress(address);
    return /^0x[a-f0-9]{40}$/i.test(normalized) ? normalized.toLowerCase() : normalized;
  }

  function isLikelyFocusAddress(address) {
    const text = normalizeFocusAddress(address);
    return /^0x[a-fA-F0-9]{40}$/.test(text)
      || /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(text)
      || /^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(text);
  }

  function buildFocusAddressKey(chain, address) {
    const normalizedChain = normalizeFocusChainName(chain);
    const normalizedAddress = normalizeFocusAddressKey(address);
    if (!normalizedChain || !normalizedAddress) return '';
    return `${normalizedChain}:${normalizedAddress}`;
  }

  function decodeRoutePart(value) {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  function splitRouteParts(pathname) {
    return String(pathname || '')
      .split('/')
      .filter(Boolean)
      .map(decodeRoutePart);
  }

  function parseAddressRouteParts(parts, searchParams) {
    let chain = '';
    let address = '';

    if (parts.length >= 3 && String(parts[1]).toLowerCase() === 'address') {
      chain = normalizeFocusChainName(parts[0]);
      address = normalizeFocusAddress(parts[2]);
    } else if (parts.length >= 3 && String(parts[0]).toLowerCase() === 'address') {
      chain = normalizeFocusChainName(parts[1]);
      address = normalizeFocusAddress(parts[2]);
    } else if (parts.length >= 2 && String(parts[0]).toLowerCase() === 'address') {
      chain = normalizeFocusChainName(searchParams.get('chain') || searchParams.get('network'));
      address = normalizeFocusAddress(parts[1]);
    }

    if (!chain || !isLikelyFocusAddress(address)) return null;
    return {
      chain,
      address,
      key: buildFocusAddressKey(chain, address)
    };
  }

  function getRouteCandidates(parsedUrl) {
    const candidates = [{
      pathname: parsedUrl.pathname,
      searchParams: parsedUrl.searchParams
    }];

    const hash = String(parsedUrl.hash || '').replace(/^#/, '');
    const normalizedHash = hash.startsWith('!/') ? hash.slice(1) : hash;
    if (normalizedHash.startsWith('/')) {
      const queryIndex = normalizedHash.indexOf('?');
      const hashPath = queryIndex >= 0 ? normalizedHash.slice(0, queryIndex) : normalizedHash;
      const hashQuery = queryIndex >= 0 ? normalizedHash.slice(queryIndex + 1) : '';
      candidates.push({
        pathname: hashPath,
        searchParams: new URLSearchParams(hashQuery)
      });
    }

    return candidates;
  }

  function parseGmgnAddressPageUrl(rawUrl) {
    try {
      const parsedUrl = new URL(String(rawUrl || ''), 'https://gmgn.ai/');
      if (parsedUrl.protocol !== 'https:' || !/(^|\.)gmgn\.ai$/i.test(parsedUrl.hostname)) {
        return null;
      }

      for (const candidate of getRouteCandidates(parsedUrl)) {
        const route = parseAddressRouteParts(splitRouteParts(candidate.pathname), candidate.searchParams);
        if (route) {
          return {
            ...route,
            sourceUrl: parsedUrl.href
          };
        }
      }
    } catch (_error) {}

    return null;
  }

  function buildFocusAddressPayload(info) {
    if (!info) return null;
    return {
      chain: info.chain,
      address: info.address,
      alias: '',
      name: '',
      focusPushEnabled: true,
      source: LOCAL_SOURCE,
      sourceUrl: typeof window !== 'undefined' ? window.location.href : info.sourceUrl
    };
  }

  function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID} {
        position: fixed;
        top: 92px;
        right: 16px;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        pointer-events: none;
      }
      #${BUTTON_ID} {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 92px;
        height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(116, 143, 252, 0.72);
        border-radius: 8px;
        background: #121826;
        color: #f8fafc;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
        font: 700 13px/1 Arial, sans-serif;
        letter-spacing: 0;
        cursor: pointer;
        user-select: none;
      }
      #${BUTTON_ID}:hover {
        background: #1f2a44;
        border-color: rgba(129, 161, 255, 0.92);
      }
      #${BUTTON_ID}.is-added {
        background: #14532d;
        border-color: rgba(74, 222, 128, 0.76);
        color: #dcfce7;
      }
      #${BUTTON_ID}.is-pending {
        cursor: wait;
        opacity: 0.82;
      }
      #${BUTTON_ID}.is-error {
        background: #581c1c;
        border-color: rgba(248, 113, 113, 0.78);
        color: #fee2e2;
      }
      #${BUTTON_ID}:disabled {
        cursor: wait;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeToolbar() {
    if (typeof document === 'undefined') return;
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (toolbar) toolbar.remove();
  }

  function stopOwnEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }

  function setButtonState(button, state, info, errorMessage = '') {
    button.classList.toggle('is-added', state === 'added');
    button.classList.toggle('is-pending', state === 'pending');
    button.classList.toggle('is-error', state === 'error');
    button.disabled = state === 'pending';

    if (state === 'added') {
      button.textContent = 'Focus Added';
      button.title = `Focus wallet: ${info.chain}:${info.address}`;
    } else if (state === 'pending') {
      button.textContent = 'Adding...';
      button.title = 'Adding wallet to Focus list';
    } else if (state === 'error') {
      button.textContent = 'Add Focus !';
      button.title = errorMessage || 'Add Focus failed';
    } else {
      button.textContent = 'Add Focus';
      button.title = `Add ${info.chain}:${info.address} to Focus`;
    }
    button.setAttribute('aria-label', button.title);
  }

  function sendFocusAddressQuickAdd(payload, action = 'add') {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        reject(new Error('Extension runtime is unavailable.'));
        return;
      }

      chrome.runtime.sendMessage({
        type: QUICK_ADD_MESSAGE,
        action,
        payload
      }, (result) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || String(runtimeError)));
          return;
        }
        if (!result || result.ok !== true) {
          reject(new Error(result?.error || 'Add Focus failed.'));
          return;
        }
        resolve(result);
      });
    });
  }

  function refreshButtonStatus(button, info) {
    const payload = buildFocusAddressPayload(info);
    if (!payload) return;
    sendFocusAddressQuickAdd(payload, 'status')
      .then((result) => {
        const latest = parseGmgnAddressPageUrl(window.location.href);
        if (!latest || latest.key !== info.key || button.dataset.focusKey !== info.key) return;
        setButtonState(button, result.focus ? 'added' : 'default', info);
      })
      .catch(() => {
        const latest = parseGmgnAddressPageUrl(window.location.href);
        if (!latest || latest.key !== info.key || button.dataset.focusKey !== info.key) return;
        setButtonState(button, 'default', info);
      });
  }

  function bindButtonEvents(button) {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    for (const eventName of ['pointerdown', 'mousedown', 'mouseup']) {
      button.addEventListener(eventName, stopOwnEvent, true);
    }
    button.addEventListener('click', async (event) => {
      stopOwnEvent(event);
      const info = parseGmgnAddressPageUrl(window.location.href);
      if (!info) {
        removeToolbar();
        return;
      }
      const payload = buildFocusAddressPayload(info);
      if (!payload) return;
      setButtonState(button, 'pending', info);
      try {
        await sendFocusAddressQuickAdd(payload, 'add');
        setButtonState(button, 'added', info);
      } catch (error) {
        setButtonState(button, 'error', info, error?.message || String(error));
        setTimeout(() => {
          const latest = parseGmgnAddressPageUrl(window.location.href);
          if (latest && latest.key === info.key) {
            setButtonState(button, 'default', info);
          }
        }, 1600);
      }
    }, true);
  }

  function renderButton() {
    if (typeof document === 'undefined') return;
    const info = parseGmgnAddressPageUrl(window.location.href);
    if (!info) {
      removeToolbar();
      return;
    }

    ensureStyle();
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      document.documentElement.appendChild(toolbar);
    }

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      toolbar.appendChild(button);
      bindButtonEvents(button);
    }

    if (button.dataset.focusKey === info.key && button.textContent) {
      return;
    }

    button.dataset.focusKey = info.key;
    button.dataset.chain = info.chain;
    button.dataset.address = info.address;
    setButtonState(button, 'default', info);
    refreshButtonStatus(button, info);
  }

  function requestIdleRender(callback) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
      return;
    }
    window.setTimeout(callback, IDLE_FALLBACK_DELAY_MS);
  }

  function startRouteWatcher() {
    let lastUrl = '';
    let renderScheduled = false;

    const renderIfRouteChanged = () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl && document.getElementById(TOOLBAR_ID)) {
        return;
      }
      lastUrl = currentUrl;
      renderButton();
    };

    const scheduleRender = () => {
      if (renderScheduled) return;
      renderScheduled = true;
      requestIdleRender(() => {
        renderScheduled = false;
        renderIfRouteChanged();
      });
    };

    const wrapHistoryMethod = (methodName) => {
      const original = window.history?.[methodName];
      if (typeof original !== 'function') return;
      window.history[methodName] = function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        scheduleRender();
        return result;
      };
    };

    scheduleRender();
    window.addEventListener('popstate', scheduleRender);
    window.addEventListener('hashchange', scheduleRender);
    const pollInterval = window.setInterval(() => {
      if (window.location.href !== lastUrl) {
        scheduleRender();
      }
    }, ROUTE_POLL_INTERVAL_MS);
    window.addEventListener('pagehide', () => {
      window.clearInterval(pollInterval);
    }, { once: true });
    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeFocusChainName,
      normalizeFocusAddressKey,
      parseGmgnAddressPageUrl,
      buildFocusAddressPayload,
      buildFocusAddressKey
    };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (document.readyState === 'complete') {
    startRouteWatcher();
  } else {
    window.addEventListener('load', startRouteWatcher, { once: true });
  }

  window.__gcpFocusAddressQuickAddDebug = {
    parse: () => parseGmgnAddressPageUrl(window.location.href),
    render: renderButton,
    buttonId: BUTTON_ID
  };
})();
