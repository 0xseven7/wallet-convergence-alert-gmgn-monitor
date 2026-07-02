const OPEN_LINK_MESSAGE = 'open-in-main-window';
const SET_MAIN_WINDOW_MESSAGE = 'set-main-window';
const GET_MAIN_WINDOW_MESSAGE = 'get-main-window';
const CLEAR_MAIN_WINDOW_MESSAGE = 'clear-main-window';
const REGISTER_MONITOR_TAB_MESSAGE = 'register-monitor-tab';
const ALLOW_MONITOR_NAVIGATION_MESSAGE = 'allow-monitor-navigation';
const DISPATCH_GMGN_TWITTER_HOOK_MESSAGE = 'dispatch-gmgn-twitter-trigger-hook';
const DISPATCH_GMGN_SIGNAL_EVENT_MESSAGE = 'dispatch-gmgn-signal-event';
const FETCH_TWITTER_TTS_AUDIO_MESSAGE = 'fetch-twitter-tts-audio';
const GMGN_TOKEN_QUICK_ADD_MESSAGE = 'gmgn-token-quick-add';
const GMGN_OPEN_TOKEN_COUNTERPART_MESSAGE = 'gmgn-open-token-counterpart';
const GMGN_TOKEN_QUICK_ADD_URL = 'http://127.0.0.1:17387/quick-add';
const GMGN_TOKEN_QUICK_ADD_STATUS_URL = 'http://127.0.0.1:17387/quick-add/status';
const GMGN_TOKEN_QUICK_ADD_REMOVE_URL = 'http://127.0.0.1:17387/quick-add/remove';
const DEFAULT_TTS_API = 'http://tts.macmini.lan/tts/v3-task';
const LEGACY_MAIN_WINDOW_STORAGE_KEY = 'mainWindowId';
const MAIN_WINDOW_STORAGE_KEY = 'mainWindowState';
const MONITOR_STATE_STORAGE_KEY = 'monitorState';
const DEFAULT_MONITOR_URL = 'https://gmgn.ai/follow';
const SETTINGS_PAGE_PATH = 'settings.html';
const TWITTER_AUDIO_MAPPING_STORAGE_KEY = 'twitterAudioMappings';
const GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
const GMGN_TWITTER_TRIGGER_RULES_KEY = 'gmgnTwitterTriggerRules';
const GMGN_TWITTER_TRADE_PROFILES_KEY = 'gmgnTwitterTradeProfiles';
const GMGN_FOLLOW_CHAIN_SEGMENT = '(?:sol|eth|bsc|base|tron|blast)';
const TWITTER_AUDIO_DEFAULTS = {
  twitterAudioMappings: {
    elonmusk: { id: 'elonmusk.MP3', name: 'elonmusk.MP3', remark: '' },
    cz_binance: { id: 'CZ.MP3', name: 'CZ.MP3', remark: '' },
    heyibinance: { id: 'heyi.MP3', name: 'heyi.MP3', remark: '' }
  },
  customAudios: {},
  isMasterEnabled: true,
  globalVolume: 1,
  defaultAudio: 'default.MP3',
  eventFilters: {
    tweet: true,
    repost: true,
    reply: true,
    quote: true,
    other: true
  },
  playDefaultUnmapped: true,
  enableTTS: true,
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: '+0%',
  ttsPitch: '+0%',
  ttsApiUrl: DEFAULT_TTS_API
};
const GMGN_TWITTER_TRIGGER_HOOK_DEFAULTS = {
  enabled: false,
  webhookUrl: '',
  secret: '',
  timeoutMs: 3000,
  eventApiEnabled: false,
  eventApiUrl: '',
  eventApiToken: '',
  eventSendWalletTrades: true,
  eventSendConvergenceAlerts: true,
  directCaEnabled: false,
  directCaChain: 'bsc',
  directCaBuyAmount: '',
  directCaTwitterIds: ''
};
const GMGN_TWITTER_TRIGGER_RULE_DEFAULTS = [];
const GMGN_TWITTER_TRADE_PROFILE_DEFAULTS = [];

let monitorState = {
  tabId: null,
  windowId: null,
  followUrl: DEFAULT_MONITOR_URL,
  allowedNavigationUrl: null,
  suppressNextRedirect: false
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === OPEN_LINK_MESSAGE && message.url) {
    const monitorWindowId = sender.tab ? sender.tab.windowId : undefined;

    openInMainWindow(message.url, monitorWindowId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === DISPATCH_GMGN_TWITTER_HOOK_MESSAGE && message.payload) {
    dispatchGmgnTwitterTriggerHook(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === DISPATCH_GMGN_SIGNAL_EVENT_MESSAGE && message.payload) {
    dispatchGmgnSignalEvent(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === FETCH_TWITTER_TTS_AUDIO_MESSAGE && message.payload) {
    fetchTwitterTtsAudio(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === GMGN_TOKEN_QUICK_ADD_MESSAGE && message.payload) {
    quickAddGmgnToken(message.payload, message.action || message.payload.action)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === GMGN_OPEN_TOKEN_COUNTERPART_MESSAGE && message.url) {
    const preferredWindowId = sender.tab ? sender.tab.windowId : null;
    openTokenCounterpartUrl(message.url, preferredWindowId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === SET_MAIN_WINDOW_MESSAGE && Number.isInteger(message.windowId)) {
    setMainWindow(message.windowId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === GET_MAIN_WINDOW_MESSAGE) {
    getMainWindowState()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === CLEAR_MAIN_WINDOW_MESSAGE) {
    clearMainWindow()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === REGISTER_MONITOR_TAB_MESSAGE) {
    const tabId = sender.tab ? sender.tab.id : null;
    const windowId = sender.tab ? sender.tab.windowId : null;

    monitorState = {
      ...monitorState,
      tabId,
      windowId,
      followUrl: normalizeMonitorUrl(message.url) || DEFAULT_MONITOR_URL
    };
    persistMonitorState();
    void refreshActionBadges();

    sendResponse({ ok: true, tabId, windowId, followUrl: monitorState.followUrl });
    return false;
  }

  if (message.type === ALLOW_MONITOR_NAVIGATION_MESSAGE) {
    monitorState.allowedNavigationUrl = normalizeUrl(message.url);
    persistMonitorState();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ensureMonitorState();
  await refreshStoredMainWindowSnapshotForTab(tab);
  await refreshActionBadges();

  if (!changeInfo.url) {
    return;
  }

  const nextUrl = normalizeUrl(changeInfo.url);
  if (!nextUrl) {
    return;
  }

  if (tab.openerTabId === monitorState.tabId && isExternalToGmgn(nextUrl)) {
    try {
      await openInMainWindow(nextUrl, monitorState.windowId || tab.windowId);
      await chrome.tabs.remove(tabId);
    } catch (_error) {
      return;
    }

    return;
  }

  if (tabId !== monitorState.tabId) {
    return;
  }

  if (isFollowUrl(nextUrl)) {
    monitorState.followUrl = nextUrl;
    monitorState.allowedNavigationUrl = null;
    monitorState.suppressNextRedirect = false;
    persistMonitorState();
    void refreshActionBadges();
    return;
  }

  if (monitorState.suppressNextRedirect) {
    monitorState.suppressNextRedirect = false;
    persistMonitorState();
    return;
  }

  if (monitorState.allowedNavigationUrl && urlsMatch(nextUrl, monitorState.allowedNavigationUrl)) {
    monitorState.allowedNavigationUrl = null;
    persistMonitorState();
    return;
  }

  const monitorWindowId = tab.windowId;

  try {
    await openInMainWindow(nextUrl, monitorWindowId);
  } catch (_error) {
    return;
  }

  monitorState.allowedNavigationUrl = null;
  monitorState.suppressNextRedirect = true;
  persistMonitorState();
  await chrome.tabs.update(tabId, { url: monitorState.followUrl || DEFAULT_MONITOR_URL });
});

chrome.action.onClicked.addListener((tab) => {
  const preferredWindowId = tab && Number.isInteger(tab.windowId) ? tab.windowId : null;
  void openSettingsPageInWindow(preferredWindowId);
});

chrome.tabs.onActivated.addListener(() => {
  void refreshActionBadges();
});

chrome.tabs.onCreated.addListener((tab) => {
  void refreshStoredMainWindowSnapshotForTab(tab);
  void refreshActionBadges();
});

chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
  void refreshStoredMainWindowSnapshot(attachInfo.newWindowId);
  void refreshActionBadges();
});

chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
  void refreshStoredMainWindowSnapshot(detachInfo.oldWindowId);
  void refreshActionBadges();
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === monitorState.tabId) {
    monitorState = {
      tabId: null,
      windowId: null,
      followUrl: DEFAULT_MONITOR_URL,
      allowedNavigationUrl: null,
      suppressNextRedirect: false
    };
    persistMonitorState();
  }

  void refreshStoredMainWindowSnapshot(removeInfo.windowId);
  void refreshActionBadges();
});

chrome.windows.onFocusChanged.addListener(() => {
  void refreshActionBadges();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtensionState();
});

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionState();
});

async function initializeExtensionState() {
  await ensureMonitorState();
  await ensureTwitterAudioDefaults();
  await ensureGmgnTwitterTriggerHookDefaults();
  await refreshActionBadges();
}

async function openSettingsPageInWindow(preferredWindowId) {
  const settingsUrl = chrome.runtime.getURL(SETTINGS_PAGE_PATH);
  const existingTabs = await chrome.tabs.query({ url: settingsUrl });
  const existingTab = existingTabs.find((tab) => tab.windowId === preferredWindowId && Number.isInteger(tab.id));

  if (existingTab && Number.isInteger(existingTab.id)) {
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.windows.update(existingTab.windowId, { focused: true });
    return;
  }

  const createProperties = {
    url: settingsUrl,
    active: true
  };

  if (Number.isInteger(preferredWindowId)) {
    createProperties.windowId = preferredWindowId;
  }

  const createdTab = await chrome.tabs.create(createProperties);
  if (Number.isInteger(createdTab.windowId)) {
    await chrome.windows.update(createdTab.windowId, { focused: true });
  }
}

async function ensureTwitterAudioDefaults() {
  const stored = await chrome.storage.local.get([
    TWITTER_AUDIO_MAPPING_STORAGE_KEY,
    'customAudios',
    'isMasterEnabled',
    'globalVolume',
    'defaultAudio',
    'eventFilters',
    'playDefaultUnmapped',
    'enableTTS',
    'ttsVoice',
    'ttsRate',
    'ttsPitch',
    'ttsApiUrl'
  ]);

  const nextState = {};

  if (!stored[TWITTER_AUDIO_MAPPING_STORAGE_KEY] || typeof stored[TWITTER_AUDIO_MAPPING_STORAGE_KEY] !== 'object') {
    nextState[TWITTER_AUDIO_MAPPING_STORAGE_KEY] = TWITTER_AUDIO_DEFAULTS.twitterAudioMappings;
  }
  if (!stored.customAudios || typeof stored.customAudios !== 'object') {
    nextState.customAudios = TWITTER_AUDIO_DEFAULTS.customAudios;
  }
  if (typeof stored.isMasterEnabled !== 'boolean') {
    nextState.isMasterEnabled = TWITTER_AUDIO_DEFAULTS.isMasterEnabled;
  }
  if (typeof stored.globalVolume !== 'number') {
    nextState.globalVolume = TWITTER_AUDIO_DEFAULTS.globalVolume;
  }
  if (typeof stored.defaultAudio !== 'string') {
    nextState.defaultAudio = TWITTER_AUDIO_DEFAULTS.defaultAudio;
  }
  if (!stored.eventFilters || typeof stored.eventFilters !== 'object') {
    nextState.eventFilters = TWITTER_AUDIO_DEFAULTS.eventFilters;
  }
  if (typeof stored.playDefaultUnmapped !== 'boolean') {
    nextState.playDefaultUnmapped = TWITTER_AUDIO_DEFAULTS.playDefaultUnmapped;
  }
  if (typeof stored.enableTTS !== 'boolean') {
    nextState.enableTTS = TWITTER_AUDIO_DEFAULTS.enableTTS;
  }
  if (typeof stored.ttsVoice !== 'string') {
    nextState.ttsVoice = TWITTER_AUDIO_DEFAULTS.ttsVoice;
  }
  if (typeof stored.ttsRate !== 'string') {
    nextState.ttsRate = TWITTER_AUDIO_DEFAULTS.ttsRate;
  }
  if (typeof stored.ttsPitch !== 'string') {
    nextState.ttsPitch = TWITTER_AUDIO_DEFAULTS.ttsPitch;
  }
  if (typeof stored.ttsApiUrl !== 'string') {
    nextState.ttsApiUrl = TWITTER_AUDIO_DEFAULTS.ttsApiUrl;
  }

  if (Object.keys(nextState).length > 0) {
    await chrome.storage.local.set(nextState);
  }
}

async function ensureGmgnTwitterTriggerHookDefaults() {
  const stored = await chrome.storage.local.get([
    GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY,
    GMGN_TWITTER_TRIGGER_RULES_KEY,
    GMGN_TWITTER_TRADE_PROFILES_KEY
  ]);

  const nextState = {};

  if (
    !stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]
    || typeof stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY] !== 'object'
  ) {
    nextState[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY] = GMGN_TWITTER_TRIGGER_HOOK_DEFAULTS;
  }

  if (!Array.isArray(stored[GMGN_TWITTER_TRIGGER_RULES_KEY])) {
    nextState[GMGN_TWITTER_TRIGGER_RULES_KEY] = GMGN_TWITTER_TRIGGER_RULE_DEFAULTS;
  }

  if (!Array.isArray(stored[GMGN_TWITTER_TRADE_PROFILES_KEY])) {
    nextState[GMGN_TWITTER_TRADE_PROFILES_KEY] = GMGN_TWITTER_TRADE_PROFILE_DEFAULTS;
  }

  if (Object.keys(nextState).length > 0) {
    await chrome.storage.local.set(nextState);
  }
}

function normalizeGmgnTwitterTriggerHookSettings(raw) {
  const settings = {
    ...GMGN_TWITTER_TRIGGER_HOOK_DEFAULTS,
    ...(raw || {})
  };

  settings.enabled = settings.enabled === true;
  settings.webhookUrl = typeof settings.webhookUrl === 'string' ? settings.webhookUrl.trim() : '';
  settings.secret = typeof settings.secret === 'string' ? settings.secret.trim() : '';
  settings.timeoutMs = clampHookTimeout(settings.timeoutMs);
  settings.eventApiEnabled = settings.eventApiEnabled === true;
  settings.eventApiUrl = typeof settings.eventApiUrl === 'string' ? settings.eventApiUrl.trim() : '';
  settings.eventApiToken = typeof settings.eventApiToken === 'string' ? settings.eventApiToken.trim() : '';
  settings.eventSendWalletTrades = settings.eventSendWalletTrades !== false;
  settings.eventSendConvergenceAlerts = settings.eventSendConvergenceAlerts !== false;
  settings.directCaEnabled = settings.directCaEnabled === true;
  settings.directCaChain = typeof settings.directCaChain === 'string' ? settings.directCaChain.trim().toLowerCase() : 'bsc';
  settings.directCaBuyAmount = typeof settings.directCaBuyAmount === 'string'
    ? settings.directCaBuyAmount.trim()
    : String(settings.directCaBuyAmount || '').trim();
  settings.directCaTwitterIds = typeof settings.directCaTwitterIds === 'string'
    ? settings.directCaTwitterIds.trim()
    : '';

  return settings;
}

function clampHookTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) return GMGN_TWITTER_TRIGGER_HOOK_DEFAULTS.timeoutMs;
  return Math.max(500, Math.min(15000, Math.round(timeout)));
}

async function dispatchGmgnTwitterTriggerHook(payload) {
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);

  if (!settings.enabled) {
    return { ok: false, skipped: true, error: 'Hook is disabled.' };
  }

  if (!settings.webhookUrl) {
    return { ok: false, skipped: true, error: 'Webhook URL is empty.' };
  }

  let webhookUrl;
  try {
    webhookUrl = new URL(settings.webhookUrl);
  } catch (_error) {
    return { ok: false, skipped: true, error: 'Webhook URL is invalid.' };
  }

  if (webhookUrl.protocol !== 'http:' && webhookUrl.protocol !== 'https:') {
    return { ok: false, skipped: true, error: 'Webhook URL must use http or https.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const headers = {
    'Content-Type': 'application/json',
    'x-gmgn-hook-source': 'wallet-convergence-alert-gmgn-monitor',
    'x-gmgn-hook-event': 'twitter-trigger'
  };

  if (settings.secret) {
    headers['x-gmgn-hook-secret'] = settings.secret;
  }

  try {
    const response = await fetch(webhookUrl.href, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        forwardedAt: Date.now()
      }),
      signal: controller.signal
    });

    const responseText = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.name === 'AbortError'
        ? `Webhook request timed out after ${settings.timeoutMs}ms.`
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchGmgnSignalEvent(payload) {
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const eventType = typeof payload?.type === 'string' ? payload.type.trim() : '';

  if (!settings.eventApiEnabled) {
    return { ok: false, skipped: true, error: 'Event API is disabled.' };
  }

  if (eventType === 'wallet_trade' && !settings.eventSendWalletTrades) {
    return { ok: false, skipped: true, error: 'wallet_trade forwarding is disabled.' };
  }

  if (eventType === 'convergence_alert' && !settings.eventSendConvergenceAlerts) {
    return { ok: false, skipped: true, error: 'convergence_alert forwarding is disabled.' };
  }

  if (!settings.eventApiUrl) {
    return { ok: false, skipped: true, error: 'Event API URL is empty.' };
  }

  if (!settings.eventApiToken) {
    return { ok: false, skipped: true, error: 'Event API token is empty.' };
  }

  let eventApiUrl;
  try {
    eventApiUrl = new URL(settings.eventApiUrl);
  } catch (_error) {
    return { ok: false, skipped: true, error: 'Event API URL is invalid.' };
  }

  if (eventApiUrl.protocol !== 'http:' && eventApiUrl.protocol !== 'https:') {
    return { ok: false, skipped: true, error: 'Event API URL must use http or https.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.eventApiToken}`,
    'x-gmgn-hook-source': 'wallet-convergence-alert-gmgn-monitor',
    'x-gmgn-hook-event': eventType || 'signal-event'
  };

  try {
    const response = await fetch(eventApiUrl.href, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const responseText = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.name === 'AbortError'
        ? `Event API request timed out after ${settings.timeoutMs}ms.`
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTwitterTtsAudio(payload) {
  const text = String(payload.text || '').trim();
  if (!text) {
    throw new Error('Missing TTS text.');
  }

  const ttsApiUrl = normalizeTtsApiUrl(payload.ttsApiUrl || DEFAULT_TTS_API);
  const request = buildTwitterTtsRequest(ttsApiUrl, text, {
    voice: payload.voice,
    rate: payload.rate,
    pitch: payload.pitch
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(request.url, {
      ...request.options,
      signal: controller.signal
    });
    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(`TTS request failed with ${response.status}${responseText ? `: ${responseText.slice(0, 180)}` : ''}`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    return {
      ok: true,
      url: request.url,
      contentType,
      size: buffer.byteLength,
      dataUrl: `data:${contentType};base64,${base64}`
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildTwitterTtsRequest(ttsApiUrl, text, options = {}) {
  if (usesMacminiTaskTts(ttsApiUrl)) {
    const url = new URL(ttsApiUrl);
    url.searchParams.set('data', text);
    return {
      url: url.toString(),
      options: {
        method: 'GET'
      }
    };
  }

  return {
    url: ttsApiUrl,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: options.voice,
        rate: options.rate,
        pitch: options.pitch
      })
    }
  };
}

function normalizeTtsApiUrl(value) {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return DEFAULT_TTS_API;
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch (_error) {}
  return DEFAULT_TTS_API;
}

function usesMacminiTaskTts(ttsApiUrl) {
  try {
    const url = new URL(ttsApiUrl);
    return url.hostname === 'tts.macmini.lan' && url.pathname === '/tts/v3-task';
  } catch (_error) {
    return false;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeQuickAddPayload(payload) {
  const ca = String(payload?.ca || '').trim();
  const chain = String(payload?.chain || '').trim().toLowerCase();
  const note = String(payload?.note || 'from GMGN plugin').trim() || 'from GMGN plugin';
  const tags = String(payload?.tags || 'gmgn,quick-add').trim() || 'gmgn,quick-add';

  if (!ca) {
    throw new Error('Token CA is empty.');
  }

  if (!/^(solana|bsc|ethereum|base|tron|blast)$/.test(chain)) {
    throw new Error(`Unsupported chain: ${chain || '(empty)'}`);
  }

  return { ca, chain, note, tags };
}

function getQuickAddRequestConfig(action) {
  const normalizedAction = String(action || 'add').trim().toLowerCase();
  if (normalizedAction === 'status' || normalizedAction === 'check') {
    return { url: GMGN_TOKEN_QUICK_ADD_STATUS_URL, method: 'POST', action: 'status' };
  }
  if (normalizedAction === 'remove' || normalizedAction === 'delete' || normalizedAction === 'unfavorite') {
    return { url: GMGN_TOKEN_QUICK_ADD_REMOVE_URL, method: 'POST', action: 'remove' };
  }
  return { url: GMGN_TOKEN_QUICK_ADD_URL, method: 'POST', action: 'add' };
}

async function quickAddGmgnToken(payload, action = 'add') {
  const body = normalizeQuickAddPayload(payload);
  const requestConfig = getQuickAddRequestConfig(action);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
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
      action: requestConfig.action,
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500),
      json: responseJson
    };
  } catch (error) {
    return {
      ok: false,
      action: requestConfig.action,
      error: error && error.name === 'AbortError'
        ? 'Quick add request timed out after 5000ms.'
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function openInMainWindow(url, monitorWindowId) {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
  const resolvedMainWindow = await resolveMainWindow(windows, { clearIfMissing: true });
  const selectedMainWindow = resolvedMainWindow.windowInfo;

  if (selectedMainWindow && selectedMainWindow.id !== monitorWindowId) {
    const existingTab = findTabByUrl(selectedMainWindow, url);
    if (existingTab && Number.isInteger(existingTab.id)) {
      await activateExistingTab(existingTab);
      await refreshStoredMainWindowSnapshot(selectedMainWindow.id);
      await refreshActionBadges();

      return {
        ok: true,
        targetWindowId: selectedMainWindow.id,
        reusedExistingTab: true,
        createdWindow: false,
        usedSelectedWindow: true,
        restoredSelection: resolvedMainWindow.resolvedFromSnapshot
      };
    }

    await chrome.tabs.create({
      windowId: selectedMainWindow.id,
      url,
      active: true
    });
    await chrome.windows.update(selectedMainWindow.id, { focused: true });
    await refreshStoredMainWindowSnapshot(selectedMainWindow.id);
    await refreshActionBadges();

    return {
      ok: true,
      targetWindowId: selectedMainWindow.id,
      createdWindow: false,
      usedSelectedWindow: true,
      restoredSelection: resolvedMainWindow.resolvedFromSnapshot
    };
  }

  const candidateWindows = windows.filter((windowInfo) => windowInfo.id !== monitorWindowId);
  const existingCandidateTab = findTabByUrlInWindows(candidateWindows, url);
  if (existingCandidateTab && Number.isInteger(existingCandidateTab.id)) {
    await activateExistingTab(existingCandidateTab);
    await refreshActionBadges();
    return {
      ok: true,
      targetWindowId: existingCandidateTab.windowId,
      reusedExistingTab: true,
      createdWindow: false,
      usedSelectedWindow: false,
      restoredSelection: false
    };
  }

  if (candidateWindows.length === 0) {
    const createdWindow = await chrome.windows.create({ url, focused: true });
    await refreshActionBadges();
    return { ok: true, targetWindowId: createdWindow.id, createdWindow: true };
  }

  const targetWindow = candidateWindows.find((windowInfo) => windowInfo.focused) || candidateWindows[0];

  await chrome.tabs.create({
    windowId: targetWindow.id,
    url,
    active: true
  });
  await chrome.windows.update(targetWindow.id, { focused: true });
  await refreshActionBadges();

  return { ok: true, targetWindowId: targetWindow.id, createdWindow: false };
}

async function openTokenCounterpartUrl(url, preferredWindowId) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    throw new Error('Invalid token counterpart URL.');
  }

  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
  const existingTab = findTabByUrlInWindows(windows, normalizedUrl);
  if (existingTab && Number.isInteger(existingTab.id)) {
    await activateExistingTab(existingTab);
    return {
      ok: true,
      url: normalizedUrl,
      targetWindowId: existingTab.windowId,
      reusedExistingTab: true,
      createdTab: false
    };
  }

  const preferredWindow = windows.find((windowInfo) => windowInfo.id === preferredWindowId);
  const targetWindow = preferredWindow || windows.find((windowInfo) => windowInfo.focused) || windows[0];
  if (!targetWindow || !Number.isInteger(targetWindow.id)) {
    const createdWindow = await chrome.windows.create({ url: normalizedUrl, focused: true });
    return {
      ok: true,
      url: normalizedUrl,
      targetWindowId: createdWindow.id,
      reusedExistingTab: false,
      createdTab: true,
      createdWindow: true
    };
  }

  const createdTab = await chrome.tabs.create({
    windowId: targetWindow.id,
    url: normalizedUrl,
    active: true
  });
  await chrome.windows.update(targetWindow.id, { focused: true });

  return {
    ok: true,
    url: normalizedUrl,
    targetWindowId: targetWindow.id,
    tabId: createdTab.id,
    reusedExistingTab: false,
    createdTab: true,
    createdWindow: false
  };
}

function findTabByUrl(windowInfo, url) {
  if (!windowInfo || !Array.isArray(windowInfo.tabs)) {
    return null;
  }

  const normalizedTargetUrl = normalizeUrl(url);
  if (!normalizedTargetUrl) {
    return null;
  }

  return windowInfo.tabs.find((tab) => urlsMatch(tab.pendingUrl || tab.url, normalizedTargetUrl)) || null;
}

function findTabByUrlInWindows(windows, url) {
  for (const windowInfo of windows || []) {
    const tab = findTabByUrl(windowInfo, url);
    if (tab) {
      return tab;
    }
  }

  return null;
}

async function activateExistingTab(tab) {
  if (!tab || !Number.isInteger(tab.id) || !Number.isInteger(tab.windowId)) {
    return;
  }

  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function setMainWindow(windowId) {
  const windowInfo = await chrome.windows.get(windowId, { populate: true });
  if (windowInfo.type !== 'normal') {
    throw new Error('Only normal browser windows can be selected.');
  }

  await persistMainWindowState(windowInfo);
  await refreshActionBadges();

  return {
    ok: true,
    windowId,
    title: getWindowTitle(windowInfo),
    resolvedFromSnapshot: false
  };
}

async function getMainWindowState() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
  const resolved = await resolveMainWindow(windows, { clearIfMissing: true });

  if (!resolved.windowInfo) {
    return { windowId: null, title: null, resolvedFromSnapshot: false };
  }

  return {
    windowId: resolved.windowInfo.id,
    title: getWindowTitle(resolved.windowInfo),
    resolvedFromSnapshot: resolved.resolvedFromSnapshot
  };
}

async function resolveMainWindow(windows, options = {}) {
  const { clearIfMissing = false } = options;
  const storedState = await getStoredMainWindowState();
  if (!storedState || !Number.isInteger(storedState.windowId)) {
    return { windowInfo: null, resolvedFromSnapshot: false };
  }

  const currentWindow = windows.find((windowInfo) => windowInfo.id === storedState.windowId);
  if (currentWindow) {
    await persistMainWindowState(currentWindow);
    return { windowInfo: currentWindow, resolvedFromSnapshot: false };
  }

  const matchedWindow = findWindowBySnapshot(windows, storedState.snapshot);
  if (!matchedWindow) {
    if (clearIfMissing) {
      await clearMainWindow();
    }
    return { windowInfo: null, resolvedFromSnapshot: false };
  }

  await persistMainWindowState(matchedWindow);
  return { windowInfo: matchedWindow, resolvedFromSnapshot: true };
}

function findWindowBySnapshot(windows, snapshot) {
  if (!snapshot) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const windowInfo of windows) {
    const score = scoreWindowMatch(windowInfo, snapshot);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = windowInfo;
    }
  }

  return bestScore >= 4 ? bestMatch : null;
}

function scoreWindowMatch(windowInfo, snapshot) {
  if (!snapshot) {
    return 0;
  }

  const activeTab = getActiveTab(windowInfo);
  const activeTabUrl = normalizeUrl(activeTab && activeTab.url);
  const currentTabUrls = getWindowTabUrls(windowInfo);
  const currentUrls = new Set(currentTabUrls);

  let score = 0;

  if (snapshot.activeTabUrl && activeTabUrl && snapshot.activeTabUrl === activeTabUrl) {
    score += 6;
  }

  if (
    snapshot.activeTabTitle
    && activeTab
    && activeTab.title
    && snapshot.activeTabTitle === activeTab.title
  ) {
    score += 2;
  }

  for (const url of snapshot.tabUrls || []) {
    if (currentUrls.has(url)) {
      score += 2;
    }
  }

  if ((snapshot.tabCount || 0) > 0 && snapshot.tabCount === (windowInfo.tabs || []).length) {
    score += 1;
  }

  return score;
}

async function getStoredMainWindowState() {
  const stored = await chrome.storage.local.get([
    MAIN_WINDOW_STORAGE_KEY,
    LEGACY_MAIN_WINDOW_STORAGE_KEY
  ]);

  if (stored[MAIN_WINDOW_STORAGE_KEY] && Number.isInteger(stored[MAIN_WINDOW_STORAGE_KEY].windowId)) {
    return stored[MAIN_WINDOW_STORAGE_KEY];
  }

  if (Number.isInteger(stored[LEGACY_MAIN_WINDOW_STORAGE_KEY])) {
    return {
      windowId: stored[LEGACY_MAIN_WINDOW_STORAGE_KEY],
      snapshot: null
    };
  }

  return null;
}

async function persistMainWindowState(windowInfo) {
  const state = {
    windowId: windowInfo.id,
    snapshot: buildWindowSnapshot(windowInfo)
  };

  await chrome.storage.local.set({
    [MAIN_WINDOW_STORAGE_KEY]: state,
    [LEGACY_MAIN_WINDOW_STORAGE_KEY]: windowInfo.id
  });
}

async function clearMainWindow() {
  await chrome.storage.local.remove([
    MAIN_WINDOW_STORAGE_KEY,
    LEGACY_MAIN_WINDOW_STORAGE_KEY
  ]);
  await refreshActionBadges();
}

function buildWindowSnapshot(windowInfo) {
  const activeTab = getActiveTab(windowInfo);

  return {
    activeTabUrl: normalizeUrl(activeTab && activeTab.url),
    activeTabTitle: activeTab && activeTab.title ? activeTab.title : null,
    tabUrls: getWindowTabUrls(windowInfo),
    tabCount: windowInfo.tabs ? windowInfo.tabs.length : 0,
    updatedAt: Date.now()
  };
}

function getMonitorUrlFromTab(tab) {
  if (!tab) {
    return null;
  }

  return normalizeMonitorUrl(tab.pendingUrl || tab.url);
}

function getWindowTabUrls(windowInfo) {
  if (!windowInfo.tabs || windowInfo.tabs.length === 0) {
    return [];
  }

  const uniqueUrls = new Set();

  for (const tab of windowInfo.tabs) {
    const normalizedUrl = normalizeUrl(tab.url);
    if (normalizedUrl) {
      uniqueUrls.add(normalizedUrl);
    }
  }

  return [...uniqueUrls];
}

function getActiveTab(windowInfo) {
  if (!windowInfo.tabs || windowInfo.tabs.length === 0) {
    return null;
  }

  return windowInfo.tabs.find((tab) => tab.active) || windowInfo.tabs[0];
}

async function refreshStoredMainWindowSnapshot(windowId) {
  if (!Number.isInteger(windowId)) {
    return;
  }

  const storedState = await getStoredMainWindowState();
  if (!storedState || storedState.windowId !== windowId) {
    return;
  }

  try {
    const windowInfo = await chrome.windows.get(windowId, { populate: true });
    if (windowInfo.type !== 'normal') {
      return;
    }

    await persistMainWindowState(windowInfo);
  } catch (_error) {
    return;
  }
}

async function refreshStoredMainWindowSnapshotForTab(tab) {
  if (!tab || !Number.isInteger(tab.windowId)) {
    return;
  }

  await refreshStoredMainWindowSnapshot(tab.windowId);
}

async function refreshActionBadges() {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ windowTypes: ['normal'], populate: true })
  ]);

  await ensureMonitorState(windows);

  const resolvedMainWindow = await resolveMainWindow(windows, { clearIfMissing: false });
  const mainWindowId = resolvedMainWindow.windowInfo ? resolvedMainWindow.windowInfo.id : null;
  const monitorWindowId = monitorState.windowId;

  await Promise.all(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => updateBadgeForTab(tab, mainWindowId, monitorWindowId))
  );
}

async function updateBadgeForTab(tab, mainWindowId, monitorWindowId) {
  const tabId = tab.id;
  let text = '';
  let title = 'GMGN Monitor Link Redirector';
  let color = '#4f7cff';

  if (mainWindowId && tab.windowId === mainWindowId) {
    text = 'MAIN';
    title = 'This window is the selected main window.';
    color = '#1f8f4e';
  } else if (monitorWindowId && tab.windowId === monitorWindowId) {
    text = 'MON';
    title = 'This window is the GMGN monitor window.';
    color = '#d97706';
  }

  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
}

async function ensureMonitorState(windows) {
  await restoreMonitorState();

  const normalWindows = Array.isArray(windows)
    ? windows
    : await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
  const existingMonitorTab = findTabById(normalWindows, monitorState.tabId);

  if (existingMonitorTab) {
    const nextFollowUrl = getMonitorUrlFromTab(existingMonitorTab.tab)
      || normalizeMonitorUrl(monitorState.followUrl)
      || DEFAULT_MONITOR_URL;
    const monitorChanged = monitorState.windowId !== existingMonitorTab.windowInfo.id;
    const followUrlChanged = monitorState.followUrl !== nextFollowUrl;

    if (monitorChanged || followUrlChanged) {
      monitorState = {
        ...monitorState,
        tabId: existingMonitorTab.tab.id,
        windowId: existingMonitorTab.windowInfo.id,
        followUrl: nextFollowUrl
      };
      persistMonitorState();
    }

    return monitorState;
  }

  const resolvedMainWindow = await resolveMainWindow(normalWindows, { clearIfMissing: false });
  const mainWindowId = resolvedMainWindow.windowInfo ? resolvedMainWindow.windowInfo.id : null;
  const candidate = findMonitorCandidate(normalWindows, {
    preferredTabId: monitorState.tabId,
    preferredWindowId: monitorState.windowId,
    preferredFollowUrl: normalizeMonitorUrl(monitorState.followUrl),
    excludedWindowId: mainWindowId
  });

  if (!candidate) {
    if (monitorState.tabId !== null || monitorState.windowId !== null) {
      monitorState = {
        tabId: null,
        windowId: null,
        followUrl: normalizeMonitorUrl(monitorState.followUrl) || DEFAULT_MONITOR_URL,
        allowedNavigationUrl: null,
        suppressNextRedirect: false
      };
      persistMonitorState();
    }

    return monitorState;
  }

  const monitorChanged = monitorState.tabId !== candidate.tabId || monitorState.windowId !== candidate.windowId;
  const nextFollowUrl = candidate.followUrl || normalizeMonitorUrl(monitorState.followUrl) || DEFAULT_MONITOR_URL;
  const followUrlChanged = monitorState.followUrl !== nextFollowUrl;

  if (monitorChanged || followUrlChanged) {
    monitorState = {
      ...monitorState,
      tabId: candidate.tabId,
      windowId: candidate.windowId,
      followUrl: nextFollowUrl,
      allowedNavigationUrl: monitorChanged ? null : monitorState.allowedNavigationUrl,
      suppressNextRedirect: monitorChanged ? false : monitorState.suppressNextRedirect
    };
    persistMonitorState();
  }

  return monitorState;
}

function findTabById(windows, tabId) {
  if (!Number.isInteger(tabId)) {
    return null;
  }

  for (const windowInfo of windows) {
    for (const tab of windowInfo.tabs || []) {
      if (tab.id === tabId) {
        return { windowInfo, tab };
      }
    }
  }

  return null;
}

function findMonitorCandidate(windows, options = {}) {
  const {
    preferredTabId = null,
    preferredWindowId = null,
    preferredFollowUrl = null,
    excludedWindowId = null
  } = options;
  const candidates = [];

  for (const windowInfo of windows) {
    if (!Number.isInteger(windowInfo.id)) {
      continue;
    }

    for (const tab of windowInfo.tabs || []) {
      if (!Number.isInteger(tab.id)) {
        continue;
      }

      const followUrl = getMonitorUrlFromTab(tab);
      if (!followUrl) {
        continue;
      }

      candidates.push({
        tab,
        tabId: tab.id,
        windowInfo,
        windowId: windowInfo.id,
        followUrl
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const candidatesOutsideMain = Number.isInteger(excludedWindowId)
    ? candidates.filter((candidate) => candidate.windowId !== excludedWindowId)
    : candidates;
  const candidatePool = candidatesOutsideMain.length > 0 ? candidatesOutsideMain : candidates;

  let bestCandidate = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidatePool) {
    const score = scoreMonitorCandidate(candidate, {
      preferredTabId,
      preferredWindowId,
      preferredFollowUrl
    });

    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

function scoreMonitorCandidate(candidate, options = {}) {
  const {
    preferredTabId = null,
    preferredWindowId = null,
    preferredFollowUrl = null
  } = options;
  let score = 0;

  if (candidate.tabId === preferredTabId) {
    score += 10;
  }

  if (candidate.windowId === preferredWindowId) {
    score += 6;
  }

  if (preferredFollowUrl && urlsMatch(candidate.followUrl, preferredFollowUrl)) {
    score += 3;
  }

  if (candidate.tab.active) {
    score += 2;
  }

  if (candidate.windowInfo.focused) {
    score += 1;
  }

  return score;
}

function getWindowTitle(windowInfo) {
  if (!windowInfo.tabs || windowInfo.tabs.length === 0) {
    return 'Untitled window';
  }

  const activeTab = windowInfo.tabs.find((tab) => tab.active) || windowInfo.tabs[0];
  return activeTab.title || activeTab.url || 'Untitled window';
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch (_error) {
    return null;
  }
}

function normalizeMonitorUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  return normalized && isFollowUrl(normalized) ? normalized : null;
}

function isFollowUrl(url) {
  try {
    const parsed = new URL(url);
    const isGmgnHost = parsed.hostname === 'gmgn.ai' || parsed.hostname.endsWith('.gmgn.ai');
    if (parsed.protocol !== 'https:' || !isGmgnHost) {
      return false;
    }
    return new RegExp(`^/(?:follow(?:/|$)|${GMGN_FOLLOW_CHAIN_SEGMENT}/follow(?:/|$))`, 'i').test(parsed.pathname);
  } catch (_error) {
    return false;
  }
}

function urlsMatch(left, right) {
  return normalizeUrl(left) === normalizeUrl(right);
}

function isExternalToGmgn(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname !== 'gmgn.ai' && !parsed.hostname.endsWith('.gmgn.ai');
  } catch (_error) {
    return false;
  }
}

async function restoreMonitorState() {
  const stored = await chrome.storage.local.get(MONITOR_STATE_STORAGE_KEY);
  if (!stored[MONITOR_STATE_STORAGE_KEY]) {
    return;
  }

  monitorState = {
    ...monitorState,
    ...stored[MONITOR_STATE_STORAGE_KEY]
  };
}

function persistMonitorState() {
  void chrome.storage.local.set({
    [MONITOR_STATE_STORAGE_KEY]: monitorState
  });
}
