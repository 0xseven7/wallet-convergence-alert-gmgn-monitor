(function () {
  'use strict';

  const QUICK_ADD_MESSAGE = 'gmgn-token-quick-add';
  const OPEN_COUNTERPART_MESSAGE = 'gmgn-open-token-counterpart';
  const BUTTON_ID = 'gcp-token-quick-add-btn';
  const EXTERNAL_LINK_ID = 'gcp-token-counterpart-link';
  const TOOLBAR_ID = 'gcp-token-quick-add-toolbar';
  const TOOLBAR_HANDLE_CLASS = 'gcp-token-quick-add-toolbar-handle';
  const TOOLBAR_POSITION_KEY = 'gcp-token-quick-add-toolbar-position-v2';
  const STYLE_ID = 'gcp-token-quick-add-style';
  const HEART_ICON = '\u2665';
  const PENDING_ICON = '\u2026';
  const DEBUG_PREFIX = '[GMGN Token Quick Add]';
  const IDLE_FALLBACK_DELAY_MS = 1200;
  const IDLE_TIMEOUT_MS = 3000;
  const ROUTE_POLL_INTERVAL_MS = 2000;
  const NOTE = 'from GMGN plugin';
  const TAGS = 'gmgn,quick-add';
  const CHAIN_MAP = {
    sol: 'solana',
    solana: 'solana',
    bsc: 'bsc',
    bnb: 'bsc',
    eth: 'ethereum',
    ethereum: 'ethereum',
    base: 'base',
    tron: 'tron',
    blast: 'blast',
    rh: 'robinhood',
    robin: 'robinhood',
    robinhood: 'robinhood',
    robinhoodchain: 'robinhood'
  };
  const GMGN_CHAIN_SLUG = {
    solana: 'sol',
    bsc: 'bsc',
    ethereum: 'eth',
    base: 'base',
    tron: 'tron',
    blast: 'blast',
    robinhood: 'robinhood'
  };
  const FOMO_CHAIN_SLUG = {
    solana: 'solana',
    bsc: 'bnb',
    ethereum: 'ethereum',
    base: 'base',
    tron: 'tron',
    blast: 'blast',
    robinhood: 'robinhood'
  };

  function normalizeQuickAddChain(chain) {
    const normalized = String(chain || '').trim().toLowerCase();
    return CHAIN_MAP[normalized] || CHAIN_MAP[normalized.replace(/[\s_-]+/g, '')] || '';
  }

  function isLikelyTokenAddress(value) {
    const text = String(value || '').trim();
    return /^0x[a-fA-F0-9]{40}$/.test(text)
      || /^[1-9A-HJ-NP-Za-km-z]{32,64}(?:pump|bonk)?$/i.test(text);
  }

  function pickFirstTokenAddress(values) {
    for (const value of values) {
      const tokenAddress = extractTokenAddress(value);
      if (tokenAddress) {
        return tokenAddress;
      }
    }
    return '';
  }

  function extractTokenAddress(value) {
    const decoded = decodeURIComponent(String(value || '')).trim();
    if (isLikelyTokenAddress(decoded)) {
      return decoded;
    }

    const evmMatch = decoded.match(/0x[a-fA-F0-9]{40}/);
    if (evmMatch) {
      return evmMatch[0];
    }

    const solMatch = decoded.match(/[1-9A-HJ-NP-Za-km-z]{32,64}(?:pump|bonk)?/i);
    return solMatch?.[0] || '';
  }

  function pickFirstChain(values) {
    for (const value of values) {
      const chain = normalizeQuickAddChain(value);
      if (chain) {
        return chain;
      }

      const text = String(value || '').toLowerCase();
      const match = text.match(/\b(solana|sol|bsc|bnb|ethereum|eth|base|tron|blast)\b/);
      if (match) {
        return normalizeQuickAddChain(match[1]);
      }
    }
    return '';
  }

  function debugLog(message, data) {
    try {
      console.info(`${DEBUG_PREFIX} ${message}`, data || '');
    } catch (_error) {
      // Ignore console edge cases on injected pages.
    }
  }

  function parseGmgnTokenPageUrl(rawUrl) {
    let parsed;
    try {
      parsed = new URL(String(rawUrl || ''), 'https://gmgn.ai');
    } catch (_error) {
      return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const hashText = decodeURIComponent(String(parsed.hash || '').replace(/^#\/?/, ''));
    const hashPath = hashText.split('?')[0] || '';
    const hashParts = hashPath.split('/').filter(Boolean);
    let chain = '';
    let ca = '';

    if (/(^|\.)gmgn\.ai$/i.test(parsed.hostname)) {
      if (parts.length >= 3 && parts[1].toLowerCase() === 'token') {
        chain = normalizeQuickAddChain(parts[0]);
        ca = decodeURIComponent(parts[2] || '').trim();
      } else if (parts.length >= 2 && parts[0].toLowerCase() === 'token') {
        chain = normalizeQuickAddChain(parsed.searchParams.get('chain') || parsed.searchParams.get('network'));
        ca = decodeURIComponent(parts[1] || '').trim();
      } else if (hashParts.length >= 3 && hashParts[1].toLowerCase() === 'token') {
        chain = normalizeQuickAddChain(hashParts[0]);
        ca = decodeURIComponent(hashParts[2] || '').trim();
      } else if (hashParts.length >= 2 && hashParts[0].toLowerCase() === 'token') {
        chain = normalizeQuickAddChain(parsed.searchParams.get('chain') || parsed.searchParams.get('network'));
        ca = decodeURIComponent(hashParts[1] || '').trim();
      }
    } else if (/(^|\.)fomo\.family$/i.test(parsed.hostname)) {
      if (parts.length >= 3 && parts[0].toLowerCase() === 'tokens') {
        chain = normalizeQuickAddChain(parts[1]);
        ca = decodeURIComponent(parts[2] || '').trim();
      } else if (hashParts.length >= 3 && hashParts[0].toLowerCase() === 'tokens') {
        chain = normalizeQuickAddChain(hashParts[1]);
        ca = decodeURIComponent(hashParts[2] || '').trim();
      }
    } else {
      return null;
    }

    if (!chain || !ca || !isLikelyTokenAddress(ca)) {
      return null;
    }

    return { ca, chain };
  }

  function parseTokenRouteParts(parts) {
    for (let index = 0; index < parts.length; index += 1) {
      const current = String(parts[index] || '').toLowerCase();
      const next = parts[index + 1];
      const afterNext = parts[index + 2];
      const currentChain = normalizeQuickAddChain(current);

      if ((current === 'token' || current === 'tokens') && normalizeQuickAddChain(next) && extractTokenAddress(afterNext)) {
        return {
          chain: normalizeQuickAddChain(next),
          ca: extractTokenAddress(afterNext)
        };
      }

      if (currentChain && (String(next || '').toLowerCase() === 'token' || String(next || '').toLowerCase() === 'tokens') && extractTokenAddress(afterNext)) {
        return {
          chain: currentChain,
          ca: extractTokenAddress(afterNext)
        };
      }

      if (currentChain && extractTokenAddress(next)) {
        return {
          chain: currentChain,
          ca: extractTokenAddress(next)
        };
      }
    }

    return { chain: '', ca: '' };
  }

  function resolveCurrentTokenInfo() {
    return parseGmgnTokenPageUrl(window.location.href);
  }

  function buildQuickAddPayload(tokenInfo) {
    if (!tokenInfo || !tokenInfo.ca || !tokenInfo.chain) {
      return null;
    }

    return {
      ca: tokenInfo.ca,
      chain: tokenInfo.chain,
      note: NOTE,
      tags: TAGS
    };
  }

  function quickAddKey(payload) {
    return `${payload?.chain || ''}:${payload?.ca || ''}`;
  }

  function getQuickAddErrorMessage(result) {
    if (!result) {
      return 'Quick add failed: no response from extension background.';
    }

    const jsonError = result?.json?.error || result?.json?.message;
    const body = typeof result?.body === 'string' ? result.body.trim() : '';
    const message = result?.error || jsonError || body || result?.statusText;
    if (message) {
      return String(message).slice(0, 500);
    }

    return `Quick add failed with ${result?.status || 'unknown status'}.`;
  }

  function getTokenPageKind(rawUrl) {
    let parsed;
    try {
      parsed = new URL(String(rawUrl || ''), 'https://gmgn.ai');
    } catch (_error) {
      return '';
    }

    if (/(^|\.)gmgn\.ai$/i.test(parsed.hostname)) {
      return 'gmgn';
    }
    if (/(^|\.)fomo\.family$/i.test(parsed.hostname)) {
      return 'fomo';
    }
    return '';
  }

  function buildGmgnTokenUrl(tokenInfo) {
    const chain = GMGN_CHAIN_SLUG[tokenInfo?.chain];
    if (!chain || !tokenInfo?.ca) {
      return '';
    }
    return `https://gmgn.ai/${chain}/token/${encodeURIComponent(tokenInfo.ca)}`;
  }

  function buildFomoTokenUrl(tokenInfo) {
    const chain = FOMO_CHAIN_SLUG[tokenInfo?.chain];
    if (!chain || !tokenInfo?.ca) {
      return '';
    }
    return `https://fomo.family/tokens/${chain}/${encodeURIComponent(tokenInfo.ca)}`;
  }

  function buildCounterpartTokenLink(rawUrl, tokenInfo) {
    const pageKind = getTokenPageKind(rawUrl);
    if (pageKind === 'gmgn') {
      return { label: 'Fomo', url: buildFomoTokenUrl(tokenInfo), title: '跳转到 FOMO' };
    }
    if (pageKind === 'fomo') {
      return { label: 'GMGN', url: buildGmgnTokenUrl(tokenInfo), title: '跳转到 GMGN' };
    }
    return null;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID} {
        position: fixed;
        top: 88px;
        right: 16px;
        left: auto;
        bottom: auto;
        z-index: 2147483600;
        display: inline-flex;
        width: max-content;
        width: fit-content;
        min-width: 0;
        max-width: calc(100vw - 16px);
        align-items: center;
        gap: 5px;
        padding: 4px 5px;
        border: 1px solid rgba(251, 113, 133, 0.38);
        border-radius: 999px;
        background: rgba(12, 11, 18, 0.82);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32), inset 0 0 0 1px rgba(255, 255, 255, 0.07);
        backdrop-filter: blur(10px);
        pointer-events: auto;
        user-select: none;
        box-sizing: border-box;
        contain: layout style;
        isolation: isolate;
      }
      #${TOOLBAR_ID}.is-dragging {
        opacity: 0.9;
      }
      #${TOOLBAR_ID} .${TOOLBAR_HANDLE_CLASS} {
        width: 16px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: rgba(248, 215, 123, 0.78);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: -2px;
        cursor: grab;
        line-height: 1;
      }
      #${TOOLBAR_ID}.is-dragging .${TOOLBAR_HANDLE_CLASS} {
        cursor: grabbing;
      }
      #${TOOLBAR_ID} .${TOOLBAR_HANDLE_CLASS}:hover {
        background: rgba(248, 215, 123, 0.12);
        color: #f8d77b;
      }
      #${BUTTON_ID} {
        position: relative;
        z-index: 2147483600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 1px solid rgba(251, 113, 133, 0.55);
        border-radius: 999px;
        background: rgba(251, 113, 133, 0.12);
        color: #fb7185;
        font-size: 20px;
        font-weight: 800;
        line-height: 1;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(10px);
        cursor: pointer;
        user-select: none;
        pointer-events: auto;
        overflow: visible;
      }
      #${TOOLBAR_ID} #${BUTTON_ID} {
        position: relative;
        z-index: auto;
        width: 26px;
        height: 26px;
        min-width: 26px;
        font-size: 17px;
        box-shadow: none;
        backdrop-filter: none;
      }
      #${TOOLBAR_ID} #${EXTERNAL_LINK_ID} {
        height: 26px;
        min-width: 44px;
        padding: 0 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(110, 231, 183, 0.48);
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.12);
        color: #9ff7c5;
        font-size: 12px;
        font-weight: 850;
        line-height: 1;
        text-decoration: none;
        cursor: pointer;
      }
      #${TOOLBAR_ID} #${EXTERNAL_LINK_ID}:hover {
        border-color: rgba(110, 231, 183, 0.86);
        background: rgba(16, 185, 129, 0.2);
        color: #c7ffe1;
      }
      #${BUTTON_ID}:hover {
        border-color: rgba(251, 113, 133, 0.95);
        color: #ff8da1;
        transform: translateY(-1px);
      }
      #${BUTTON_ID}:disabled {
        cursor: wait;
        opacity: 0.72;
        transform: none;
      }
      #${BUTTON_ID}.is-ok {
        border-color: rgba(251, 113, 133, 0.9);
        color: #fb7185;
      }
      #${BUTTON_ID}.is-error {
        border-color: rgba(251, 113, 133, 0.9);
        color: #fb7185;
      }
      #${BUTTON_ID}.is-favorite {
        border-color: rgba(251, 113, 133, 0.95);
        background: rgba(251, 113, 133, 0.2);
        color: #ff405f;
      }
      #${BUTTON_ID}:not(.is-favorite) {
        border-color: rgba(148, 163, 184, 0.48);
        background: rgba(148, 163, 184, 0.12);
        color: #94a3b8;
        opacity: 0.9;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeButton() {
    document.getElementById(TOOLBAR_ID)?.remove();
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(EXTERNAL_LINK_ID)?.remove();
  }

  function setButtonState(button, state, text) {
    button.classList.toggle('is-ok', state === 'ok');
    button.classList.toggle('is-error', state === 'error');
    button.textContent = text;
  }

  function setButtonFavorite(button, isFavorite) {
    button.dataset.favorite = isFavorite ? '1' : '0';
    button.classList.toggle('is-favorite', isFavorite);
    setButtonState(button, '', HEART_ICON);
  }

  function setButtonTitle(button, payload) {
    const isFavorite = button.dataset.favorite === '1';
    button.title = `${isFavorite ? '取消收藏' : '快速收藏'} ${payload.chain}:${payload.ca}`;
    button.setAttribute('aria-label', isFavorite ? '取消收藏' : '快速收藏');
  }

  function getToolbarStorageKey() {
    return `${TOOLBAR_POSITION_KEY}:${window.location.hostname}`;
  }

  function clampToolbarPosition(left, top, toolbar) {
    const rect = toolbar.getBoundingClientRect();
    const width = rect.width || 58;
    const height = rect.height || 34;
    return {
      left: Math.round(Math.max(8, Math.min(window.innerWidth - width - 8, left))),
      top: Math.round(Math.max(8, Math.min(window.innerHeight - height - 8, top)))
    };
  }

  function readToolbarPosition(toolbar) {
    try {
      const raw = localStorage.getItem(getToolbarStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (Number.isFinite(parsed?.left) && Number.isFinite(parsed?.top)) {
        return clampToolbarPosition(parsed.left, parsed.top, toolbar);
      }
    } catch (_error) {
      // Ignore corrupted localStorage values and fall back to the default.
    }

    return clampToolbarPosition(window.innerWidth - 84, 88, toolbar);
  }

  function applyToolbarPosition(toolbar, position) {
    toolbar.style.setProperty('left', `${position.left}px`, 'important');
    toolbar.style.setProperty('top', `${position.top}px`, 'important');
    toolbar.style.setProperty('right', 'auto', 'important');
    toolbar.style.setProperty('bottom', 'auto', 'important');
  }

  function saveToolbarPosition(toolbar) {
    try {
      localStorage.setItem(getToolbarStorageKey(), JSON.stringify({
        left: Math.round(toolbar.offsetLeft),
        top: Math.round(toolbar.offsetTop)
      }));
    } catch (_error) {
      // localStorage can be unavailable in restricted contexts.
    }
  }

  function setupToolbarDrag(toolbar, handle) {
    if (!toolbar || !handle || toolbar.dataset.dragReady === '1') {
      return;
    }

    toolbar.dataset.dragReady = '1';
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const startRect = toolbar.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      toolbar.classList.add('is-dragging');
      handle.setPointerCapture?.(event.pointerId);

      const onPointerMove = (moveEvent) => {
        const next = clampToolbarPosition(
          startRect.left + moveEvent.clientX - startX,
          startRect.top + moveEvent.clientY - startY,
          toolbar
        );
        applyToolbarPosition(toolbar, next);
      };

      const onPointerUp = () => {
        toolbar.classList.remove('is-dragging');
        saveToolbarPosition(toolbar);
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onPointerUp, true);
      };

      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerUp, true);
    });
  }

  function forceFloatingToolbar(toolbar) {
    toolbar.style.setProperty('position', 'fixed', 'important');
    toolbar.style.setProperty('z-index', '2147483600', 'important');
    toolbar.style.setProperty('display', 'inline-flex', 'important');
    toolbar.style.setProperty('width', 'max-content', 'important');
    toolbar.style.setProperty('min-width', '0', 'important');
    toolbar.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
    toolbar.style.setProperty('height', 'auto', 'important');
    toolbar.style.setProperty('margin', '0', 'important');
    toolbar.style.setProperty('transform', 'none', 'important');
    toolbar.style.setProperty('box-sizing', 'border-box', 'important');
  }

  function ensureToolbar() {
    let toolbar = document.getElementById(TOOLBAR_ID);
    let handle;
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      toolbar.dataset.gcpOwned = '1';
      toolbar.title = '拖拽移动收藏按钮栏';
      handle = document.createElement('span');
      handle.className = TOOLBAR_HANDLE_CLASS;
      handle.textContent = '::';
      handle.title = '拖拽移动';
      toolbar.appendChild(handle);
      document.body.appendChild(toolbar);
      forceFloatingToolbar(toolbar);
      requestAnimationFrame(() => {
        applyToolbarPosition(toolbar, readToolbarPosition(toolbar));
      });
      setupToolbarDrag(toolbar, handle);
    } else {
      toolbar.dataset.gcpOwned = '1';
      if (toolbar.parentElement !== document.body) {
        document.body.appendChild(toolbar);
      }
      forceFloatingToolbar(toolbar);
      handle = toolbar.querySelector(`.${TOOLBAR_HANDLE_CLASS}`);
      if (!handle) {
        handle = document.createElement('span');
        handle.className = TOOLBAR_HANDLE_CLASS;
        handle.textContent = '::';
        handle.title = '拖拽移动';
        toolbar.insertBefore(handle, toolbar.firstChild);
      }
      setupToolbarDrag(toolbar, handle);
    }

    return toolbar;
  }

  function syncCounterpartLink(toolbar, tokenInfo) {
    const linkInfo = buildCounterpartTokenLink(window.location.href, tokenInfo);
    let link = document.getElementById(EXTERNAL_LINK_ID);
    if (!linkInfo?.url) {
      link?.remove();
      return null;
    }

    if (!link) {
      link = document.createElement('a');
      link.id = EXTERNAL_LINK_ID;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      toolbar.appendChild(link);
    } else if (link.parentElement !== toolbar) {
      toolbar.appendChild(link);
    }

    link.href = linkInfo.url;
    link.textContent = linkInfo.label;
    link.title = linkInfo.title;
    link.setAttribute('aria-label', `${linkInfo.title}: ${tokenInfo.chain}:${tokenInfo.ca}`);
    link.onclick = (event) => {
      event.preventDefault();
      void openCounterpartLink(linkInfo.url);
    };
    return link;
  }

  function syncButtonPlacement(button, payload) {
    const toolbar = ensureToolbar();
    if (button.parentElement !== toolbar) {
      toolbar.appendChild(button);
    }
    button.hidden = false;
    button.style.top = '';
    button.style.right = '';
    button.style.left = '';
    button.style.bottom = '';
    button.style.position = '';
    syncCounterpartLink(toolbar, payload);
    return true;
  }

  async function sendQuickAdd(payload, action = 'add') {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error('Chrome runtime is unavailable.');
    }

    const result = await chrome.runtime.sendMessage({
      type: QUICK_ADD_MESSAGE,
      action,
      payload
    });

    if (!result || !result.ok) {
      throw new Error(getQuickAddErrorMessage(result));
    }

    return result;
  }

  async function openCounterpartLink(url) {
    if (!url) {
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const result = await chrome.runtime.sendMessage({
        type: OPEN_COUNTERPART_MESSAGE,
        url
      });
      if (!result || !result.ok) {
        throw new Error(result?.error || 'Open counterpart failed.');
      }
    } catch (error) {
      console.warn('[GMGN Token Quick Add]', error);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function refreshFavoriteState(button, payload) {
    const key = quickAddKey(payload);
    button.dataset.statusKey = key;
    try {
      const result = await sendQuickAdd(payload, 'status');
      if (button.dataset.statusKey !== key) {
        return;
      }

      setButtonFavorite(button, Boolean(result?.json?.favorite));
      setButtonTitle(button, payload);
    } catch (error) {
      console.warn('[GMGN Token Quick Add]', error);
    }
  }

  function renderButton() {
    const tokenInfo = resolveCurrentTokenInfo();
    if (!tokenInfo) {
      debugLog('skip: token info not found', { url: window.location.href });
      removeButton();
      return;
    }

    ensureStyle();

    const payload = buildQuickAddPayload(tokenInfo);
    let button = document.getElementById(BUTTON_ID);
    const key = `${payload.chain}:${payload.ca}`;
    const shouldRefreshStatus = !button || button.dataset.quickAddKey !== key;
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      document.body.appendChild(button);
      debugLog('button created', { url: window.location.href, tokenInfo });
    }

    button.dataset.ca = payload.ca;
    button.dataset.chain = payload.chain;
    button.dataset.quickAddKey = key;
    button.disabled = false;
    if (shouldRefreshStatus) {
      setButtonFavorite(button, false);
    }
    setButtonTitle(button, payload);
    syncButtonPlacement(button, payload);
    debugLog('button rendered', { payload, favorite: button.dataset.favorite, hidden: button.hidden });
    if (shouldRefreshStatus) {
      void refreshFavoriteState(button, payload);
    }

    button.onclick = async () => {
      const latestPayload = buildQuickAddPayload(resolveCurrentTokenInfo());
      if (!latestPayload) {
        const error = new Error('Token info not found on current page.');
        setButtonState(button, 'error', '!');
        button.title = error.message;
        console.warn('[GMGN Token Quick Add]', error);
        return;
      }

      const latestKey = quickAddKey(latestPayload);
      if (button.dataset.quickAddKey !== latestKey) {
        button.dataset.ca = latestPayload.ca;
        button.dataset.chain = latestPayload.chain;
        button.dataset.quickAddKey = latestKey;
        button.dataset.statusKey = '';
        setButtonFavorite(button, false);
        setButtonTitle(button, latestPayload);
        syncButtonPlacement(button, latestPayload);
      }

      const isFavorite = button.dataset.favorite === '1';
      const action = isFavorite ? 'remove' : 'add';
      button.disabled = true;
      setButtonState(button, '', PENDING_ICON);
      try {
        const result = await sendQuickAdd(latestPayload, action);
        setButtonFavorite(button, !isFavorite);
        setButtonTitle(button, latestPayload);
        debugLog('quick add finished', { action, payload: latestPayload, result });
      } catch (error) {
        setButtonState(button, 'error', '!');
        button.title = `${action === 'remove' ? 'Remove' : 'Add'} failed: ${error?.message || String(error)}`;
        button.setAttribute('aria-label', button.title);
        console.warn('[GMGN Token Quick Add]', { action, payload: latestPayload, error });
      } finally {
        setTimeout(() => {
          if (button.dataset.ca === latestPayload.ca && button.dataset.chain === latestPayload.chain) {
            button.disabled = false;
            if (button.classList.contains('is-error')) {
              setButtonFavorite(button, button.dataset.favorite === '1');
              setButtonTitle(button, latestPayload);
            }
          }
        }, 900);
      }
    };
  }

  function requestIdleRender(callback) {
    if (typeof window.requestIdleCallback === 'function') {
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
      if (renderScheduled) {
        return;
      }
      renderScheduled = true;
      requestIdleRender(() => {
        renderScheduled = false;
        renderIfRouteChanged();
      });
    };

    const wrapHistoryMethod = (methodName) => {
      const original = window.history?.[methodName];
      if (typeof original !== 'function') {
        return;
      }
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
      normalizeQuickAddChain,
      parseGmgnTokenPageUrl,
      buildQuickAddPayload,
      quickAddKey,
      getQuickAddErrorMessage,
      buildGmgnTokenUrl,
      buildFomoTokenUrl,
      buildCounterpartTokenLink
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

  window.__gcpTokenQuickAddDebug = {
    parse: () => parseGmgnTokenPageUrl(window.location.href),
    resolve: resolveCurrentTokenInfo,
    render: renderButton,
    buttonId: BUTTON_ID
  };
  debugLog('loaded', { url: window.location.href, tokenInfo: resolveCurrentTokenInfo() });
})();
