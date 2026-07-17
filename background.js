const OPEN_LINK_MESSAGE = 'open-in-main-window';
const RELAY_SITE_SOURCE = 'monitor-relay-site';
const REGISTER_MONITOR_TAB_MESSAGE = 'register-monitor-tab';
const GET_MONITOR_SCREEN_STATUS_MESSAGE = 'get-monitor-screen-status';
const ALLOW_MONITOR_NAVIGATION_MESSAGE = 'allow-monitor-navigation';
const DISPATCH_GMGN_TWITTER_HOOK_MESSAGE = 'dispatch-gmgn-twitter-trigger-hook';
const DISPATCH_GMGN_SIGNAL_EVENT_MESSAGE = 'dispatch-gmgn-signal-event';
const FETCH_TWITTER_TTS_AUDIO_MESSAGE = 'fetch-twitter-tts-audio';
const GMGN_TOKEN_QUICK_ADD_MESSAGE = 'gmgn-token-quick-add';
const GMGN_OPEN_TOKEN_COUNTERPART_MESSAGE = 'gmgn-open-token-counterpart';
const GMGN_FOCUS_ADDRESS_QUICK_ADD_MESSAGE = 'gmgn-focus-address-quick-add';
const GMGN_FOCUS_ADDRESS_RELAY_REQUEST_MESSAGE = 'gmgn-focus-address-relay-request';
const DEFAULT_MARKET_WATCH_DESK_BASE_URL = 'http://127.0.0.1:17387';
const DEFAULT_MAIN_SCREEN_RELAY_BASE_URL = 'https://market-watch.macmini.lan';
const FOMO_AGGREGATE_ALERT_EVENT = 'fomo-aggregate-alert';
const FOMO_MONITOR_HEARTBEAT_EVENT = 'fomo-monitor-heartbeat';
const FOMO_MONITOR_PING_EVENT = 'fomo-monitor-ping';
const FOMO_MONITOR_ALARM = 'fomo-monitor-health-check';
const FOMO_MONITOR_HEALTH_STORAGE_KEY = 'fomoMonitorHealthV1';
const FOMO_MONITOR_CHECK_MINUTES = 1;
const FOMO_MONITOR_QUIET_RELOAD_MS = 15 * 60 * 1000;
const FOMO_MONITOR_RELOAD_COOLDOWN_MS = 2 * 60 * 1000;
const LEGACY_MAIN_SCREEN_RELAY_BASE_URL = 'http://127.0.0.1:17390';
const DEFAULT_TTS_API = 'http://tts.macmini.lan/tts/v3-task';
const MONITOR_STATE_STORAGE_KEY = 'monitorState';
const DEFAULT_MONITOR_URL = 'https://gmgn.ai/follow';
const SETTINGS_PAGE_PATH = 'settings.html';
const TWITTER_AUDIO_MAPPING_STORAGE_KEY = 'twitterAudioMappings';
const GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
const GMGN_TWITTER_TRIGGER_RULES_KEY = 'gmgnTwitterTriggerRules';
const GMGN_TWITTER_TRADE_PROFILES_KEY = 'gmgnTwitterTradeProfiles';
const GMGN_FOCUS_ADDRESSES_KEY = 'gmgnFocusAddresses';
const GMGN_FOCUS_ADDRESS_LOCAL_SOURCE = 'gmgn-monitor-address-page';
const GMGN_FOLLOW_CHAIN_SEGMENT = '(?:sol|eth|bsc|base|tron|blast|robinhood)';
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
  focusBuysEnabled: true,
  marketWatchDeskBaseUrl: DEFAULT_MARKET_WATCH_DESK_BASE_URL,
  mainScreenRelayBaseUrl: DEFAULT_MAIN_SCREEN_RELAY_BASE_URL,
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
const fomoMonitorHealth = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === OPEN_LINK_MESSAGE && message.url) {
    const monitorWindowId = sender.tab ? sender.tab.windowId : undefined;
    const messageSource = String(message.source || '').trim();

    openInMainWindow(message.url, monitorWindowId, {
      relayBaseUrl: message.relayBaseUrl,
      relayOnly: message.relayOnly === true,
      allowAnyHttpUrl: message.allowAnyHttpUrl === true && messageSource === RELAY_SITE_SOURCE,
      source: messageSource,
      sourceOrigin: message.sourceOrigin
    })
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

  if (message.type === FOMO_AGGREGATE_ALERT_EVENT && message.payload) {
    handleFomoAggregateAlert(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === FOMO_MONITOR_HEARTBEAT_EVENT && sender.tab?.id) {
    restoreFomoMonitorHealth()
      .then(() => updateFomoMonitorHealth(sender.tab.id, message.payload))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
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

  if (message.type === GMGN_FOCUS_ADDRESS_QUICK_ADD_MESSAGE && message.payload) {
    quickAddGmgnFocusAddress(message.payload, message.action || message.payload.action)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === GMGN_FOCUS_ADDRESS_RELAY_REQUEST_MESSAGE && message.request) {
    requestFocusAddressesThroughRelay(message.request, sender)
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

  if (message.type === REGISTER_MONITOR_TAB_MESSAGE) {
    setMonitorScreenFromTab(sender.tab, message.url)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === GET_MONITOR_SCREEN_STATUS_MESSAGE) {
    ensureMonitorState()
      .then(() => sendResponse(buildMonitorScreenStatus(sender.tab)))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
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
  if (isFomoTokenUrl(tab?.url || changeInfo.url)) {
    await restoreFomoMonitorHealth();
    await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => null);
    if (changeInfo.status === 'complete') {
      updateFomoMonitorHealth(tabId, { loadedAt: Date.now(), lastScanAt: Date.now() });
    }
  }
  await ensureMonitorState();
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

chrome.tabs.onCreated.addListener(() => {
  void refreshActionBadges();
});

chrome.tabs.onAttached.addListener(() => {
  void refreshActionBadges();
});

chrome.tabs.onDetached.addListener(() => {
  void refreshActionBadges();
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo = {}) => {
  void removeFomoMonitorHealth(tabId);
  if (tabId === monitorState.tabId) {
    if (removeInfo.isWindowClosing) {
      monitorState = {
        tabId: null,
        windowId: null,
        followUrl: DEFAULT_MONITOR_URL,
        allowedNavigationUrl: null,
        suppressNextRedirect: false
      };
    } else {
      monitorState = {
        ...monitorState,
        tabId: null,
        windowId: Number.isInteger(removeInfo.windowId) ? removeInfo.windowId : monitorState.windowId,
        followUrl: normalizeMonitorUrl(monitorState.followUrl) || DEFAULT_MONITOR_URL,
        allowedNavigationUrl: null,
        suppressNextRedirect: false
      };
    }
    persistMonitorState();
  }

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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FOMO_MONITOR_ALARM) {
    void (async () => {
      await restoreFomoMonitorHealth();
      await superviseFomoMonitorTabs();
    })();
  }
});

async function initializeExtensionState() {
  await ensureMonitorState();
  await ensureTwitterAudioDefaults();
  await ensureGmgnTwitterTriggerHookDefaults();
  await refreshActionBadges();
  await restoreFomoMonitorHealth();
  await ensureFomoMonitorAlarm();
  await superviseFomoMonitorTabs();
}

function isFomoTokenUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'fomo.family' || parsed.hostname.endsWith('.fomo.family'))
      && parsed.pathname.startsWith('/tokens/');
  } catch (_error) {
    return false;
  }
}

function updateFomoMonitorHealth(tabId, payload = {}) {
  if (!Number.isInteger(tabId)) return;
  const current = fomoMonitorHealth.get(tabId) || {};
  fomoMonitorHealth.set(tabId, {
    ...current,
    ...payload,
    heartbeatAt: Date.now()
  });
  void persistFomoMonitorHealth();
}

async function restoreFomoMonitorHealth() {
  const stored = await chrome.storage.session.get(FOMO_MONITOR_HEALTH_STORAGE_KEY).catch(() => ({}));
  const entries = stored?.[FOMO_MONITOR_HEALTH_STORAGE_KEY];
  if (!entries || typeof entries !== 'object') return;
  for (const [tabId, health] of Object.entries(entries)) {
    const numericTabId = Number(tabId);
    if (Number.isInteger(numericTabId) && health && typeof health === 'object') {
      fomoMonitorHealth.set(numericTabId, health);
    }
  }
}

async function persistFomoMonitorHealth() {
  const entries = Object.fromEntries(Array.from(fomoMonitorHealth.entries()).map(([tabId, health]) => [String(tabId), health]));
  await chrome.storage.session.set({ [FOMO_MONITOR_HEALTH_STORAGE_KEY]: entries }).catch(() => null);
}

async function removeFomoMonitorHealth(tabId) {
  await restoreFomoMonitorHealth();
  fomoMonitorHealth.delete(tabId);
  await persistFomoMonitorHealth();
}

async function ensureFomoMonitorAlarm() {
  const existing = await chrome.alarms.get(FOMO_MONITOR_ALARM).catch(() => null);
  if (!existing) {
    await chrome.alarms.create(FOMO_MONITOR_ALARM, { periodInMinutes: FOMO_MONITOR_CHECK_MINUTES });
  }
}

async function superviseFomoMonitorTabs() {
  const tabs = await chrome.tabs.query({ url: [
    'https://fomo.family/tokens/*',
    'https://www.fomo.family/tokens/*',
    'https://*.fomo.family/tokens/*'
  ] }).catch(() => []);
  const now = Date.now();
  for (const tab of tabs) {
    if (!Number.isInteger(tab.id) || !isFomoTokenUrl(tab.url)) continue;
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => null);
    const health = fomoMonitorHealth.get(tab.id) || {};
    const ping = tab.discarded ? null : await chrome.tabs.sendMessage(tab.id, {
      type: FOMO_MONITOR_PING_EVENT,
      requestedAt: now
    }).catch(() => null);
    if (ping?.ok) updateFomoMonitorHealth(tab.id, { loadedAt: health.loadedAt || ping.status?.pageStartedAt || now, ...(ping.status || {}) });

    const refreshedHealth = fomoMonitorHealth.get(tab.id) || health;
    const lastReloadAt = Number(refreshedHealth.lastReloadAt || 0);
    const ownerWindow = Number.isInteger(tab.windowId)
      ? await chrome.windows.get(tab.windowId).catch(() => null)
      : null;
    const isForegroundVisible = tab.active && ownerWindow?.focused === true;
    const quietReloadDue = !isForegroundVisible && now - Number(refreshedHealth.loadedAt || now) >= FOMO_MONITOR_QUIET_RELOAD_MS;
    const mustRecover = tab.discarded || !ping?.ok;
    if ((mustRecover || quietReloadDue) && now - lastReloadAt >= FOMO_MONITOR_RELOAD_COOLDOWN_MS) {
      fomoMonitorHealth.set(tab.id, { ...refreshedHealth, lastReloadAt: now, loadedAt: now });
      await persistFomoMonitorHealth();
      await chrome.tabs.reload(tab.id).catch(() => null);
    }
  }
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

async function setMonitorScreenFromTab(tab, rawUrl) {
  const tabId = tab && Number.isInteger(tab.id) ? tab.id : null;
  const windowId = tab && Number.isInteger(tab.windowId) ? tab.windowId : null;
  const followUrl = normalizeMonitorUrl(rawUrl) || getMonitorUrlFromTab(tab);

  if (!Number.isInteger(tabId) || !Number.isInteger(windowId) || !followUrl) {
    return { ok: false, error: 'Current tab is not a GMGN follow page.' };
  }

  monitorState = {
    ...monitorState,
    tabId,
    windowId,
    followUrl,
    allowedNavigationUrl: null,
    suppressNextRedirect: false
  };
  persistMonitorState();
  await refreshActionBadges();

  return buildMonitorScreenStatus(tab);
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
  settings.focusBuysEnabled = typeof settings.focusBuysEnabled === 'boolean'
    ? settings.focusBuysEnabled
    : GMGN_TWITTER_TRIGGER_HOOK_DEFAULTS.focusBuysEnabled;
  settings.marketWatchDeskBaseUrl = normalizeMarketWatchDeskBaseUrl(settings.marketWatchDeskBaseUrl);
  settings.mainScreenRelayBaseUrl = normalizeMainScreenRelayBaseUrl(settings.mainScreenRelayBaseUrl);
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
  const intelligencePromise = dispatchMarketWatchIntelligenceEvent(buildGmgnTwitterIntelligenceEvent(payload));
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
    const intelligence = await intelligencePromise;
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500),
      intelligence
    };
  } catch (error) {
    const intelligence = await intelligencePromise;
    return {
      ok: false,
      error: error && error.name === 'AbortError'
        ? `Webhook request timed out after ${settings.timeoutMs}ms.`
        : (error && error.message ? error.message : String(error)),
      intelligence
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildGmgnTwitterIntelligenceEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const rule = payload.rule && typeof payload.rule === 'object' ? payload.rule : {};
  const trigger = payload.trigger && typeof payload.trigger === 'object' ? payload.trigger : {};
  const actorHandle = String(trigger.username || trigger.twitterId || '').trim().replace(/^@/, '');
  const actorName = String(trigger.remark || trigger.name || actorHandle).trim();
  const contractAddress = String(rule.ca || '').trim();
  const symbol = String(rule.tokenSymbol || '').trim();
  if (!actorHandle && !actorName) return null;
  return removeEmptyFields({
    id: `gmgn-twitter|${String(payload.signalId || trigger.tweetId || '').trim()}|${actorHandle}`,
    kind: 'twitter',
    type: 'gmgn_twitter_trigger',
    chainId: mapMarketWatchChainId(rule.chain),
    contractAddress,
    symbol,
    tokenName: symbol,
    actorName,
    actorHandle,
    text: String(trigger.text || `${actorName} ${trigger.eventType || 'posted'}`).trim(),
    url: String(trigger.url || '').trim(),
    source: 'gmgn-twitter-trigger',
    occurredAt: formatIsoTimestamp(trigger.ts || payload.triggeredAt || Date.now())
  });
}

async function dispatchGmgnSignalEvent(payload) {
  const [focusBuyResult, intelligenceResult, eventApiResult] = await Promise.all([
    dispatchMarketWatchDeskFocusBuy(payload),
    dispatchMarketWatchIntelligenceEvent(payload),
    dispatchGmgnEventApi(payload)
  ]);

  if (eventApiResult && !eventApiResult.skipped) {
    return {
      ...eventApiResult,
      focusBuy: focusBuyResult,
      intelligence: intelligenceResult
    };
  }

  if (focusBuyResult && !focusBuyResult.skipped) {
    return {
      ...focusBuyResult,
      eventApi: eventApiResult,
      intelligence: intelligenceResult
    };
  }

  if (intelligenceResult && !intelligenceResult.skipped) {
    return {
      ...intelligenceResult,
      eventApi: eventApiResult,
      focusBuy: focusBuyResult
    };
  }

  return {
    ok: false,
    skipped: true,
    error: eventApiResult?.error || focusBuyResult?.error || 'No signal integrations enabled.',
    eventApi: eventApiResult,
    focusBuy: focusBuyResult,
    intelligence: intelligenceResult
  };
}

async function dispatchMarketWatchIntelligenceEvent(payload) {
  const event = buildMarketWatchIntelligenceEvent(payload);
  if (!event) {
    return { ok: false, skipped: true, error: 'Signal event is not a Market Watch intelligence event.' };
  }
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  if (!settings.focusBuysEnabled) {
    return { ok: false, skipped: true, error: 'Market Watch forwarding is disabled.' };
  }
  const requestUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/market-watch/api/intelligence-events');
  if (!requestUrl) {
    return { ok: false, skipped: true, error: 'Relay Base URL is invalid.' };
  }
  const allItems = Array.isArray(event.items) ? event.items : [event];
  const batches = [];
  for (let index = 0; index < allItems.length; index += 200) {
    batches.push(allItems.slice(index, index + 200));
  }

  let itemsSent = 0;
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const items = batches[batchIndex];
    let lastResult = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutMs = Math.min(settings.timeoutMs, 5000);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gmgn-hook-source': 'wallet-convergence-alert-gmgn-monitor',
            'x-gmgn-hook-event': 'intelligence-event',
            ...(settings.eventApiToken ? { Authorization: `Bearer ${settings.eventApiToken}` } : {})
          },
          body: JSON.stringify({ source: 'gmgn-monitor-extension', payload: { items } }),
          signal: controller.signal
        });
        const responseText = await response.text().catch(() => '');
        lastResult = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseText.slice(0, 500),
          attempt
        };
      } catch (error) {
        lastResult = {
          ok: false,
          error: error && error.name === 'AbortError'
            ? `Intelligence event request timed out after ${timeoutMs}ms.`
            : (error && error.message ? error.message : String(error)),
          attempt
        };
      } finally {
        clearTimeout(timer);
      }

      if (lastResult.ok || (lastResult.status && lastResult.status < 500)) {
        break;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }

    if (!lastResult?.ok) {
      return {
        ...lastResult,
        failedBatch: batchIndex + 1,
        completedBatches: batchIndex,
        totalBatches: batches.length,
        itemsSent
      };
    }
    itemsSent += items.length;
  }

  return { ok: true, status: 200, batches: batches.length, items: allItems.length };
}

async function dispatchGmgnEventApi(payload) {
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

async function dispatchMarketWatchDeskFocusBuy(payload) {
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);

  if (!settings.focusBuysEnabled) {
    return { ok: false, skipped: true, error: 'Focus Buys forwarding is disabled.' };
  }

  const focusBuy = buildFocusBuyPayload(payload);
  if (!focusBuy) {
    return { ok: false, skipped: true, error: 'Signal event is not a focus buy.' };
  }

  const relayResult = await dispatchFocusBuyToRelay(focusBuy, settings);
  if (relayResult && relayResult.ok) {
    return relayResult;
  }

  const requestUrl = buildMarketWatchDeskUrl(settings.marketWatchDeskBaseUrl, '/focus-buys');
  if (!requestUrl) {
    return {
      ok: false,
      skipped: true,
      error: relayResult?.error || 'Market Watch Desk Base URL is invalid.',
      relay: relayResult
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gmgn-hook-source': 'wallet-convergence-alert-gmgn-monitor',
        'x-gmgn-hook-event': 'focus-buy'
      },
      body: JSON.stringify(focusBuy),
      signal: controller.signal
    });

    const responseText = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500),
      relay: relayResult
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.name === 'AbortError'
        ? `Focus Buys request timed out after ${settings.timeoutMs}ms.`
        : (error && error.message ? error.message : String(error)),
      relay: relayResult
    };
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchFocusBuyToRelay(focusBuy, settings) {
  const requestUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/focus-buys');
  if (!requestUrl) {
    return { ok: false, skipped: true, error: 'Relay Base URL is invalid.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(settings.timeoutMs, 3000));
  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gmgn-hook-source': 'wallet-convergence-alert-gmgn-monitor',
        'x-gmgn-hook-event': 'focus-buy'
      },
      body: JSON.stringify({
        source: 'gmgn-monitor-extension',
        payload: focusBuy
      }),
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
      relayed: true,
      status: response.status,
      statusText: response.statusText,
      relayEventId: responseJson?.event?.id || null,
      body: responseText.slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      relayed: false,
      error: error && error.name === 'AbortError'
        ? 'Relay Focus Buys request timed out after 3000ms.'
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildFocusBuyPayload(payload) {
  if (!payload) return null;
  if (payload.type !== 'wallet_trade') return null;
  const action = String(payload.action || '').trim().toLowerCase();
  if (action !== 'buy' && action !== 'open' && action !== 'add') return null;

  const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw : {};
  if (raw.focus_wallet_hit !== true) return null;

  const ca = String(payload.ca || '').trim();
  const symbol = String(payload.symbol || '').trim();
  if (!ca && !symbol) return null;

  const wallet = payload.wallet && typeof payload.wallet === 'object' ? payload.wallet : {};
  const traderName = String(wallet.remark || wallet.name || '').trim();
  const traderAddress = String(wallet.address || '').trim();
  const nativeAmount = parseHumanMoneyValue(payload.amount);
  const marketCap = parseHumanMoneyValue(payload.mcap);
  const boughtAt = formatIsoTimestamp(payload.ts);

  return removeEmptyFields({
    schemaVersion: 2,
    kind: 'trade',
    side: 'buy',
    tradeId: String(payload.tradeId || raw.trade_id || raw.stable_key || '').trim(),
    identityConfidence: String(payload.identityConfidence || raw.identity_confidence || 'heuristic').trim(),
    traderName,
    traderAddress,
    tokenName: String(payload.token_name || symbol || '').trim(),
    symbol,
    chainId: mapMarketWatchChainId(payload.chain),
    contractAddress: ca,
    nativeAmount,
    nativeSymbol: marketWatchNativeSymbol(payload.chain),
    marketCap,
    source: `${String(payload.source || 'gmgn').trim() || 'gmgn'}-plugin`,
    txUrl: String(payload.url || '').trim(),
    note: String(raw.focus_wallet_alias || raw.focus_wallet_key || payload.text || '').trim(),
    boughtAt
  });
}

function buildMarketWatchIntelligenceEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (['trade', 'snapshot', 'aggregate', 'twitter'].includes(String(payload.kind || '').trim().toLowerCase())) {
    return payload;
  }
  const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw : {};
  const type = String(payload.type || '').trim();
  if (type === 'convergence_alert') {
    const ca = String(payload.ca || '').trim();
    const symbol = String(payload.symbol || '').trim();
    if (!ca && !symbol) return null;
    const aggregateEvent = removeEmptyFields({
      id: `gmgn-aggregate|${String(raw.group_key || '').trim()}|${formatIsoTimestamp(payload.ts)}|${Number(raw.buy_wallet_count || 0)}|${Number(raw.sell_wallet_count || 0)}`,
      schemaVersion: 2,
      kind: 'aggregate',
      type,
      chainId: mapMarketWatchChainId(payload.chain),
      contractAddress: ca,
      tokenName: String(payload.token_name || symbol).trim(),
      symbol,
      buyCount: Number(raw.buy_wallet_count || raw.wallet_count || 0),
      sellCount: Number(raw.sell_wallet_count || raw.closed_wallet_count || 0),
      traderCount: Number(raw.wallet_count || raw.buy_wallet_count || 0),
      marketCap: parseHumanMoneyValue(payload.mcap),
      image: String(payload.image || raw.token_image || '').trim(),
      text: String(payload.text || '').trim(),
      url: String(payload.url || '').trim(),
      source: `${String(payload.source || 'gmgn').trim() || 'gmgn'}-plugin`,
      occurredAt: formatIsoTimestamp(payload.ts)
    });
    const walletEvents = (Array.isArray(raw.wallets) ? raw.wallets : [])
      .filter((wallet) => wallet && typeof wallet === 'object')
      .map((wallet, index) => {
        const actorName = String(wallet.name || '').trim();
        const actorAddress = String(wallet.address || '').trim();
        if (!actorName && !actorAddress) return null;
        const stableWallet = actorAddress.toLowerCase() || actorName.toLowerCase() || String(index);
        const buyAt = formatIsoTimestamp(wallet.timeMs || payload.ts);
        return removeEmptyFields({
          id: `gmgn-wallet-snapshot|${String(raw.group_key || '').trim()}|${stableWallet}`,
          schemaVersion: 2,
          kind: 'snapshot',
          type: 'wallet_snapshot',
          snapshotType: wallet.closed === true ? 'sold' : 'buyer',
          chainId: mapMarketWatchChainId(payload.chain),
          contractAddress: ca,
          tokenName: String(payload.token_name || symbol).trim(),
          symbol,
          actorName,
          actorAddress,
          actorImage: String(wallet.avatar || '').trim(),
          snapshotNativeAmount: parseHumanMoneyValue(wallet.amount),
          nativeSymbol: marketWatchNativeSymbol(payload.chain),
          marketCap: parseHumanMoneyValue(payload.mcap),
          image: String(payload.image || raw.token_image || '').trim(),
          url: String(payload.url || '').trim(),
          source: `${String(payload.source || 'gmgn').trim() || 'gmgn'}-plugin`,
          text: `${actorName || actorAddress} appeared in ${symbol} aggregate`,
          occurredAt: buyAt
        });
      })
      .filter(Boolean);
    return { items: [aggregateEvent, ...walletEvents] };
  }
  if (type !== 'wallet_trade') return null;
  const action = String(payload.action || '').trim().toLowerCase();
  if (!['buy', 'open', 'add', 'sell', 'reduce', 'close', 'clear'].includes(action)) return null;
  const wallet = payload.wallet && typeof payload.wallet === 'object' ? payload.wallet : {};
  const ca = String(payload.ca || '').trim();
  const symbol = String(payload.symbol || '').trim();
  if (!ca && !symbol) return null;
  return removeEmptyFields({
    id: `gmgn-trade|${String(payload.tradeId || raw.trade_id || raw.stable_key || '').trim()}`,
    schemaVersion: 2,
    kind: 'trade',
    tradeId: String(payload.tradeId || raw.trade_id || raw.stable_key || '').trim(),
    identityConfidence: String(payload.identityConfidence || raw.identity_confidence || 'heuristic').trim(),
    type,
    side: ['sell', 'reduce', 'close', 'clear'].includes(action) ? 'sell' : 'buy',
    chainId: mapMarketWatchChainId(payload.chain),
    contractAddress: ca,
    tokenName: String(payload.token_name || symbol).trim(),
    symbol,
    actorName: String(wallet.remark || wallet.name || raw.focus_wallet_alias || '').trim(),
    actorAddress: String(wallet.address || '').trim(),
    nativeAmount: parseHumanMoneyValue(payload.amount),
    nativeSymbol: marketWatchNativeSymbol(payload.chain),
    marketCap: parseHumanMoneyValue(payload.mcap),
    text: String(payload.text || '').trim(),
    url: String(payload.url || '').trim(),
    source: `${String(payload.source || 'gmgn').trim() || 'gmgn'}-plugin`,
    occurredAt: formatIsoTimestamp(payload.ts)
  });
}

function parseHumanMoneyValue(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  const match = text.replace(/,/g, '').match(/^\s*[$￥¥]?\s*([0-9]+(?:\.[0-9]+)?)\s*([KMB])?\s*$/i);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;
  const suffix = String(match[2] || '').toUpperCase();
  if (suffix === 'K') return number * 1_000;
  if (suffix === 'M') return number * 1_000_000;
  if (suffix === 'B') return number * 1_000_000_000;
  return number;
}

function mapMarketWatchChainId(chain) {
  const normalized = String(chain || '').trim().toLowerCase();
  if (normalized === 'bsc' || normalized === 'bnb' || normalized === '56') return '56';
  if (normalized === 'sol' || normalized === 'solana' || normalized === 'ct_501') return 'CT_501';
  if (normalized === 'eth' || normalized === 'ethereum' || normalized === '1') return '1';
  if (normalized === 'base' || normalized === '8453') return '8453';
  if (normalized === 'tron' || normalized === '728126428') return '728126428';
  if (normalized === 'blast' || normalized === '81457') return '81457';
  return normalized;
}

function marketWatchNativeSymbol(chain) {
  const normalized = String(chain || '').trim().toLowerCase();
  if (normalized === 'bsc' || normalized === 'bnb' || normalized === '56') return 'BNB';
  if (normalized === 'sol' || normalized === 'solana' || normalized === 'ct_501') return 'SOL';
  if (normalized === 'tron' || normalized === '728126428') return 'TRX';
  return 'ETH';
}

function formatIsoTimestamp(value) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function removeEmptyFields(value) {
  const next = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (item === undefined || item === null || item === '') continue;
    next[key] = item;
  }
  return next;
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
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.searchParams.set('data', text);
    appendTtsQueryParams(url, options);
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

function appendTtsQueryParams(url, options = {}) {
  const voice = String(options.voice || '').trim();
  const rate = String(options.rate || '').trim();
  const pitch = String(options.pitch || '').trim();
  if (voice) url.searchParams.set('voice', voice);
  if (rate) url.searchParams.set('rate', rate);
  if (pitch) url.searchParams.set('pitch', pitch);
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
    return url.hostname === 'tts.macmini.lan' && url.pathname.replace(/\/+$/, '') === '/tts/v3-task';
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

  return { ca, chain, chainId: mapMarketWatchChainId(chain), note, tags };
}

async function getQuickAddRequestConfig(action) {
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const normalizedAction = String(action || 'add').trim().toLowerCase();
  if (normalizedAction === 'status' || normalizedAction === 'check') {
    return { url: buildMarketWatchDeskUrl(settings.marketWatchDeskBaseUrl, '/quick-add/status'), method: 'POST', action: 'status' };
  }
  if (normalizedAction === 'remove' || normalizedAction === 'delete' || normalizedAction === 'unfavorite') {
    return { url: buildMarketWatchDeskUrl(settings.marketWatchDeskBaseUrl, '/quick-add/remove'), method: 'POST', action: 'remove' };
  }
  return { url: buildMarketWatchDeskUrl(settings.marketWatchDeskBaseUrl, '/quick-add'), method: 'POST', action: 'add' };
}

async function quickAddGmgnToken(payload, action = 'add') {
  const body = normalizeQuickAddPayload(payload);
  const requestConfig = await getQuickAddRequestConfig(action);
  if (!requestConfig.url) {
    return { ok: false, action: requestConfig.action, error: 'Market Watch Desk Base URL is invalid.' };
  }
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
      url: requestConfig.url,
      error: error && error.name === 'AbortError'
        ? 'Quick add request timed out after 5000ms.'
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

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

function buildFocusAddressKey(chain, address) {
  const normalizedChain = normalizeFocusChainName(chain);
  const normalizedAddress = normalizeFocusAddressKey(address);
  if (!normalizedChain || !normalizedAddress) return '';
  return `${normalizedChain}:${normalizedAddress}`;
}

function isLikelyFocusAddress(address) {
  const text = normalizeFocusAddress(address);
  return /^0x[a-fA-F0-9]{40}$/.test(text)
    || /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(text)
    || /^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(text);
}

function normalizeFocusAddressEntries(raw) {
  const next = {};
  const entries = Array.isArray(raw) ? raw : Object.values(raw || {});

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const chain = normalizeFocusChainName(entry.chain);
    const address = normalizeFocusAddress(entry.address);
    const key = buildFocusAddressKey(chain, address);
    if (!key || !isLikelyFocusAddress(address)) continue;
    next[key] = {
      key,
      chain,
      address,
      addressKey: normalizeFocusAddressKey(address),
      alias: String(entry.alias || '').trim(),
      name: String(entry.name || '').trim(),
      personId: String(entry.personId || '').trim(),
      twitterHandle: String(entry.twitterHandle || '').trim().replace(/^@/, ''),
      profileImage: String(entry.profileImage || '').trim(),
      evmAddress: String(entry.evmAddress || '').trim(),
      solanaAddress: String(entry.solanaAddress || '').trim(),
      focusPushEnabled: entry.focusPushEnabled !== false,
      source: String(entry.source || '').trim(),
      sourceUrl: String(entry.sourceUrl || '').trim(),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
    };
  }

  return next;
}

function normalizeFocusAddressQuickAddPayload(payload) {
  const item = payload && typeof payload === 'object' ? payload : {};
  const chain = normalizeFocusChainName(item.chain);
  const address = normalizeFocusAddress(item.address);
  const key = buildFocusAddressKey(chain, address);
  if (!key || !isLikelyFocusAddress(address)) {
    throw new Error('Valid Focus wallet chain and address are required.');
  }

  const now = new Date().toISOString();
  return {
    key,
    chain,
    address,
    addressKey: normalizeFocusAddressKey(address),
    alias: String(item.alias || '').trim().slice(0, 100),
    name: String(item.name || '').trim().slice(0, 100),
    focusPushEnabled: item.focusPushEnabled !== false,
    source: String(item.source || GMGN_FOCUS_ADDRESS_LOCAL_SOURCE).trim().slice(0, 100) || GMGN_FOCUS_ADDRESS_LOCAL_SOURCE,
    sourceUrl: String(item.sourceUrl || '').trim().slice(0, 500),
    createdAt: now,
    updatedAt: now
  };
}

async function quickAddGmgnFocusAddress(payload, action = 'add') {
  const item = normalizeFocusAddressQuickAddPayload(payload);
  const normalizedAction = String(action || 'add').trim().toLowerCase();
  const stored = await chrome.storage.local.get(GMGN_FOCUS_ADDRESSES_KEY);
  const focusAddressEntries = normalizeFocusAddressEntries(stored[GMGN_FOCUS_ADDRESSES_KEY]);
  const existing = focusAddressEntries[item.key] || null;

  if (normalizedAction === 'status' || normalizedAction === 'check') {
    return {
      ok: true,
      action: 'status',
      focus: Boolean(existing),
      key: item.key,
      item: existing
    };
  }

  if (normalizedAction === 'remove' || normalizedAction === 'delete') {
    delete focusAddressEntries[item.key];
    await chrome.storage.local.set({ [GMGN_FOCUS_ADDRESSES_KEY]: focusAddressEntries });
    const relay = await deleteFocusAddressFromRelay(item).catch((error) => ({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }));
    return {
      ok: true,
      action: 'remove',
      focus: false,
      key: item.key,
      relay
    };
  }

  const nextItem = {
    ...existing,
    ...item,
    createdAt: existing?.createdAt || item.createdAt,
    updatedAt: new Date().toISOString()
  };
  focusAddressEntries[item.key] = nextItem;
  await chrome.storage.local.set({ [GMGN_FOCUS_ADDRESSES_KEY]: focusAddressEntries });

  const relay = await postFocusAddressToRelay(nextItem).catch((error) => ({
    ok: false,
    error: error && error.message ? error.message : String(error)
  }));

  return {
    ok: true,
    action: 'add',
    focus: true,
    key: item.key,
    item: nextItem,
    relay
  };
}

async function postFocusAddressToRelay(item) {
  if (!/^(sol|eth|bsc|base|tron|blast|robinhood)$/.test(item.chain)) {
    return { ok: false, skipped: true, reason: 'relay-chain-unsupported' };
  }

  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const requestUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/focus-addresses');
  if (!requestUrl) {
    return { ok: false, skipped: true, reason: 'relay-url-invalid' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
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
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500),
      json: responseJson
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.name === 'AbortError'
        ? 'Relay focus address request timed out after 3000ms.'
        : (error && error.message ? error.message : String(error))
    };
  } finally {
    clearTimeout(timer);
  }
}

async function deleteFocusAddressFromRelay(item) {
  if (!/^(sol|eth|bsc|base|tron|blast|robinhood)$/.test(item.chain)) {
    return { ok: false, skipped: true, reason: 'relay-chain-unsupported' };
  }
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const baseUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/focus-addresses');
  if (!baseUrl) return { ok: false, skipped: true, reason: 'relay-url-invalid' };
  const requestUrl = `${baseUrl}?chain=${encodeURIComponent(item.chain)}&address=${encodeURIComponent(item.address)}`;
  const response = await fetch(requestUrl, { method: 'DELETE' });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, json: body };
}

function isAllowedFocusRelaySender(sender) {
  try {
    const senderUrl = new URL(String(sender?.tab?.url || sender?.url || ''));
    if (senderUrl.protocol !== 'https:') return false;
    const hostname = senderUrl.hostname.toLowerCase();
    return hostname === 'gmgn.ai'
      || hostname.endsWith('.gmgn.ai')
      || hostname === 'debot.ai'
      || hostname.endsWith('.debot.ai');
  } catch (_error) {
    return false;
  }
}

async function requestFocusAddressesThroughRelay(request, sender) {
  if (!isAllowedFocusRelaySender(sender)) {
    throw new Error('Focus Relay request sender is not allowed.');
  }

  const operation = String(request?.operation || '').trim().toLowerCase();
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const focusUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/focus-addresses');
  if (!focusUrl) throw new Error('Relay Focus URL is invalid.');

  let requestUrl = focusUrl;
  let method = 'GET';
  let body;
  if (operation === 'list') {
    method = 'GET';
  } else if (operation === 'upsert') {
    const item = Object.values(normalizeFocusAddressEntries([request.item]))[0];
    if (!item) throw new Error('Valid Focus wallet chain and address are required.');
    method = 'POST';
    body = item;
  } else if (operation === 'sync') {
    const rawItems = Array.isArray(request.items) ? request.items : [];
    if (rawItems.length > 2000) throw new Error('Too many Focus addresses; maximum is 2000.');
    method = 'POST';
    requestUrl = buildMainScreenRelayUrl(settings.mainScreenRelayBaseUrl, '/focus-addresses/sync');
    body = {
      source: String(request.source || 'gmgn-monitor-extension').trim().slice(0, 100),
      items: Object.values(normalizeFocusAddressEntries(rawItems))
    };
  } else if (operation === 'delete') {
    const item = Object.values(normalizeFocusAddressEntries([request.item]))[0];
    if (!item) throw new Error('Valid Focus wallet chain and address are required.');
    method = 'DELETE';
    requestUrl = `${focusUrl}?chain=${encodeURIComponent(item.chain)}&address=${encodeURIComponent(item.address)}`;
  } else {
    throw new Error('Unsupported Focus Relay operation.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(requestUrl, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal
    });
    const responseText = await response.text().catch(() => '');
    const responseJson = responseText ? JSON.parse(responseText) : null;
    return {
      ok: response.ok && responseJson?.ok !== false,
      status: response.status,
      statusText: response.statusText,
      json: responseJson,
      error: response.ok ? '' : (responseJson?.error || response.statusText)
    };
  } catch (error) {
    throw new Error(error?.name === 'AbortError'
      ? 'Relay Focus request timed out after 5000ms.'
      : (error?.message || String(error)));
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHttpBaseUrl(value, defaultValue = '') {
  const rawValue = String(value || '').trim();
  if (!rawValue) return defaultValue;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue) ? rawValue : `http://${rawValue}`;
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

function normalizeMarketWatchDeskBaseUrl(value) {
  return normalizeHttpBaseUrl(value, DEFAULT_MARKET_WATCH_DESK_BASE_URL);
}

function normalizeMainScreenRelayBaseUrl(value) {
  const normalized = normalizeHttpBaseUrl(value, DEFAULT_MAIN_SCREEN_RELAY_BASE_URL);
  return normalized === LEGACY_MAIN_SCREEN_RELAY_BASE_URL
    ? DEFAULT_MAIN_SCREEN_RELAY_BASE_URL
    : normalized;
}

function buildMarketWatchDeskUrl(baseUrl, path) {
  try {
    const base = normalizeMarketWatchDeskBaseUrl(baseUrl);
    return new URL(path, `${base}/`).toString();
  } catch (_error) {
    return '';
  }
}

async function openInMainWindow(url, monitorWindowId, relayOptions = {}) {
  const relayResult = await dispatchOpenUrlToMainScreenRelay(url, relayOptions);
  if (relayResult.ok) {
    return relayResult;
  }
  if (relayOptions.relayOnly) {
    return relayResult;
  }

  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
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

async function dispatchOpenUrlToMainScreenRelay(url, options = {}) {
  const normalizedUrl = normalizeUrl(url);
  const isAllowedUrl = options.allowAnyHttpUrl
    ? isHttpNavigationUrl(normalizedUrl)
    : isMainScreenRelayNavigationUrl(normalizedUrl);
  if (!normalizedUrl || !isAllowedUrl) {
    return { ok: false, skipped: true, reason: 'unsupported-url' };
  }

  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const relayBaseUrlOverride = String(options.relayBaseUrl || '').trim()
    ? normalizeMainScreenRelayBaseUrl(options.relayBaseUrl)
    : '';
  const relayBaseUrl = relayBaseUrlOverride
    || settings.mainScreenRelayBaseUrl
    || DEFAULT_MAIN_SCREEN_RELAY_BASE_URL;
  const source = String(options.source || 'gmgn-monitor-extension').trim() || 'gmgn-monitor-extension';
  const sourceOrigin = String(options.sourceOrigin || '').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const healthUrl = buildMainScreenRelayUrl(relayBaseUrl, '/health');
    if (!healthUrl) {
      return { ok: false, skipped: true, reason: 'relay-url-invalid' };
    }
    const healthResponse = await fetch(healthUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!healthResponse.ok) {
      return { ok: false, skipped: true, reason: 'relay-health-failed' };
    }
    const health = await healthResponse.json().catch(() => null);
    if (!options.relayOnly && !hasActiveMainScreenClient(health)) {
      return { ok: false, skipped: true, reason: 'main-client-offline' };
    }
  } catch (_error) {
    return { ok: false, skipped: true, reason: 'relay-offline' };
  } finally {
    clearTimeout(timer);
  }

  try {
    const openUrl = buildMainScreenRelayUrl(relayBaseUrl, '/open-url');
    if (!openUrl) {
      return { ok: false, skipped: true, reason: 'relay-url-invalid' };
    }
    const response = await fetch(openUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: normalizedUrl,
        source,
        payload: sourceOrigin ? { sourceOrigin } : {}
      })
    });
    if (!response.ok) {
      return { ok: false, skipped: true, reason: 'relay-post-failed' };
    }
    return {
      ok: true,
      relayed: true,
      relayBaseUrl,
      target: 'main'
    };
  } catch (_error) {
    return { ok: false, skipped: true, reason: 'relay-post-error' };
  }
}

function buildMainScreenRelayUrl(baseUrl, pathname) {
  try {
    const normalizedBaseUrl = normalizeMainScreenRelayBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
      return '';
    }
    return new URL(pathname, `${normalizedBaseUrl}/`).toString();
  } catch (_error) {
    return '';
  }
}

function hasActiveMainScreenClient(health) {
  const clients = Array.isArray(health?.clients) ? health.clients : [];
  const now = Date.now();
  return clients.some((client) => {
    if (client?.role !== 'main') {
      return false;
    }
    const lastSeen = Date.parse(client.lastSeenAt || '');
    return Number.isFinite(lastSeen) && now - lastSeen < 45000;
  });
}

function isMainScreenRelayNavigationUrl(rawUrl) {
  try {
    const parsedUrl = new URL(String(rawUrl || ''));
    return parsedUrl.protocol === 'https:'
      && /(^|\.)((gmgn\.ai)|(fomo\.family)|(debot\.ai)|(x\.com)|(twitter\.com)|(t\.co))$/i.test(parsedUrl.hostname);
  } catch (_error) {
    return false;
  }
}

function isHttpNavigationUrl(rawUrl) {
  try {
    const parsedUrl = new URL(String(rawUrl || ''));
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (_error) {
    return false;
  }
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

function getMonitorUrlFromTab(tab) {
  if (!tab) {
    return null;
  }

  return normalizeMonitorUrl(tab.pendingUrl || tab.url);
}

async function refreshActionBadges() {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ windowTypes: ['normal'], populate: true })
  ]);

  await ensureMonitorState(windows);

  const monitorWindowId = monitorState.windowId;

  await Promise.all(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => updateBadgeForTab(tab, monitorWindowId))
  );
}

async function updateBadgeForTab(tab, monitorWindowId) {
  const tabId = tab.id;
  let text = '';
  let title = 'GMGN Monitor Link Redirector';
  let color = '#4f7cff';

  if (Number.isInteger(monitorWindowId) && tab.windowId === monitorWindowId) {
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

  const existingMonitorWindow = findWindowById(normalWindows, monitorState.windowId);
  if (existingMonitorWindow) {
    if (monitorState.tabId !== null) {
      monitorState = {
        ...monitorState,
        tabId: null,
        followUrl: normalizeMonitorUrl(monitorState.followUrl) || DEFAULT_MONITOR_URL,
        allowedNavigationUrl: null,
        suppressNextRedirect: false
      };
      persistMonitorState();
    }

    return monitorState;
  }

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

function findWindowById(windows, windowId) {
  if (!Number.isInteger(windowId)) {
    return null;
  }

  return windows.find((windowInfo) => windowInfo.id === windowId) || null;
}

function buildMonitorScreenStatus(tab) {
  const tabId = tab && Number.isInteger(tab.id) ? tab.id : null;
  const windowId = tab && Number.isInteger(tab.windowId) ? tab.windowId : null;

  return {
    ok: true,
    tabId,
    windowId,
    monitorTabId: monitorState.tabId,
    monitorWindowId: monitorState.windowId,
    followUrl: monitorState.followUrl,
    isMonitorTab: Number.isInteger(tabId) && tabId === monitorState.tabId,
    isMonitorScreen: isMonitorWindowId(windowId)
  };
}

function isMonitorWindowId(windowId) {
  return Number.isInteger(windowId)
    && Number.isInteger(monitorState.windowId)
    && windowId === monitorState.windowId;
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
    preferredFollowUrl = null
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

  let bestCandidate = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
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

async function handleFomoAggregateAlert(payload) {
  const chain = normalizeFocusChainName(payload.chain);
  const contractAddress = String(payload.tokenAddress || '').trim();
  const symbol = String(payload.symbol || '').trim();
  const traderCount = Math.max(1, Number(payload.traderCount || 1));
  const isTraderAlert = payload.alertKind === 'trader';
  const traderName = String(payload.traderHandle || payload.traderName || '').trim();
  const side = String(payload.side || '').toLowerCase();
  if (!chain || !contractAddress || !symbol || !['buy', 'sell'].includes(side)) {
    return { ok: false, skipped: true, error: 'Invalid FOMO alert.' };
  }

  const tabs = await chrome.tabs.query({ url: [
    'https://gmgn.ai/follow*',
    'https://www.gmgn.ai/follow*',
    'https://gmgn.ai/*/follow*',
    'https://www.gmgn.ai/*/follow*'
  ] });
  let monitorDelivered = false;
  for (const tab of tabs) {
    if (!tab.id) continue;
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: FOMO_AGGREGATE_ALERT_EVENT,
      payload
    }).catch(() => null);
    if (result?.ok) monitorDelivered = true;
  }

  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  const settings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  const focusBuy = side === 'buy' && isTraderAlert ? {
    id: `fomo|${String(payload.stableKey || '').trim()}`,
    schemaVersion: 2,
    kind: 'trade',
    side: 'buy',
    tradeId: `fomo|${String(payload.stableKey || '').trim()}`,
    identityConfidence: 'exact',
    traderName,
    traderAddress: String(payload.traderAddress || '').trim(),
    tokenName: symbol,
    symbol,
    chainId: mapMarketWatchChainId(chain),
    contractAddress,
    amountUsd: Number.isFinite(Number(payload.amountUsd)) ? Number(payload.amountUsd) : undefined,
    marketCap: Number.isFinite(Number(payload.marketCapUsd)) ? Number(payload.marketCapUsd) : undefined,
    source: 'fomo-alert',
    txUrl: String(payload.url || '').trim(),
    note: `FOMO @${traderName} Buy ${payload.amountText || ''}`.trim(),
    boughtAt: formatIsoTimestamp(payload.observedAt || Date.now()),
    fomoTraderHandle: traderName,
    aggregateAmountUsd: Number.isFinite(Number(payload.amountUsd)) ? Number(payload.amountUsd) : undefined
  } : null;
  const intelligenceEvent = removeEmptyFields({
    id: `fomo-intelligence|${String(payload.stableKey || '').trim()}`,
    schemaVersion: 2,
    kind: isTraderAlert ? 'trade' : 'aggregate',
    tradeId: isTraderAlert ? `fomo|${String(payload.stableKey || '').trim()}` : undefined,
    identityConfidence: isTraderAlert ? 'exact' : undefined,
    type: 'fomo_alert',
    side,
    chainId: mapMarketWatchChainId(chain),
    contractAddress,
    tokenName: symbol,
    symbol,
    actorName: isTraderAlert ? traderName : undefined,
    actorHandle: isTraderAlert ? traderName : undefined,
    actorAddress: isTraderAlert ? String(payload.traderAddress || '').trim() : undefined,
    traderCount: isTraderAlert ? 1 : traderCount,
    buyCount: !isTraderAlert || side === 'buy' ? (side === 'buy' ? traderCount : 0) : undefined,
    sellCount: !isTraderAlert || side === 'sell' ? (side === 'sell' ? traderCount : 0) : undefined,
    amountUsd: Number.isFinite(Number(payload.amountUsd)) ? Number(payload.amountUsd) : undefined,
    marketCap: Number.isFinite(Number(payload.marketCapUsd)) ? Number(payload.marketCapUsd) : undefined,
    text: isTraderAlert ? `FOMO @${traderName} ${side} ${payload.amountText || ''}`.trim() : `FOMO ${traderCount} traders ${side} ${payload.amountText || ''}`.trim(),
    url: String(payload.url || '').trim(),
    source: 'fomo-alert',
    occurredAt: formatIsoTimestamp(payload.observedAt || Date.now())
  });
  const [marketWatch, intelligence] = await Promise.all([
    focusBuy ? dispatchFocusBuyToRelay(focusBuy, settings) : Promise.resolve({ ok: false, skipped: true }),
    dispatchMarketWatchIntelligenceEvent(intelligenceEvent)
  ]);
  return { ok: monitorDelivered || marketWatch?.ok === true || intelligence?.ok === true, monitorDelivered, marketWatch, intelligence };
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
