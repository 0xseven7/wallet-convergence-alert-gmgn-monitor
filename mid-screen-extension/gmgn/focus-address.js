(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.__gmgnMainScreenFocusAddressLoaded) return;
  if (typeof window !== 'undefined') window.__gmgnMainScreenFocusAddressLoaded = true;

  const MESSAGE_TYPE = 'gmgn-main-screen-focus-address';
  const TOOLBAR_ID = 'gmgn-main-screen-focus-toolbar';
  const BUTTON_ID = 'gmgn-main-screen-focus-button';
  const STYLE_ID = 'gmgn-main-screen-focus-style';
  const ROUTE_POLL_INTERVAL_MS = 2000;

  function normalizeChain(value) {
    let chain = String(value || '').trim().toLowerCase();
    if (chain === 'solana') chain = 'sol';
    if (chain === 'ethereum') chain = 'eth';
    if (chain === 'bnb' || chain === 'binance') chain = 'bsc';
    if (chain === 'rh' || chain.replace(/[\s_-]+/g, '') === 'robinhoodchain') chain = 'robinhood';
    return /^(sol|eth|bsc|base|tron|blast|robinhood)$/.test(chain) ? chain : '';
  }

  function normalizeAddress(value) {
    const address = String(value || '').trim();
    return /^0x[a-f0-9]{40}$/i.test(address) ? address.toLowerCase() : address;
  }

  function isAddress(value) {
    const address = String(value || '').trim();
    return /^0x[a-f0-9]{40}$/i.test(address)
      || /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(address)
      || /^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(address);
  }

  function parseParts(pathname, searchParams) {
    const parts = String(pathname || '').split('/').filter(Boolean).map((part) => {
      try { return decodeURIComponent(part); } catch (_error) { return part; }
    });
    let chain = '';
    let address = '';
    if (parts.length >= 3 && parts[1].toLowerCase() === 'address') {
      chain = normalizeChain(parts[0]);
      address = normalizeAddress(parts[2]);
    } else if (parts.length >= 3 && parts[0].toLowerCase() === 'address') {
      chain = normalizeChain(parts[1]);
      address = normalizeAddress(parts[2]);
    } else if (parts.length >= 2 && parts[0].toLowerCase() === 'address') {
      chain = normalizeChain(searchParams.get('chain') || searchParams.get('network'));
      address = normalizeAddress(parts[1]);
    }
    if (!chain || !isAddress(address)) return null;
    return { chain, address, key: `${chain}:${address}` };
  }

  function parseGmgnAddressPageUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ''), 'https://gmgn.ai/');
      if (url.protocol !== 'https:' || !/(^|\.)gmgn\.ai$/i.test(url.hostname)) return null;
      const candidates = [{ pathname: url.pathname, searchParams: url.searchParams }];
      const hash = String(url.hash || '').replace(/^#/, '').replace(/^!\//, '/');
      if (hash.startsWith('/')) {
        const queryIndex = hash.indexOf('?');
        candidates.push({
          pathname: queryIndex >= 0 ? hash.slice(0, queryIndex) : hash,
          searchParams: new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : '')
        });
      }
      for (const candidate of candidates) {
        const info = parseParts(candidate.pathname, candidate.searchParams);
        if (info) return { ...info, sourceUrl: url.href };
      }
    } catch (_error) {}
    return null;
  }

  function parseGmgnAddressContextCandidates(rawUrls) {
    for (const rawUrl of Array.isArray(rawUrls) ? rawUrls : []) {
      const info = parseGmgnAddressPageUrl(rawUrl);
      if (info) return info;
    }
    return null;
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getDrawerAddressUrls() {
    const roots = Array.from(document.querySelectorAll(
      '[role="dialog"], .ant-drawer-content-wrapper, .ant-drawer-content, [data-radix-dialog-content]'
    )).filter(isVisible).reverse();
    const urls = [];
    for (const root of roots) {
      for (const link of root.querySelectorAll('a[href*="/address/"]')) {
        if (isVisible(link) && link.href) urls.push(link.href);
      }
    }
    return urls;
  }

  function resolveAddressContext() {
    return parseGmgnAddressPageUrl(window.location.href)
      || parseGmgnAddressContextCandidates(getDrawerAddressUrls());
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID}{position:fixed;top:92px;right:16px;z-index:2147483646;pointer-events:none}
      #${BUTTON_ID}{pointer-events:auto;width:34px;height:34px;border:1px solid #687384;border-radius:9px;
        background:#15191f;color:#aab3c0;font:700 20px/1 Arial;cursor:pointer;box-shadow:0 8px 22px #0008}
      #${BUTTON_ID}:hover{border-color:#f6c744;color:#f6c744}
      #${BUTTON_ID}.is-focused{background:#5a4710;border-color:#f6c744;color:#ffd84d}
      #${BUTTON_ID}.is-pending{opacity:.65;cursor:wait}
      #${BUTTON_ID}.is-error{background:#5b1c24;border-color:#fb7185;color:#fecdd3}
    `;
    document.documentElement.appendChild(style);
  }

  function setState(button, state, info, detail = '') {
    button.classList.toggle('is-focused', state === 'focused');
    button.classList.toggle('is-pending', state === 'pending');
    button.classList.toggle('is-error', state === 'error');
    button.disabled = state === 'pending';
    button.textContent = state === 'pending' ? '…' : (state === 'error' ? '!' : '★');
    const label = state === 'focused' ? '取消 Focus' : '加入 Focus';
    button.title = detail || `${label} ${info.chain}:${info.address}`;
    button.setAttribute('aria-label', label);
  }

  function send(info, action) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPE,
        action,
        payload: {
          chain: info.chain,
          address: info.address,
          focusPushEnabled: true,
          source: 'gmgn-main-screen-profile',
          sourceUrl: window.location.href
        }
      }, (result) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!result?.ok) return reject(new Error(result?.error || 'Focus request failed'));
        resolve(result);
      });
    });
  }

  function removeToolbar() {
    document.getElementById(TOOLBAR_ID)?.remove();
  }

  function renderButton() {
    const info = resolveAddressContext();
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
    }
    if (button.dataset.focusKey === info.key) return;
    button.dataset.focusKey = info.key;
    setState(button, 'default', info);
    button.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const latest = resolveAddressContext();
      if (!latest) return removeToolbar();
      const removing = button.classList.contains('is-focused');
      setState(button, 'pending', latest);
      try {
        const result = await send(latest, removing ? 'remove' : 'add');
        setState(button, result.focus ? 'focused' : 'default', latest);
      } catch (error) {
        setState(button, 'error', latest, error?.message || String(error));
      }
    };
    void send(info, 'status')
      .then((result) => {
        if (button.dataset.focusKey === info.key) setState(button, result.focus ? 'focused' : 'default', info);
      })
      .catch(() => {});
  }

  function start() {
    let scheduled = false;
    const scheduleRender = () => {
      if (scheduled) return;
      scheduled = true;
      const run = () => {
        scheduled = false;
        renderButton();
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 800 });
      } else {
        window.setTimeout(run, 100);
      }
    };
    scheduleRender();
    window.addEventListener('popstate', scheduleRender);
    window.addEventListener('hashchange', scheduleRender);
    const pollInterval = window.setInterval(scheduleRender, ROUTE_POLL_INTERVAL_MS);
    window.addEventListener('pagehide', () => window.clearInterval(pollInterval), { once: true });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseGmgnAddressPageUrl, parseGmgnAddressContextCandidates };
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
