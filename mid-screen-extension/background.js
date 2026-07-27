const QUICK_ADD_MESSAGE = 'gmgn-token-quick-add';
const GMGN_FOCUS_ADDRESS_MESSAGE = 'gmgn-main-screen-focus-address';
const OPEN_COUNTERPART_MESSAGE = 'gmgn-open-token-counterpart';
const FAST_OPEN_MESSAGE = 'gmgn-main-screen-fast-open';
const FAST_NAVIGATE_MESSAGE = 'gmgn-main-screen-fast-navigate';
const SETTINGS_KEY = 'gmgnMainScreenSettings';
const NAV_TAB_KEY = 'gmgnMainScreenNavigationTab';
const FAST_TAB_STATE_KEY = 'gmgnMainScreenFastTabs';
const RELAY_CURSOR_KEY = 'gmgnMainScreenRelayCursor';
const DEFAULT_RELAY_BASE_URL = 'https://market-watch.macmini.lan';
const LEGACY_DEFAULT_RELAY_BASE_URL = 'http://127.0.0.1:17390';
const DEFAULT_MARKET_WATCH_DESK_BASE_URL = 'http://127.0.0.1:17387';
const RELAY_POLL_ALARM_NAME = 'gmgn-main-screen-relay-poll';
const RELAY_POLL_ALARM_MINUTES = 0.5;
const RELAY_WS_RECONNECT_MS = 1500;
const FAST_OPEN_DEDUPE_MS = 650;
const FAST_WARM_URLS = {
  x: 'https://x.com/home',
  gmgn: 'https://gmgn.ai/'
};

const DEFAULT_SETTINGS = {
  enabled: true,
  relayBaseUrl: DEFAULT_RELAY_BASE_URL,
  marketWatchDeskBaseUrl: DEFAULT_MARKET_WATCH_DESK_BASE_URL,
  openMode: 'new-tab',
  hideGmgnHeaderActions: true
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureSettings();
  configureRelayAlarm();
  startRelayWebSocket();
  void touchRelay();
  void ensureFastOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureSettings();
  configureRelayAlarm();
  startRelayWebSocket();
  void touchRelay();
  void ensureFastOpenTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RELAY_POLL_ALARM_NAME) {
    void startRelayWebSocket();
    void pollRelayFallback();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void touchRelay();

  if (message?.type === QUICK_ADD_MESSAGE && message.payload) {
    quickAddToken(message.payload, message.action || message.payload.action)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === GMGN_FOCUS_ADDRESS_MESSAGE && message.payload) {
    quickChangeFocusAddress(message.payload, message.action)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === OPEN_COUNTERPART_MESSAGE && message.url) {
    openUrlInThisProfile(message.url)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === FAST_OPEN_MESSAGE && (message.url || message.href)) {
    enqueueFastOpen(message.url || message.href)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === 'gmgn-main-screen-get-settings') {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === 'gmgn-main-screen-save-settings') {
    saveSettings(message.settings)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === 'gmgn-main-screen-check-relay') {
    checkRelayStatus()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type === 'gmgn-main-screen-open-url') {
    openUrlInThisProfile(message.url || 'https://gmgn.ai/')
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  return false;
});

let relayPollInFlight = false;
let relaySocket = null;
let relaySocketBaseUrl = '';
let relaySocketReconnectTimer = null;
let fastOpenQueue = Promise.resolve();
let lastFastOpen = { key: '', at: 0, result: null };
const fastTabPromises = new Map();

startRelayWebSocket();
void touchRelay();
void ensureFastOpenTabs();

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearRemovedFastTab(tabId);
});

async function startRelayWebSocket() {
  if (typeof WebSocket === 'undefined') {
    void pollRelayFallback();
    return;
  }
  const settings = await getSettings();
  if (!settings.enabled) {
    return;
  }
  const relayBaseUrl = normalizeBaseUrl(settings.relayBaseUrl) || DEFAULT_RELAY_BASE_URL;
  if (
    relaySocket
    && relaySocketBaseUrl === relayBaseUrl
    && (relaySocket.readyState === WebSocket.OPEN || relaySocket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  closeRelayWebSocket();
  const wsUrl = buildWebSocketUrl(relayBaseUrl);
  if (!wsUrl) {
    return;
  }

  relaySocketBaseUrl = relayBaseUrl;
  relaySocket = new WebSocket(wsUrl);
  relaySocket.onopen = () => {
    sendRelaySocketMessage({
      type: 'hello',
      role: 'main',
      client: 'gmgn-main-screen-extension'
    });
  };
  relaySocket.onmessage = (event) => {
    void handleRelaySocketMessage(event.data, relayBaseUrl);
  };
  relaySocket.onclose = () => {
    scheduleRelayWebSocketReconnect();
  };
  relaySocket.onerror = () => {
    scheduleRelayWebSocketReconnect();
  };
}

function closeRelayWebSocket() {
  if (relaySocket) {
    relaySocket.onopen = null;
    relaySocket.onmessage = null;
    relaySocket.onclose = null;
    relaySocket.onerror = null;
    try {
      relaySocket.close();
    } catch (_error) {}
  }
  relaySocket = null;
}

function scheduleRelayWebSocketReconnect() {
  closeRelayWebSocket();
  if (relaySocketReconnectTimer) {
    return;
  }
  relaySocketReconnectTimer = setTimeout(() => {
    relaySocketReconnectTimer = null;
    void startRelayWebSocket();
  }, RELAY_WS_RECONNECT_MS);
}

async function handleRelaySocketMessage(rawMessage, relayBaseUrl) {
  let message;
  try {
    message = JSON.parse(String(rawMessage || ''));
  } catch (_error) {
    return;
  }

  if (message.type === 'hello' || message.type === 'pending') {
    const events = Array.isArray(message.pendingEvents)
      ? message.pendingEvents
      : (Array.isArray(message.events) ? message.events : []);
    for (const event of events) {
      await handleRelayEvent(event, await getSettings());
      await acknowledgeRelayEvents(relayBaseUrl, [event.id]);
    }
    return;
  }

  if (message.type === 'event' && message.event) {
    await handleRelayEvent(message.event, await getSettings());
    await acknowledgeRelayEvents(relayBaseUrl, [message.event.id]);
  }
}

function sendRelaySocketMessage(message) {
  if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) {
    return false;
  }
  relaySocket.send(JSON.stringify(message));
  return true;
}

async function pollRelayFallback() {
  if (relayPollInFlight) {
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled) {
    return;
  }

  const relayBaseUrl = normalizeBaseUrl(settings.relayBaseUrl) || DEFAULT_RELAY_BASE_URL;
  const cursorState = await chrome.storage.local.get(RELAY_CURSOR_KEY);
  const after = Number(cursorState[RELAY_CURSOR_KEY] || 0);
  const url = buildUrl(relayBaseUrl, `/events?target=main&after=${encodeURIComponent(String(after))}&limit=25`);
  if (!url) {
    return;
  }

  relayPollInFlight = true;
  try {
    await registerRelayHeartbeat(relayBaseUrl);
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    const events = Array.isArray(body?.events) ? body.events : [];
    let nextCursor = Number(body?.cursor || after);
    for (const event of events) {
      nextCursor = Math.max(nextCursor, Number(event.id || 0));
      await handleRelayEvent(event, settings);
      await acknowledgeRelayEvents(relayBaseUrl, [event.id]);
    }
    if (nextCursor > after) {
      await chrome.storage.local.set({ [RELAY_CURSOR_KEY]: nextCursor });
    }
  } catch (_error) {
    // Relay is optional and may be offline while Chrome is running.
  } finally {
    relayPollInFlight = false;
  }
}

async function touchRelay(preloadedSettings) {
  const settings = preloadedSettings || await getSettings();
  if (!settings.enabled) {
    return;
  }
  const relayBaseUrl = normalizeBaseUrl(settings.relayBaseUrl) || DEFAULT_RELAY_BASE_URL;
  await registerRelayHeartbeat(relayBaseUrl);
  void startRelayWebSocket();
}

async function checkRelayStatus() {
  const settings = await getSettings();
  const relayBaseUrl = normalizeBaseUrl(settings.relayBaseUrl) || DEFAULT_RELAY_BASE_URL;
  const healthUrl = buildUrl(relayBaseUrl, '/health');
  const clientsUrl = buildUrl(relayBaseUrl, '/clients');
  if (!healthUrl || !clientsUrl) {
    return { ok: false, error: 'Relay Base URL is invalid.' };
  }
  const healthResponse = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
  if (!healthResponse.ok) {
    return { ok: false, status: healthResponse.status, error: `Relay health returned HTTP ${healthResponse.status}.` };
  }
  const clientsResponse = await fetch(clientsUrl, { method: 'GET', cache: 'no-store' });
  const health = await healthResponse.json();
  const clients = clientsResponse.ok ? await clientsResponse.json() : { clients: [] };
  return { ok: true, health, clients: clients.clients || [] };
}

async function registerRelayHeartbeat(relayBaseUrl) {
  const url = buildUrl(relayBaseUrl, '/clients/heartbeat');
  if (!url) {
    return;
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'main',
      client: 'gmgn-main-screen-extension',
      ts: new Date().toISOString()
    })
  }).catch(() => {});
}

async function acknowledgeRelayEvents(relayBaseUrl, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }
  if (sendRelaySocketMessage({
    type: 'ack',
    ids,
    client: 'gmgn-main-screen-extension'
  })) {
    return;
  }
  const url = buildUrl(relayBaseUrl, '/events/ack');
  if (!url) {
    return;
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      client: 'gmgn-main-screen-extension'
    })
  }).catch(() => {});
}

async function handleRelayEvent(event, settings) {
  if (event?.type !== 'open-url' || event.target !== 'main') {
    return;
  }
  const url = String(event.url || event.payload?.url || '').trim();
  if (!isAllowedNavigationUrl(url, event)) {
    return;
  }
  await openUrlInThisProfile(url, settings.openMode, event);
}

async function quickAddToken(payload, action = 'add') {
  const body = normalizeQuickAddPayload(payload);
  const settings = await getSettings();
  const normalizedAction = String(action || 'add').trim().toLowerCase();
  const path = normalizedAction === 'status' || normalizedAction === 'check'
    ? '/quick-add/status'
    : (normalizedAction === 'remove' || normalizedAction === 'delete' || normalizedAction === 'unfavorite'
      ? '/quick-add/remove'
      : '/quick-add');
  const requestUrl = buildUrl(settings.marketWatchDeskBaseUrl, path);
  if (!requestUrl) {
    return { ok: false, error: 'Market Watch Desk Base URL is invalid.' };
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const responseText = await response.text().catch(() => '');
  let responseJson = null;
  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch (_error) {
    responseJson = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: responseText.slice(0, 500),
    json: responseJson,
    url: requestUrl
  };
}

function normalizeFocusChain(value) {
  let chain = String(value || '').trim().toLowerCase();
  if (chain === 'solana') chain = 'sol';
  if (chain === 'ethereum') chain = 'eth';
  if (chain === 'bnb' || chain === 'binance') chain = 'bsc';
  if (chain === 'rh' || chain.replace(/[\s_-]+/g, '') === 'robinhoodchain') chain = 'robinhood';
  return /^(sol|eth|bsc|base|tron|blast|robinhood)$/.test(chain) ? chain : '';
}

function normalizeFocusAddressPayload(payload) {
  const address = String(payload?.address || '').trim();
  const isEvm = /^0x[a-f0-9]{40}$/i.test(address);
  const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(address);
  const isTron = /^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(address);
  if (!isEvm && !isBase58 && !isTron) throw new Error('Wallet address is invalid.');
  const requestedChain = normalizeFocusChain(payload?.chain);
  const chain = isEvm ? 'eth' : requestedChain;
  if (!chain) throw new Error('Wallet chain is invalid.');
  return {
    chain,
    address,
    alias: String(payload?.alias || '').trim().slice(0, 100),
    name: String(payload?.name || '').trim().slice(0, 100),
    focusPushEnabled: payload?.focusPushEnabled !== false,
    source: String(payload?.source || 'gmgn-main-screen-profile').trim().slice(0, 100),
    sourceUrl: String(payload?.sourceUrl || '').trim().slice(0, 500)
  };
}

async function quickChangeFocusAddress(payload, action = 'status') {
  const item = normalizeFocusAddressPayload(payload);
  const settings = await getSettings();
  const baseUrl = normalizeBaseUrl(settings.relayBaseUrl) || DEFAULT_RELAY_BASE_URL;
  const query = `?chain=${encodeURIComponent(item.chain)}&address=${encodeURIComponent(item.address)}`;
  const normalizedAction = String(action || 'status').trim().toLowerCase();
  const requestUrl = buildUrl(baseUrl, `/focus-addresses${normalizedAction === 'add' ? '' : query}`);
  if (!requestUrl) throw new Error('Relay Base URL is invalid.');

  const response = await fetch(requestUrl, {
    method: normalizedAction === 'add'
      ? 'POST'
      : (normalizedAction === 'remove' || normalizedAction === 'delete' ? 'DELETE' : 'GET'),
    headers: normalizedAction === 'add' ? { 'Content-Type': 'application/json' } : undefined,
    body: normalizedAction === 'add' ? JSON.stringify(item) : undefined,
    cache: 'no-store'
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || `Relay returned HTTP ${response.status}.`);
  }
  const focus = normalizedAction === 'add'
    ? Boolean(json?.item)
    : (normalizedAction === 'remove' || normalizedAction === 'delete' ? false : Boolean(json?.item));
  return { ok: true, action: normalizedAction, focus, item: json?.item || null };
}

function normalizeQuickAddPayload(payload) {
  const ca = String(payload?.ca || '').trim();
  const chain = normalizeChain(payload?.chain);
  const note = String(payload?.note || 'from GMGN main screen').trim() || 'from GMGN main screen';
  const tags = String(payload?.tags || 'gmgn,quick-add,main-screen').trim() || 'gmgn,quick-add,main-screen';

  if (!ca) {
    throw new Error('Token CA is empty.');
  }
  if (!chain) {
    throw new Error(`Unsupported chain: ${payload?.chain || '(empty)'}`);
  }

  return { ca, chain, chainId: mapChainId(chain), note, tags };
}

function normalizeChain(chain) {
  const normalized = String(chain || '').trim().toLowerCase();
  const map = {
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
  return map[normalized] || map[normalized.replace(/[\s_-]+/g, '')] || '';
}

function mapChainId(chain) {
  return {
    solana: '501',
    bsc: '56',
    ethereum: '1',
    base: '8453',
    tron: '728126428',
    blast: '81457',
    robinhood: '4663'
  }[chain] || '';
}

async function openUrlInThisProfile(rawUrl, openMode, navigationContext = null) {
  const url = String(rawUrl || '').trim();
  if (!isAllowedNavigationUrl(url, navigationContext)) {
    throw new Error('Blocked navigation URL.');
  }

  if (getFastOpenKind(url)) {
    return enqueueFastOpen(url);
  }

  const settings = await getSettings();
  const mode = shouldForceNewTab(rawUrl) ? 'new-tab' : (openMode || settings.openMode);
  if (mode === 'new-tab') {
    const tab = await chrome.tabs.create({ url, active: true });
    await rememberNavigationTab(tab);
    return { ok: true, tabId: tab.id, mode };
  }

  const stored = await chrome.storage.local.get(NAV_TAB_KEY);
  const remembered = stored[NAV_TAB_KEY];
  if (remembered?.tabId) {
    try {
      const tab = await chrome.tabs.get(remembered.tabId);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url, active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        return { ok: true, tabId: tab.id, windowId: tab.windowId, mode: 'remembered-tab' };
      }
    } catch (_error) {
      await chrome.storage.local.remove(NAV_TAB_KEY);
    }
  }

  const existingTabs = await chrome.tabs.query({});
  const candidate = existingTabs.find((tab) => isMainScreenUrl(tab.url));
  if (candidate?.id) {
    await chrome.tabs.update(candidate.id, { url, active: true });
    if (candidate.windowId) {
      await chrome.windows.update(candidate.windowId, { focused: true });
    }
    await rememberNavigationTab(candidate);
    return { ok: true, tabId: candidate.id, windowId: candidate.windowId, mode: 'existing-tab' };
  }

  const tab = await chrome.tabs.create({ url, active: true });
  await rememberNavigationTab(tab);
  return { ok: true, tabId: tab.id, windowId: tab.windowId, mode: 'created-tab' };
}

function enqueueFastOpen(rawUrl) {
  const url = normalizeFastOpenUrl(rawUrl);
  const kind = getFastOpenKind(url);
  if (!kind) {
    return Promise.reject(new Error('Fast open supports only X and GMGN URLs.'));
  }
  const key = `${kind}:${url}`;
  const now = Date.now();
  if (lastFastOpen.key === key && now - lastFastOpen.at < FAST_OPEN_DEDUPE_MS && lastFastOpen.result) {
    return lastFastOpen.result;
  }
  const job = fastOpenQueue
    .catch(() => {})
    .then(() => openFastUrl(url, kind));
  fastOpenQueue = job;
  lastFastOpen = { key, at: now, result: job };
  return job;
}

async function openFastUrl(url, kind) {
  const tab = await ensureFastOpenTab(kind);
  if (!tab?.id) {
    throw new Error(`Unable to create ${kind.toUpperCase()} fast tab.`);
  }

  await focusTab(tab);
  let spaResult = { ok: false, reason: 'tab-not-ready' };
  if (tab.status === 'complete' && !isShortLink(url)) {
    spaResult = await sendFastNavigation(tab.id, url);
  }
  if (spaResult.ok) {
    await rememberFastTab(kind, { ...tab, url });
    return {
      ok: true,
      tabId: tab.id,
      windowId: tab.windowId,
      mode: `${kind}-spa`,
      reason: spaResult.reason
    };
  }

  let updated;
  if (sameFastRoute(tab.url, url)) {
    await chrome.tabs.reload(tab.id);
    updated = await chrome.tabs.get(tab.id);
  } else {
    updated = await chrome.tabs.update(tab.id, { url, active: true });
  }
  await focusTab(updated || tab);
  await rememberFastTab(kind, updated || { ...tab, url });
  return {
    ok: true,
    tabId: tab.id,
    windowId: tab.windowId,
    mode: `${kind}-normal-navigation`,
    fallbackReason: spaResult.reason
  };
}

async function ensureFastOpenTabs() {
  await ensureFastOpenTab('x');
  await ensureFastOpenTab('gmgn');
}

async function ensureFastOpenTab(kind) {
  if (fastTabPromises.has(kind)) {
    return fastTabPromises.get(kind);
  }
  const job = createOrRestoreFastOpenTab(kind).finally(() => {
    fastTabPromises.delete(kind);
  });
  fastTabPromises.set(kind, job);
  return job;
}

async function createOrRestoreFastOpenTab(kind) {
  const state = await getFastTabState();
  const remembered = state[kind];
  if (remembered?.tabId) {
    try {
      const tab = await chrome.tabs.get(remembered.tabId);
      if (tab?.id && getFastOpenKind(tab.url) === kind && !isProtectedGmgnMonitorUrl(tab.url)) {
        return tab;
      }
    } catch (_error) {}
    delete state[kind];
    await chrome.storage.local.set({ [FAST_TAB_STATE_KEY]: state });
  }

  const tab = await chrome.tabs.create({
    url: FAST_WARM_URLS[kind],
    active: false
  });
  await rememberFastTab(kind, tab);
  return tab;
}

async function sendFastNavigation(tabId, href) {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, {
        type: FAST_NAVIGATE_MESSAGE,
        href
      }),
      new Promise((resolve) => setTimeout(() => resolve({
        ok: false,
        reason: 'service-worker-timeout'
      }), 2600))
    ]);
    return response && typeof response === 'object'
      ? response
      : { ok: false, reason: 'empty-response' };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}

async function focusTab(tab) {
  if (!tab?.id) {
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

async function rememberFastTab(kind, tab) {
  if (!tab?.id) {
    return;
  }
  const state = await getFastTabState();
  state[kind] = {
    tabId: tab.id,
    windowId: tab.windowId || null,
    url: String(tab.url || FAST_WARM_URLS[kind]),
    owned: true,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [FAST_TAB_STATE_KEY]: state });
}

async function getFastTabState() {
  const stored = await chrome.storage.local.get(FAST_TAB_STATE_KEY);
  const value = stored[FAST_TAB_STATE_KEY];
  return value && typeof value === 'object' ? { ...value } : {};
}

async function clearRemovedFastTab(tabId) {
  const state = await getFastTabState();
  let changed = false;
  for (const kind of ['x', 'gmgn']) {
    if (state[kind]?.tabId === tabId) {
      delete state[kind];
      changed = true;
    }
  }
  if (changed) {
    await chrome.storage.local.set({ [FAST_TAB_STATE_KEY]: state });
  }
}

function normalizeFastOpenUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim());
    if (url.protocol !== 'https:') {
      return '';
    }
    const kind = getFastOpenKind(url.toString());
    if (kind === 'x' && url.hostname.toLowerCase() !== 't.co') {
      url.hostname = 'x.com';
    }
    return kind ? url.toString() : '';
  } catch (_error) {
    return '';
  }
}

function getFastOpenKind(rawUrl) {
  try {
    const hostname = new URL(String(rawUrl || '')).hostname.toLowerCase();
    if (
      hostname === 'x.com'
      || hostname.endsWith('.x.com')
      || hostname === 'twitter.com'
      || hostname.endsWith('.twitter.com')
      || hostname === 't.co'
    ) {
      return 'x';
    }
    if (hostname === 'gmgn.ai' || hostname.endsWith('.gmgn.ai')) {
      return 'gmgn';
    }
  } catch (_error) {}
  return '';
}

function isProtectedGmgnMonitorUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    return getFastOpenKind(url.toString()) === 'gmgn'
      && /^\/follow(?:\/|$)/i.test(url.pathname);
  } catch (_error) {
    return false;
  }
}

function isShortLink(rawUrl) {
  try {
    return new URL(String(rawUrl || '')).hostname.toLowerCase() === 't.co';
  } catch (_error) {
    return false;
  }
}

function sameFastRoute(left, right) {
  try {
    const leftUrl = new URL(String(left || ''));
    const rightUrl = new URL(String(right || ''));
    return leftUrl.hostname.toLowerCase() === rightUrl.hostname.toLowerCase()
      && leftUrl.pathname.replace(/\/+$/, '') === rightUrl.pathname.replace(/\/+$/, '')
      && leftUrl.search === rightUrl.search;
  } catch (_error) {
    return false;
  }
}

function shouldForceNewTab(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    return parsed.hostname === 'gmgn.ai' || parsed.hostname.endsWith('.gmgn.ai');
  } catch (_error) {
    return false;
  }
}

async function rememberNavigationTab(tab) {
  if (!tab?.id) {
    return;
  }
  await chrome.storage.local.set({
    [NAV_TAB_KEY]: {
      tabId: tab.id,
      windowId: tab.windowId || null,
      updatedAt: new Date().toISOString()
    }
  });
}

function isAllowedNavigationUrl(rawUrl, context = null) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (isTrustedRelaySiteEvent(context)) {
      return url.protocol === 'http:' || url.protocol === 'https:';
    }
    return url.protocol === 'https:'
      && /(^|\.)((gmgn\.ai)|(fomo\.family)|(debot\.ai)|(x\.com)|(twitter\.com)|(t\.co))$/i.test(url.hostname);
  } catch (_error) {
    return false;
  }
}

function isMainScreenUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    return /(^|\.)((gmgn\.ai)|(fomo\.family)|(debot\.ai)|(x\.com)|(twitter\.com)|(t\.co))$/i.test(url.hostname);
  } catch (_error) {
    return false;
  }
}

function isTrustedRelaySiteEvent(context) {
  const source = String(context?.source || context?.payload?.source || '').trim();
  const sourceOrigin = String(context?.payload?.sourceOrigin || context?.sourceOrigin || '').trim();
  const isRelaySite = source === 'monitor-relay-site'
    && /^https:\/\/market-watch\.macmini\.lan$/i.test(sourceOrigin);
  const isMonitorScreen = source === 'gmgn-monitor-screen'
    && /^https:\/\/([^.]+\.)?gmgn\.ai$/i.test(sourceOrigin);
  return isRelaySite || isMonitorScreen;
}

async function ensureSettings() {
  const settings = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

async function saveSettings(value) {
  const settings = normalizeSettings(value);
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  configureRelayAlarm();
  closeRelayWebSocket();
  void startRelayWebSocket();
  return settings;
}

function configureRelayAlarm() {
  chrome.alarms.create(RELAY_POLL_ALARM_NAME, {
    delayInMinutes: 0.05,
    periodInMinutes: RELAY_POLL_ALARM_MINUTES
  });
}

function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SETTINGS.enabled,
    relayBaseUrl: normalizeRelayBaseUrl(input.relayBaseUrl),
    marketWatchDeskBaseUrl: normalizeBaseUrl(input.marketWatchDeskBaseUrl) || DEFAULT_SETTINGS.marketWatchDeskBaseUrl,
    openMode: input.openMode === 'new-tab' ? 'new-tab' : DEFAULT_SETTINGS.openMode,
    hideGmgnHeaderActions: typeof input.hideGmgnHeaderActions === 'boolean'
      ? input.hideGmgnHeaderActions
      : DEFAULT_SETTINGS.hideGmgnHeaderActions
  };
}

function normalizeRelayBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized || normalized === LEGACY_DEFAULT_RELAY_BASE_URL) {
    return DEFAULT_SETTINGS.relayBaseUrl;
  }
  return normalized;
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (_error) {
    return '';
  }
}

function buildUrl(baseUrl, path) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) {
    return '';
  }
  try {
    const url = new URL(path, `${base}/`);
    return url.toString();
  } catch (_error) {
    return '';
  }
}

function buildWebSocketUrl(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) {
    return '';
  }
  try {
    const url = new URL('/ws', `${base}/`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('role', 'main');
    url.searchParams.set('client', 'gmgn-main-screen-extension');
    url.searchParams.set('target', 'main');
    return url.toString();
  } catch (_error) {
    return '';
  }
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}
