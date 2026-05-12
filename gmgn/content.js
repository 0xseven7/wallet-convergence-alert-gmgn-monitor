(function () {
  'use strict';
  if (window.__gcpLoaded) return;
  window.__gcpLoaded = true;

  // ===== 配置 =====
  const DEFAULT_CONFIG = {
    minWallets: 2,
    timeWindowMin: 30,   // gmgn 列表时间跨度比 xxyy 大，默认 30 分钟
    soundEnabled: true,
    collapsed: false,
    tieredAlerts: true
  };

  let config = { ...DEFAULT_CONFIG };
  let alerts = [];
  let buyRecords = [];
  let closedRecords = [];
  let seenKeys = new Set();
  let seenClosedKeys = new Set();
  let panelEl = null;
  let observer = null;
  let scanInterval = null;
  let mountCheckInterval = null;
  let injectStarsScheduled = false;
  const GMGN_SPEECH_WATCHLIST_KEY = 'gmgnSpeechWatchlist';
  const GMGN_BLACKLIST_WALLETS_KEY = 'gmgnBlacklistWallets';
  let speechWatchlist = {};
  let blacklistWallets = new Set();

  // 特别关注的钱包名
  let starred = new Set();

  // 代币元数据：mint → { chain, symbol, logo }
  const tokenMeta = new Map();

  const SHARED_STATE_KEY = 'gcp_gmgn_sources_v1';
  const SHARED_SOURCE_TTL_MS = 5 * 60 * 1000;
  const canUseSharedStorage = typeof chrome !== 'undefined'
    && chrome.storage
    && chrome.storage.local;
  const sourceId = getSourceId();
  let sharedSources = {};
  let publishSharedTimer = null;
  let sharedRefreshInterval = null;
  let sharedPoolSyncStarted = false;
  let followModeActive = false;
  let routeWatcherInstalled = false;
  const GMGN_AUDIO_SETTINGS_KEY = 'gmgnAudioSettings';
  const AUDIO_SYNC_CHANNEL_NAME = 'gmgn_convergence_audio_sync_channel';
  const TTS_STORAGE_KEYS = ['ttsVoice', 'ttsRate', 'ttsPitch'];
  const AUDIO_LOCK_MS = 4500;
  const PRESET_AUDIO_OPTIONS = new Set(['default.MP3', 'preset1.MP3', 'elonmusk.MP3', 'CZ.MP3', 'heyi.MP3']);
  const DEFAULT_TTS_SETTINGS = {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: '+0%',
    pitch: '+0%'
  };
  const TTS_API = 'https://cloudflare-edge-tts.tech-melon.workers.dev/tts';
  const TTS_VOICE_OPTIONS = new Set([
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunjianNeural',
    'zh-CN-XiaoyiNeural',
    'en-US-AvaMultilingualNeural'
  ]);
  const TTS_RATE_OPTIONS = new Set(['-10%', '+0%', '+15%', '+30%']);
  const TTS_PITCH_OPTIONS = new Set(['-5%', '+0%', '+5%']);
  const DEFAULT_AUDIO_SETTINGS = {
    enabled: true,
    preset: 'default.MP3',
    ttsEnabled: true,
    volume: 1
  };
  let audioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  let ttsSettings = { ...DEFAULT_TTS_SETTINGS };
  let preloadedAlertAudio = null;
  let audioSyncChannel = null;
  let isLockedByOtherTab = false;
  let watchedTradesPrimed = false;
  let watchedTradeSpeechQueue = Promise.resolve();
  const spokenWatchedTradeKeys = new Map();
  const WATCHED_TRADE_TTS_MAX_AGE_MS = 10 * 1000;
  const SUPPORTED_GMGN_CHAINS = new Set(['sol', 'eth', 'bsc', 'bnb', 'base', 'tron', 'blast']);
  const FOLLOW_PATH_RE = /^\/(?:follow(?:\/|$)|(?:sol|eth|bsc|base|tron|blast)\/follow(?:\/|$))/i;

  function getSourceId() {
    try {
      const saved = sessionStorage.getItem('gcp_source_id');
      if (saved) return saved;
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `gcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem('gcp_source_id', id);
      return id;
    } catch (e) {
      return `gcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function stripTradeForStorage(r) {
    return {
      wallet: r.wallet || '',
      walletAvatar: r.walletAvatar || '',
      action: r.action || '',
      isBuy: !!r.isBuy,
      token: r.token || '',
      mint: r.mint || '',
      chain: r.chain || '',
      amount: r.amount || '',
      mcap: r.mcap || '',
      timeAgo: r.timeAgo || '',
      tradeAge: r.tradeAge || '',
      timeMs: r.timeMs || 0,
      tokenLogo: r.tokenLogo || '',
      href: r.href || '',
      platform: r.platform || null
    };
  }

  function normalizeChainName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!SUPPORTED_GMGN_CHAINS.has(normalized)) return '';
    return normalized === 'bnb' ? 'bsc' : normalized;
  }

  function getLocationChainHint() {
    try {
      const currentUrl = new URL(location.href);
      const queryChain = normalizeChainName(
        currentUrl.searchParams.get('chain')
        || currentUrl.searchParams.get('network')
        || currentUrl.searchParams.get('tab')
      );
      if (queryChain) return queryChain;

      const followPrefixMatch = currentUrl.pathname.match(/^\/(sol|eth|bsc|bnb|base|tron|blast)\/follow(?:\/|$)/i);
      if (followPrefixMatch) return normalizeChainName(followPrefixMatch[1]);

      const followSuffixMatch = currentUrl.pathname.match(/^\/follow\/(sol|eth|bsc|bnb|base|tron|blast)(?:\/|$)/i);
      if (followSuffixMatch) return normalizeChainName(followSuffixMatch[1]);

      const pathMatch = currentUrl.pathname.match(/^\/(sol|eth|bsc|bnb|base|tron|blast)(?:\/|$)/i);
      if (pathMatch) return normalizeChainName(pathMatch[1]);
    } catch (e) {}
    return '';
  }

  function parseGmgnTokenHref(rawHref) {
    const href = String(rawHref || '').trim();
    if (!href) return { href: '', chain: '', mint: '' };

    const pathMatch = href.match(/\/(sol|eth|bsc|bnb|base|tron|blast)\/token\/([1-9A-HJ-NP-Za-km-z]{32,}|0x[a-fA-F0-9]{40})/i);
    if (pathMatch) {
      return {
        href,
        chain: normalizeChainName(pathMatch[1]),
        mint: pathMatch[2]
      };
    }

    try {
      const parsed = new URL(href, location.href);
      const queryMatch = parsed.pathname.match(/\/token\/([1-9A-HJ-NP-Za-km-z]{32,}|0x[a-fA-F0-9]{40})/i);
      if (queryMatch) {
        return {
          href,
          chain: normalizeChainName(parsed.searchParams.get('chain') || parsed.searchParams.get('network')),
          mint: queryMatch[1]
        };
      }
    } catch (e) {}

    return { href, chain: '', mint: '' };
  }

  function getTradeRowTokenLinkInfo(row) {
    const anchors = Array.from(row?.querySelectorAll?.('a[href]') || []);
    for (const anchor of anchors) {
      const parsed = parseGmgnTokenHref(anchor.getAttribute('href') || anchor.href || '');
      if (parsed.mint) return parsed;
    }

    const fallbackAnchor = anchors[0];
    return parseGmgnTokenHref(fallbackAnchor ? (fallbackAnchor.getAttribute('href') || fallbackAnchor.href || '') : '');
  }

  function getCurrentChainHint() {
    const locationChain = getLocationChainHint();
    if (locationChain) return locationChain;
    const recent = buyRecords.find(r => r.chain) || closedRecords.find(r => r.chain);
    return recent ? normalizeChainName(recent.chain) : '';
  }

  function pruneSharedSources(sources, now = Date.now()) {
    const next = {};
    for (const [id, source] of Object.entries(sources || {})) {
      if (!source || !source.updatedAt) continue;
      if ((now - source.updatedAt) > SHARED_SOURCE_TTL_MS) continue;
      next[id] = source;
    }
    return next;
  }

  function schedulePublishSharedSnapshot() {
    if (!canUseSharedStorage || publishSharedTimer) return;
    publishSharedTimer = setTimeout(() => {
      publishSharedTimer = null;
      publishSharedSnapshot();
    }, 250);
  }

  async function publishSharedSnapshot() {
    if (!canUseSharedStorage) return;
    try {
      const now = Date.now();
      const stored = await chrome.storage.local.get(SHARED_STATE_KEY);
      const sources = pruneSharedSources(stored[SHARED_STATE_KEY] || {}, now);
      sources[sourceId] = {
        sourceId,
        url: location.href,
        chain: getCurrentChainHint(),
        updatedAt: now,
        rowCount: lastScanInfo.rowCount || 0,
        buys: buyRecords.slice(-300).map(stripTradeForStorage),
        closes: closedRecords.slice(-300).map(stripTradeForStorage)
      };
      sharedSources = sources;
      await chrome.storage.local.set({ [SHARED_STATE_KEY]: sources });
      updateStatus();
    } catch (e) {}
  }

  async function removeSharedSnapshot() {
    if (!canUseSharedStorage) return;
    try {
      const stored = await chrome.storage.local.get(SHARED_STATE_KEY);
      const sources = stored[SHARED_STATE_KEY] || {};
      if (sources[sourceId]) {
        delete sources[sourceId];
        await chrome.storage.local.set({ [SHARED_STATE_KEY]: sources });
      }
    } catch (e) {}
  }

  window.addEventListener('pagehide', () => {
    void removeSharedSnapshot();
  }, { once: true });

  window.addEventListener('pagehide', () => {
    if (audioSyncChannel) {
      audioSyncChannel.close();
      audioSyncChannel = null;
    }
    if (preloadedAlertAudio) {
      try {
        preloadedAlertAudio.pause();
        preloadedAlertAudio.removeAttribute('src');
        preloadedAlertAudio.load();
      } catch (e) {}
      preloadedAlertAudio = null;
    }
  }, { once: true });

  async function loadSharedSnapshots(options = {}) {
    if (!canUseSharedStorage) return;
    try {
      const stored = await chrome.storage.local.get(SHARED_STATE_KEY);
      sharedSources = pruneSharedSources(stored[SHARED_STATE_KEY] || {});
      if (options.recalculate) {
        cleanOldRecords();
        checkConvergence();
        updateStatus();
      }
    } catch (e) {}
  }

  function handleSharedStorageChange(changes, areaName) {
    if (areaName !== 'local') return;
    if (changes[SHARED_STATE_KEY]) {
      sharedSources = pruneSharedSources(changes[SHARED_STATE_KEY].newValue || {});
      cleanOldRecords();
      checkConvergence();
      updateStatus();
    }
    if (changes[GMGN_AUDIO_SETTINGS_KEY]) {
      audioSettings = normalizeAudioSettings(changes[GMGN_AUDIO_SETTINGS_KEY].newValue);
      warmupAlertAudio();
    }
    if (changes[GMGN_SPEECH_WATCHLIST_KEY]) {
      applySpeechWatchlist(changes[GMGN_SPEECH_WATCHLIST_KEY].newValue || {});
      lastRenderState = '';
      renderAlerts();
      injectOrigStars();
    }
    if (changes[GMGN_BLACKLIST_WALLETS_KEY]) {
      applyBlacklistWallets(changes[GMGN_BLACKLIST_WALLETS_KEY].newValue || {});
      lastRenderState = '';
      renderAlerts();
      injectOrigStars();
    }
    if (changes.ttsVoice || changes.ttsRate || changes.ttsPitch) {
      ttsSettings = normalizeTtsSettings({
        ttsVoice: changes.ttsVoice ? changes.ttsVoice.newValue : ttsSettings.voice,
        ttsRate: changes.ttsRate ? changes.ttsRate.newValue : ttsSettings.rate,
        ttsPitch: changes.ttsPitch ? changes.ttsPitch.newValue : ttsSettings.pitch
      });
    }
  }

  function startSharedPoolSync() {
    if (!canUseSharedStorage || sharedPoolSyncStarted) return;
    sharedPoolSyncStarted = true;
    loadSharedSnapshots({ recalculate: true });
    chrome.storage.onChanged.addListener(handleSharedStorageChange);
    if (sharedRefreshInterval) clearInterval(sharedRefreshInterval);
    sharedRefreshInterval = setInterval(() => {
      loadSharedSnapshots({ recalculate: true });
      schedulePublishSharedSnapshot();
    }, 10000);
  }

  function stopSharedPoolSync() {
    if (!canUseSharedStorage || !sharedPoolSyncStarted) return;
    sharedPoolSyncStarted = false;
    chrome.storage.onChanged.removeListener(handleSharedStorageChange);
    if (sharedRefreshInterval) {
      clearInterval(sharedRefreshInterval);
      sharedRefreshInterval = null;
    }
    if (publishSharedTimer) {
      clearTimeout(publishSharedTimer);
      publishSharedTimer = null;
    }
    sharedSources = {};
  }

  function normalizeAudioSettings(raw) {
    const settings = {
      ...DEFAULT_AUDIO_SETTINGS,
      ...(raw || {})
    };
    if (typeof settings.enabled !== 'boolean') settings.enabled = DEFAULT_AUDIO_SETTINGS.enabled;
    if (typeof settings.ttsEnabled !== 'boolean') settings.ttsEnabled = DEFAULT_AUDIO_SETTINGS.ttsEnabled;
    if (!PRESET_AUDIO_OPTIONS.has(settings.preset)) settings.preset = DEFAULT_AUDIO_SETTINGS.preset;
    const volume = Number(settings.volume);
    settings.volume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : DEFAULT_AUDIO_SETTINGS.volume;
    return settings;
  }

  function normalizeTtsSettings(raw) {
    return {
      voice: normalizeTtsVoice(raw && raw.ttsVoice),
      rate: normalizeTtsRate(raw && raw.ttsRate),
      pitch: normalizeTtsPitch(raw && raw.ttsPitch)
    };
  }

  function normalizeTtsVoice(value) {
    return TTS_VOICE_OPTIONS.has(value) ? value : DEFAULT_TTS_SETTINGS.voice;
  }

  function normalizeTtsRate(value) {
    return TTS_RATE_OPTIONS.has(value) ? value : DEFAULT_TTS_SETTINGS.rate;
  }

  function normalizeTtsPitch(value) {
    return TTS_PITCH_OPTIONS.has(value) ? value : DEFAULT_TTS_SETTINGS.pitch;
  }

  function parsePercentString(value) {
    const match = /^([+-]?\d+(?:\.\d+)?)%$/.exec(String(value || '').trim());
    return match ? Number(match[1]) : 0;
  }

  function speechSynthesisRateFromConfig(value) {
    return Math.min(2, Math.max(0.5, 1 + (parsePercentString(value) / 100)));
  }

  function speechSynthesisPitchFromConfig(value) {
    return Math.min(2, Math.max(0, 1 + (parsePercentString(value) / 100)));
  }

  async function loadAudioSettings() {
    if (!canUseSharedStorage) return;
    try {
      const stored = await chrome.storage.local.get(GMGN_AUDIO_SETTINGS_KEY);
      audioSettings = normalizeAudioSettings(stored[GMGN_AUDIO_SETTINGS_KEY]);
      warmupAlertAudio();
    } catch (e) {}
  }

  async function loadTtsSettings() {
    if (!canUseSharedStorage) return;
    try {
      const stored = await chrome.storage.local.get(TTS_STORAGE_KEYS);
      ttsSettings = normalizeTtsSettings(stored);
    } catch (e) {}
  }

  function getAlertAudioSrc() {
    return chrome.runtime.getURL(`sounds/${audioSettings.preset}`);
  }

  function warmupAlertAudio() {
    const src = getAlertAudioSrc();
    if (preloadedAlertAudio) {
      try {
        if (preloadedAlertAudio.src === src) return;
        preloadedAlertAudio.pause();
        preloadedAlertAudio.removeAttribute('src');
        preloadedAlertAudio.load();
      } catch (e) {}
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audio.load();
    preloadedAlertAudio = audio;
  }

  function ensureAudioSyncChannel() {
    if (audioSyncChannel) return;
    audioSyncChannel = new BroadcastChannel(AUDIO_SYNC_CHANNEL_NAME);
    audioSyncChannel.onmessage = (event) => {
      if (event.data !== 'PLAYING_AUDIO') return;
      isLockedByOtherTab = true;
      setTimeout(() => { isLockedByOtherTab = false; }, AUDIO_LOCK_MS);
    };
  }

  function getCombinedRecords(kind) {
    const now = Date.now();
    const windowMs = config.timeWindowMin * 60 * 1000 * (kind === 'closes' ? 2 : 1);
    const local = kind === 'closes' ? closedRecords : buyRecords;
    const combined = [];
    const seen = new Set();

    function addRecord(r, source) {
      if (!r || !r.timeMs || (now - r.timeMs) > windowMs) return;
      const key = [
        source,
        r.chain || '',
        r.mint || r.token || '',
        r.wallet || '',
        r.timeMs || r.timeAgo || ''
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(r);
    }

    for (const r of local) addRecord(r, 'local');
    for (const [id, source] of Object.entries(pruneSharedSources(sharedSources, now))) {
      if (id === sourceId) continue;
      const records = Array.isArray(source[kind]) ? source[kind] : [];
      for (const r of records) addRecord(r, id);
    }
    return combined;
  }

  function getCombinedBuyRecords() {
    return getCombinedRecords('buys');
  }

  function getCombinedClosedRecords() {
    return getCombinedRecords('closes');
  }

  function getSharedChainSummary() {
    const counts = {};
    for (const r of getCombinedBuyRecords()) {
      const chain = (r.chain || 'unknown').toUpperCase();
      counts[chain] = (counts[chain] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chain, count]) => `${chain}:${count}`)
      .join(' ');
  }

  // 缩写合约
  function shortMint(m) {
    if (!m) return '';
    if (m.length <= 10) return m;
    return m.slice(0, 4) + '…' + m.slice(-4);
  }

  // ===== 检测代币发射平台 =====
  function detectPlatform(mint, chain, dexHint) {
    const m = (mint || '').toLowerCase();
    const c = (chain || '').toLowerCase();
    const d = (dexHint || '').toLowerCase();
    if (c === 'sol') {
      if (m.endsWith('pump')) return { tag: 'pump', label: 'pump.fun', cls: 'gcp-plat-pump' };
      if (m.endsWith('bonk')) return { tag: 'bonk', label: 'bonk.fun', cls: 'gcp-plat-bonk' };
      if (m.endsWith('boop')) return { tag: 'boop', label: 'boop.fun', cls: 'gcp-plat-boop' };
    }
    if (c === 'bsc' || c === 'bnb') {
      if (d.includes('four') || d.includes('4.meme')) return { tag: 'four', label: 'four.meme', cls: 'gcp-plat-four' };
    }
    if (d.includes('pump')) return { tag: 'pump', label: 'pump.fun', cls: 'gcp-plat-pump' };
    return null;
  }

  try {
    const saved = localStorage.getItem('gcp_config');
    if (saved) Object.assign(config, JSON.parse(saved));
  } catch (e) {}

  function saveConfig() {
    try { localStorage.setItem('gcp_config', JSON.stringify(config)); } catch (e) {}
  }
  function normalizeSpeechWatchlist(raw) {
    const next = {};
    for (const [walletName, meta] of Object.entries(raw || {})) {
      const normalizedWallet = normalizeSpeechWatchWallet(walletName);
      if (!normalizedWallet) continue;
      next[normalizedWallet] = {
        alias: typeof meta?.alias === 'string' ? meta.alias.trim() : ''
      };
    }
    return next;
  }

  function applySpeechWatchlist(raw) {
    speechWatchlist = normalizeSpeechWatchlist(raw);
    starred = new Set(Object.keys(speechWatchlist));
  }

  async function loadSpeechWatchlist() {
    try {
      if (canUseSharedStorage) {
        const stored = await chrome.storage.local.get(GMGN_SPEECH_WATCHLIST_KEY);
        const storedList = stored[GMGN_SPEECH_WATCHLIST_KEY];
        if (storedList && typeof storedList === 'object') {
          applySpeechWatchlist(storedList);
          return;
        }
      }

      const savedStars = localStorage.getItem('gcp_starred');
      if (!savedStars) {
        applySpeechWatchlist({});
        return;
      }

      const legacyWallets = JSON.parse(savedStars);
      const migrated = {};
      if (Array.isArray(legacyWallets)) {
        legacyWallets.forEach((walletName) => {
          const normalizedWallet = normalizeSpeechWatchWallet(walletName);
          if (!normalizedWallet) return;
          migrated[normalizedWallet] = { alias: '' };
        });
      }
      applySpeechWatchlist(migrated);
      void persistSpeechWatchlist();
    } catch (e) {
      applySpeechWatchlist({});
    }
  }

  function persistSpeechWatchlist() {
    try {
      localStorage.setItem('gcp_starred', JSON.stringify(Object.keys(speechWatchlist)));
    } catch (e) {}
    if (canUseSharedStorage) {
      return chrome.storage.local.set({ [GMGN_SPEECH_WATCHLIST_KEY]: speechWatchlist }).catch(() => {});
    }
    return Promise.resolve();
  }

  function saveStarred() {
    void persistSpeechWatchlist();
  }

  function normalizeSpeechWatchWallet(value) {
    return String(value || '').trim();
  }

  function getSpeechWatchAlias(walletName) {
    const normalizedWallet = normalizeSpeechWatchWallet(walletName);
    return speechWatchlist[normalizedWallet]?.alias || '';
  }

  function normalizeBlacklistWallets(raw) {
    const next = new Set();
    if (Array.isArray(raw)) {
      raw.forEach((walletName) => {
        const normalizedWallet = normalizeSpeechWatchWallet(walletName);
        if (normalizedWallet) next.add(normalizedWallet);
      });
      return next;
    }

    for (const [walletName, enabled] of Object.entries(raw || {})) {
      const normalizedWallet = normalizeSpeechWatchWallet(walletName);
      if (!normalizedWallet || enabled === false) continue;
      next.add(normalizedWallet);
    }
    return next;
  }

  function applyBlacklistWallets(raw) {
    blacklistWallets = normalizeBlacklistWallets(raw);
  }

  async function loadBlacklistWallets() {
    if (!canUseSharedStorage) {
      applyBlacklistWallets({});
      return;
    }
    try {
      const stored = await chrome.storage.local.get(GMGN_BLACKLIST_WALLETS_KEY);
      applyBlacklistWallets(stored[GMGN_BLACKLIST_WALLETS_KEY]);
    } catch (e) {
      applyBlacklistWallets({});
    }
  }

  function persistBlacklistWallets() {
    if (!canUseSharedStorage) return Promise.resolve();
    const nextState = {};
    blacklistWallets.forEach((walletName) => {
      nextState[walletName] = true;
    });
    return chrome.storage.local.set({ [GMGN_BLACKLIST_WALLETS_KEY]: nextState }).catch(() => {});
  }

  function toggleStar(walletName) {
    const normalizedWallet = normalizeSpeechWatchWallet(walletName);
    if (!normalizedWallet) return;
    if (starred.has(normalizedWallet)) {
      delete speechWatchlist[normalizedWallet];
    } else {
      speechWatchlist[normalizedWallet] = speechWatchlist[normalizedWallet] || { alias: '' };
    }
    applySpeechWatchlist(speechWatchlist);
    saveStarred();
    lastRenderState = '';
    renderAlerts();
    injectOrigStars();
  }

  function toggleBlacklistWallet(walletName) {
    const normalizedWallet = normalizeSpeechWatchWallet(walletName);
    if (!normalizedWallet) return;
    if (blacklistWallets.has(normalizedWallet)) {
      blacklistWallets.delete(normalizedWallet);
    } else {
      blacklistWallets.add(normalizedWallet);
    }
    void persistBlacklistWallets();
    lastRenderState = '';
    renderAlerts();
    injectOrigStars();
  }

  function isAlertStarred(a) {
    return a.wallets && a.wallets.some(w => starred.has(w.name));
  }

  function isTradeStarred(trade) {
    return !!(trade && trade.wallet && starred.has(trade.wallet));
  }

  function isWalletBlacklisted(walletName) {
    return !!(walletName && blacklistWallets.has(walletName));
  }

  function hasStarredWallet(walletNames) {
    return Array.isArray(walletNames) && walletNames.some((walletName) => starred.has(walletName));
  }

  function isBuyAction(action) {
    return /(加仓|建仓|买入)/.test(action || '');
  }

  function isSellAction(action) {
    return /(减仓|卖出|清仓)/.test(action || '');
  }

  function normalizeWatchedTradeVerb(trade) {
    const action = trade && trade.action ? trade.action : '';
    if (/清仓/.test(action)) return '清仓了';
    if (/建仓/.test(action)) return '建仓了';
    if (/(减仓|卖出)/.test(action)) return '卖出了';
    if (/(加仓|买入)/.test(action) || trade.isBuy) return '买入了';
    return '操作了';
  }

  function buildWatchedTradeSpeechText(trade) {
    const rawWalletName = (trade && trade.wallet) ? trade.wallet.trim() : '';
    const walletName = getSpeechWatchAlias(rawWalletName) || rawWalletName || '关注钱包';
    const verb = normalizeWatchedTradeVerb(trade);
    const assetText = `${trade && trade.amount ? trade.amount : ''}${trade && trade.token ? trade.token : ''}`.trim() || '这个代币';
    return `${walletName} ${verb} ${assetText}`;
  }

  function buildWatchedTradeSpeechKey(trade) {
    const timeBucket = Math.round(((trade && trade.timeMs) || Date.now()) / 60000);
    return [
      trade && trade.wallet ? trade.wallet : '',
      normalizeWatchedTradeVerb(trade),
      trade && trade.chain ? trade.chain : '',
      trade && (trade.mint || trade.token) ? (trade.mint || trade.token) : '',
      trade && trade.amount ? trade.amount : '',
      timeBucket
    ].join('|');
  }

  function isRecentEnoughForWatchedTradeSpeech(trade, now = Date.now()) {
    if (!trade) return false;
    const secondsMatch = /^(\d+)s$/.exec(String(trade.timeAgo || '').trim());
    if (!secondsMatch) return false;
    const ageSeconds = Number(secondsMatch[1]);
    if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > 10) return false;
    if (!trade.timeMs) return false;
    const ageMs = now - trade.timeMs;
    return ageMs >= 0 && ageMs <= WATCHED_TRADE_TTS_MAX_AGE_MS;
  }

  function flushWatchedTradeAnnouncements(trades) {
    if (!Array.isArray(trades) || trades.length === 0) return;
    const now = Date.now();
    for (const trade of trades) {
      if (!isRecentEnoughForWatchedTradeSpeech(trade, now)) continue;
      const speechKey = buildWatchedTradeSpeechKey(trade);
      if (hasSpokenWatchedTradeRecently(speechKey, now)) continue;
      markWatchedTradeSpoken(speechKey, now);
      queueWatchedTradeSpeech(trade);
    }
  }

  // ===== DOM 定位：找到追踪 tab 的虚拟列表 =====
  // gmgn 的钱包追踪面板：内含 .pi-tabs 顶部 tabs + .virtual-list-container 列表
  function findTrackingPanel() {
    // 找包含 "钱包 N" tab 的容器
    const tabBtns = document.querySelectorAll('.pi-tabs-tab-btn');
    for (const t of tabBtns) {
      if (/^钱包\s*\d+$/.test(t.textContent.trim())) {
        return t.closest('.flex.flex-col.size-full') || t.closest('.flex-col.gap-12px') || t.closest('.pi-tabs')?.parentElement;
      }
    }
    return null;
  }

  function findVirtualList() {
    const panel = findTrackingPanel();
    if (!panel) return null;
    return panel.querySelector('.virtual-list-container');
  }

  // 找所有 trade-like 的 virtual-list（用户可能开多个钱包追踪面板分别监控不同链）
  // 返回 [{list, panel, isOnTracking}, ...]
  function findAllTrackingLists() {
    const lists = document.querySelectorAll('.virtual-list-container');
    const result = [];
    for (const list of lists) {
      // 找最近的、含「追踪」tab 的祖先
      let panel = list.closest('.flex.flex-col.size-full');
      if (!panel) panel = list.closest('.flex.flex-col');
      if (!panel) continue;
      const tabs = panel.querySelectorAll('.pi-tabs-tab-btn');
      const hasTrackTab = Array.from(tabs).some(t => /追踪/.test(t.textContent.trim()));
      if (!hasTrackTab) continue;
      // 检查当前是否激活在「追踪」
      let active = null;
      for (const t of tabs) {
        if (t.classList.contains('pi-tabs-tab-btn-active') || t.parentElement?.classList.contains('pi-tabs-tab-active')) {
          active = t.textContent.trim();
          break;
        }
      }
      const isOnTracking = !active || /追踪/.test(active);
      result.push({ list, panel, isOnTracking });
    }
    return result;
  }

  // 检查至少有一个面板在 追踪 tab
  function isOnTrackingTab() {
    const all = findAllTrackingLists();
    return all.some(p => p.isOnTracking);
  }

  // ===== 解析单条 trade =====
  function parseTradeRow(row) {
    if (!row || !row.querySelector) return null;
    const anchors = Array.from(row.querySelectorAll('a[href]'));
    const a = anchors.find((anchor) => anchor.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]'))
      || anchors.find((anchor) => anchor.querySelector('[data-sentry-component="AutoTruncateText"]'))
      || anchors[0];
    if (!a) return null;

    const tokenLink = getTradeRowTokenLinkInfo(row);
    const href = tokenLink.href || a.getAttribute('href') || '';
    const chain = tokenLink.chain || getLocationChainHint();
    const mint = tokenLink.mint || '';

    // 钱包名：第一个 .text-yellow-100 的 AutoTruncateText
    const walletEl = a.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
      || a.querySelector('[data-sentry-component="AutoTruncateText"]');
    const wallet = walletEl ? walletEl.textContent.trim() : '';
    if (!wallet) return null;

    // 第一行：动作 + 涨跌 + 时间
    const line1 = a.children[0];
    const line2 = a.children[1];
    if (!line1 || !line2) return null;

    // 动作：含 清仓/加仓/建仓/减仓/买入/卖出
    let action = '';
    let isBuy = false;
    line1.querySelectorAll('.whitespace-nowrap').forEach(el => {
      const t = el.textContent.trim();
      if (!action && /(清仓|加仓|建仓|减仓|买入|卖出)/.test(t)) action = t;
    });
    if (/(加仓|建仓|买入)/.test(action)) isBuy = true;

    // 时间："2h" / "5m" / "3d"
    const timeEls = line1.querySelectorAll('.text-text-300.inline');
    let timeAgo = '';
    timeEls.forEach(el => {
      const t = el.textContent.trim();
      if (/^\d+[smhd]$/.test(t.replace(/\s/g, ''))) timeAgo = t.replace(/\s/g, '');
    });
    if (!timeAgo) {
      // 兜底：line1 里找 \d+[smhd] 模式
      const txt = line1.textContent.replace(/\s+/g, ' ');
      const tm = txt.match(/(\d+)\s*([smhd])\b/);
      if (tm) timeAgo = tm[1] + tm[2];
    }

    // line2: <amount><tokenSymbol><tradeAge> MC:$<mcap>
    const line2Text = line2.textContent.replace(/\s+/g, ' ').trim();
    // 拆 MC:
    const mcMatch = line2Text.match(/MC[:\s]*[\$￥]?([\d.]+[KMBkmb]?)/);
    const mcap = mcMatch ? '$' + mcMatch[1] : '';
    let headPart = mcMatch ? line2Text.substring(0, line2Text.indexOf(mcMatch[0])).trim() : line2Text;
    // **先剥掉末尾的时间** (\d+[smhd]) — 否则会被当成 token 名的一部分
    let tradeAge = '';
    const tmTail = headPart.match(/(\d+[smhd])\s*$/);
    if (tmTail) {
      tradeAge = tmTail[1];
      headPart = headPart.substring(0, headPart.length - tmTail[0].length).trim();
    }
    // headPart 现在只剩 "<amount><tokenSymbol>"
    let amount = '', tokenSymbol = '';
    const am = headPart.match(/^([\d.,]+)/);
    if (am) {
      amount = am[1];
      tokenSymbol = headPart.substring(am[1].length).trim();
    } else {
      tokenSymbol = headPart;
    }

    // 把时间 "2h" 转成毫秒（相对 now）
    let timeMs = Date.now();
    const tm = timeAgo.match(/^(\d+)([smhd])$/);
    if (tm) {
      const n = parseInt(tm[1]);
      const unit = tm[2];
      const ms = n * (unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000);
      timeMs = Date.now() - ms;
    }

    // 钱包头像 = line 1 里第一个 <img>
    const walletAvatar = line1.querySelector('img')?.src || '';
    // 代币 logo = line 2 里非 native 链图标的图片（链图标 src 含 'icons/icon_'）
    let tokenLogo = '';
    line2.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (!tokenLogo && !src.includes('/icons/icon_')) tokenLogo = src;
    });

    // 累积 token meta
    if (mint) {
      const existing = tokenMeta.get(mint) || {};
      tokenMeta.set(mint, {
        chain: chain || existing.chain,
        symbol: tokenSymbol || existing.symbol,
        logo: tokenLogo || existing.logo
      });
    }

    // gmgn 没有显式的 dex 字段，靠 mint 后缀检测平台（BSC 的 four.meme 暂时识别不到）
    const platform = detectPlatform(mint, chain, '');

    return {
      wallet,
      walletAvatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint,
      chain,
      amount,
      mcap,
      timeAgo,
      tradeAge,
      timeMs,
      tokenLogo,
      href,
      platform
    };
  }

  // ===== 扫描列表 =====
  // 诊断信息（status 指示用）
  let lastScanInfo = {
    panelCount: 0,
    activeTrackingPanels: 0,
    rowCount: 0,
    panelsOff: 0,            // 在非追踪 tab 的面板
    error: ''
  };

  function updateStatus() {
    if (!panelEl) return;
    const st = panelEl.querySelector('.gcp-status');
    if (!st) return;
    const i = lastScanInfo;
    const pool = getCombinedBuyRecords().length;
    const closes = getCombinedClosedRecords().length;
    const chainSummary = getSharedChainSummary();

    let text, title;
    if (i.error) {
      text = `⚠️ ${i.rowCount} 行 · 池 ${pool}`;
      title = i.error;
      st.classList.add('is-warn');
      st.classList.remove('is-ok');
    } else if (i.rowCount > 0) {
      text = `🔍 ${i.rowCount} 行 · 池 ${pool}`;
      const parts = [
        `${i.activeTrackingPanels}/${i.panelCount} 个面板在追踪 tab`,
        `当前可见 ${i.rowCount} 行`,
        `池中 ${pool} 笔买入${closes ? ' / ' + closes + ' 笔清仓' : ''}`,
      ];
      title = parts.join('\n');
      st.classList.add('is-ok');
      st.classList.remove('is-warn');
    } else {
      text = `🔍 0 行 · 池 ${pool}`;
      title = '列表无可见行（可能未滚动或 gmgn 自身筛选）';
      st.classList.remove('is-ok');
      st.classList.remove('is-warn');
    }
    if (chainSummary) {
      text += ` | ${chainSummary}`;
      title += `\nChains: ${chainSummary}`;
    }
    st.textContent = text;
    st.title = title;
  }

  function scanTrades() {
    if (!followModeActive || !isMonitorWindowPage()) {
      return;
    }

    const all = findAllTrackingLists();
    lastScanInfo.panelCount = all.length;
    lastScanInfo.activeTrackingPanels = all.filter(p => p.isOnTracking).length;
    lastScanInfo.panelsOff = all.length - lastScanInfo.activeTrackingPanels;

    if (all.length === 0) {
      lastScanInfo.rowCount = 0;
      lastScanInfo.error = '没找到钱包追踪面板';
      cleanOldRecords();
      schedulePublishSharedSnapshot();
      checkConvergence();
      updateStatus();
      return;
    }
    if (lastScanInfo.activeTrackingPanels === 0) {
      lastScanInfo.rowCount = 0;
      lastScanInfo.error = '所有面板都不在「追踪」tab';
      cleanOldRecords();
      schedulePublishSharedSnapshot();
      checkConvergence();
      updateStatus();
      return;
    }

    let added = 0;
    let totalRows = 0;
    const watchedTradesToSpeak = [];
    const canAnnounceWatchedTrades = watchedTradesPrimed;
    // 遍历所有在「追踪」tab 的面板
    for (const { list, isOnTracking } of all) {
      if (!isOnTracking) continue;
      const rowsRoot = list.children[0]?.children[0];
      if (!rowsRoot) continue;
      const rows = rowsRoot.children;
      totalRows += rows.length;
      for (const row of rows) {
        const trade = parseTradeRow(row);
        if (!trade) continue;
        if (trade.isBuy) {
          const key = `${trade.mint || trade.token}|${trade.wallet}|${trade.timeAgo}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          buyRecords.push(trade);
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        } else if (trade.action && trade.action.includes('清仓')) {
          const ck = `C|${trade.mint || trade.token}|${trade.wallet}|${trade.timeAgo}`;
          if (seenClosedKeys.has(ck)) continue;
          seenClosedKeys.add(ck);
          closedRecords.push(trade);
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        } else if (isSellAction(trade.action)) {
          const sk = `S|${trade.chain || ''}|${trade.mint || trade.token}|${trade.wallet}|${trade.amount}|${trade.timeAgo}`;
          if (seenClosedKeys.has(sk)) continue;
          seenClosedKeys.add(sk);
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        }
      }
    }
    lastScanInfo.rowCount = totalRows;
    lastScanInfo.error = totalRows === 0 ? '追踪 tab 列表为空（gmgn 过滤无活动钱包？）' : '';
    updateStatus();

    cleanOldRecords();
    schedulePublishSharedSnapshot();
    checkConvergence();
    flushWatchedTradeAnnouncements(watchedTradesToSpeak);
    watchedTradesPrimed = true;

    if (seenKeys.size > 5000) {
      seenKeys = new Set(Array.from(seenKeys).slice(-2500));
    }

    // 持续注入星标
    scheduleInjectStars();
  }

  function cleanOldRecords() {
    const now = Date.now();
    const cutoff = config.timeWindowMin * 60 * 1000;
    buyRecords = buyRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff);
    closedRecords = closedRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff * 2);
    if (seenKeys.size > 5000) seenKeys = new Set(Array.from(seenKeys).slice(-2500));
    if (seenClosedKeys.size > 5000) seenClosedKeys = new Set(Array.from(seenClosedKeys).slice(-2500));
    cleanDissolvedAlerts();
  }

  // 全员清仓的提醒保留 5 分钟后自动移除
  const DISSOLVED_KEEP_MS = 5 * 60 * 1000;
  function cleanDissolvedAlerts() {
    const now = Date.now();
    const before = alerts.length;
    alerts = alerts.filter(a => !a.dissolvedAt || (now - a.dissolvedAt) < DISSOLVED_KEEP_MS);
    if (alerts.length !== before) renderAlerts();
  }

  // ===== 聚合检测 =====
  function checkConvergence() {
    const now = Date.now();
    const windowMs = config.timeWindowMin * 60 * 1000;
    const groups = {};
    const combinedBuyRecords = getCombinedBuyRecords();
    const combinedClosedRecords = getCombinedClosedRecords();

    for (const r of combinedBuyRecords) {
      if (!r.timeMs || (now - r.timeMs) > windowMs) continue;
      // 严格按 mint 聚合，没 mint 不参与
      if (!r.mint) continue;
      const key = `${r.chain || 'unknown'}|${r.mint}`;
      if (!groups[key]) groups[key] = { wallets: {}, mcap: r.mcap, mint: r.mint, chain: r.chain, token: r.token, tokenLogo: r.tokenLogo, platform: r.platform || null };
      const g = groups[key];
      if (!g.wallets[r.wallet]) g.wallets[r.wallet] = { amount: r.amount, timeAgo: r.timeAgo, timeMs: r.timeMs, avatar: r.walletAvatar };
      if (r.mcap) g.mcap = r.mcap;
      if (r.token) g.token = r.token;
      if (r.tokenLogo && !g.tokenLogo) g.tokenLogo = r.tokenLogo;
      if (r.platform && !g.platform) g.platform = r.platform;
    }

    let triggered = false, updated = false;
    let highestTierFired = 0;

    for (const [groupKey, group] of Object.entries(groups)) {
      const walletNames = Object.keys(group.wallets);
      const hasPriorityWallet = hasStarredWallet(walletNames);
      const requiredWallets = hasPriorityWallet ? 1 : config.minWallets;
      if (walletNames.length < requiredWallets) continue;

      const walletDetails = walletNames.map(w => {
        const wd = group.wallets[w];
        const closeMatch = combinedClosedRecords.find(c =>
          c.wallet === w &&
          (c.chain || '') === (group.chain || '') &&
          ((group.mint && c.mint === group.mint) ||
           (!group.mint && !c.mint && c.token === group.token)) &&
          c.timeMs > wd.timeMs
        );
        return {
          name: w,
          amount: wd.amount,
          timeAgo: wd.timeAgo,
          timeMs: wd.timeMs,
          avatar: wd.avatar,
          closed: !!closeMatch,
          closedAt: closeMatch ? closeMatch.timeMs : null
        };
      });
      const closedCount = walletDetails.filter(w => w.closed).length;
      const effectiveCount = walletNames.length - closedCount;

      const newTier = calcTier(effectiveCount);

      // 严格按 mint 匹配（group.mint 一定存在）
      const existing = alerts.find(a =>
        a.mint &&
        a.mint === group.mint &&
        (a.chain || '') === (group.chain || '')
      );

      if (existing) {
        const sameCount = existing.walletCount === walletNames.length;
        const sameClose = (existing.closedCount || 0) === closedCount;
        if (sameCount && sameClose) continue;
        const prevTier = existing.tier || calcTier(existing.effectiveCount || existing.walletCount);
        existing.walletCount = walletNames.length;
        existing.effectiveCount = effectiveCount;
        existing.closedCount = closedCount;
        // 全员清仓 → 标记 dissolvedAt（之后 5 分钟自动从列表移除）；又有人买回来 → 清掉
        if (effectiveCount === 0) {
          if (!existing.dissolvedAt) existing.dissolvedAt = Date.now();
        } else {
          existing.dissolvedAt = null;
        }
        existing.wallets = walletDetails;
        existing.mcap = group.mcap || existing.mcap;
        existing.token = group.token || existing.token;
        existing.mint = group.mint || existing.mint;
        existing.chain = group.chain || existing.chain;
        existing.tokenLogo = group.tokenLogo || existing.tokenLogo;
        existing.platform = group.platform || existing.platform;
        existing.tier = newTier;
        existing.isNew = true;
        updated = true;
        if (newTier > prevTier && newTier > highestTierFired) highestTierFired = newTier;
        setTimeout(() => { existing.isNew = false; renderAlerts(); }, 1500);
      } else {
        const alert = {
          token: group.token,
          mint: group.mint,
          chain: group.chain,
          tokenLogo: group.tokenLogo,
          platform: group.platform,
          walletCount: walletNames.length,
          effectiveCount,
          closedCount,
          wallets: walletDetails,
          mcap: group.mcap,
          tier: newTier,
          triggeredAt: Date.now(),
          isNew: true
        };
        alerts.unshift(alert);
        if (alerts.length > 30) alerts = alerts.slice(0, 30);
        triggered = true;
        if (newTier > highestTierFired) highestTierFired = newTier;
        setTimeout(() => { alert.isNew = false; renderAlerts(); }, 1500);
      }
    }

    if (triggered || updated) {
      renderAlerts();
      if (triggered || highestTierFired > 0) { playSound(highestTierFired || 1); flashBadge(); }
    }
  }

  // ===== 声音 =====
  let _audioCtx = null, _audioReady = false;
  function ensureAudioCtx() {
    if (_audioReady) return _audioCtx;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _audioReady = true;
      return _audioCtx;
    } catch (e) { return null; }
  }
  document.addEventListener('click', () => { if (!_audioReady) ensureAudioCtx(); }, { once: true, capture: true });

  function calcTier(walletCount) {
    if (!config.tieredAlerts) return 1;
    return Math.min(4, Math.max(1, walletCount - config.minWallets + 1));
  }

  function playBeepSeq(ctx, seq, baseGain) {
    for (const s of seq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = s.f;
      gain.gain.value = baseGain;
      osc.start(ctx.currentTime + s.t);
      osc.stop(ctx.currentTime + s.t + s.d);
    }
  }

  function playSound(tier) {
    if (!config.soundEnabled) return;
    if (document.visibilityState === 'hidden') return;
    const ctx = ensureAudioCtx();
    if (!ctx || ctx.state === 'suspended') return;
    tier = tier || 1;
    try {
      if (tier === 1) {
        playBeepSeq(ctx, [{ f: 880, t: 0, d: 0.1 }, { f: 880, t: 0.15, d: 0.1 }], 0.25);
      } else if (tier === 2) {
        playBeepSeq(ctx, [
          { f: 1000, t: 0, d: 0.08 },
          { f: 1000, t: 0.10, d: 0.08 },
          { f: 1000, t: 0.20, d: 0.08 }
        ], 0.27);
      } else if (tier === 3) {
        const seq = [];
        for (let i = 0; i < 5; i++) {
          seq.push({ f: 1100, t: i * 0.07, d: 0.06 });
          seq.push({ f: 1320, t: i * 0.07, d: 0.06 });
        }
        playBeepSeq(ctx, seq, 0.20);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.30, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        gain2.gain.setValueAtTime(0.10, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  }

  function flashBadge() {
    const badge = panelEl?.querySelector('.gcp-badge');
    if (!badge) return;
    badge.classList.add('is-active');
    setTimeout(() => badge.classList.remove('is-active'), 3000);
  }

  function pruneSpokenWatchedTradeKeys(now = Date.now()) {
    for (const [key, timestamp] of spokenWatchedTradeKeys.entries()) {
      if ((now - timestamp) > 5 * 60 * 1000) {
        spokenWatchedTradeKeys.delete(key);
      }
    }
  }

  function markWatchedTradeSpoken(key, now = Date.now()) {
    pruneSpokenWatchedTradeKeys(now);
    spokenWatchedTradeKeys.set(key, now);
  }

  function hasSpokenWatchedTradeRecently(key, now = Date.now()) {
    pruneSpokenWatchedTradeKeys(now);
    return spokenWatchedTradeKeys.has(key);
  }

  function queueWatchedTradeSpeech(trade) {
    const speechText = buildWatchedTradeSpeechText(trade);
    if (!speechText) return;
    watchedTradeSpeechQueue = watchedTradeSpeechQueue
      .then(() => playWatchedTradeSpeech(speechText))
      .catch(() => {});
  }

  async function playWatchedTradeSpeech(text) {
    if (!config.soundEnabled || !audioSettings.enabled || !audioSettings.ttsEnabled) return;
    if (document.visibilityState === 'hidden') return;
    if (isLockedByOtherTab) return;

    isLockedByOtherTab = true;
    setTimeout(() => { isLockedByOtherTab = false; }, AUDIO_LOCK_MS);
    if (audioSyncChannel) {
      try { audioSyncChannel.postMessage('PLAYING_AUDIO'); } catch (e) {}
    }

    try {
      const response = await fetch(TTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice: ttsSettings.voice,
          rate: ttsSettings.rate,
          pitch: ttsSettings.pitch
        })
      });

      if (!response.ok) {
        throw new Error(`TTS request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const audio = new Audio(objectUrl);
        audio.volume = Math.min(Math.max(audioSettings.volume, 0), 1);
        const playbackFinished = new Promise((resolve) => {
          audio.addEventListener('ended', resolve, { once: true });
          audio.addEventListener('error', resolve, { once: true });
        });
        await audio.play();
        await playbackFinished;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (e) {
      await fallbackNativeWatchedTradeTts(text);
    }
  }

  function fallbackNativeWatchedTradeTts(text) {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = speechSynthesisRateFromConfig(ttsSettings.rate);
        utterance.pitch = speechSynthesisPitchFromConfig(ttsSettings.pitch);
        utterance.volume = Math.min(Math.max(audioSettings.volume, 0), 1);
        utterance.addEventListener('end', resolve, { once: true });
        utterance.addEventListener('error', resolve, { once: true });
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        resolve();
      }
    });
  }

  // ===== 面板 =====
  function createPanel() {
    const el = document.createElement('div');
    el.className = 'gcp-inline' + (config.collapsed ? ' collapsed' : '');
    el.id = 'gcp-inline-panel';
    el.innerHTML = `
      <div class="gcp-header">
        <div class="gcp-header-left">
          <span class="gcp-toggle-arrow">▼</span>
          <span>🔥 聚合买入提醒</span>
          <span class="gcp-badge">0</span>
        </div>
        <div class="gcp-header-right">
          <button class="gcp-icon-btn gcp-tier-btn" title="${config.tieredAlerts ? '分级提醒：开（点击关闭）' : '分级提醒：关（点击开启）'}">${config.tieredAlerts ? '🔥' : '🌫️'}</button>
          <button class="gcp-icon-btn gcp-sound-btn" title="声音开关">🔔</button>
        </div>
      </div>
      <div class="gcp-settings">
        <label>≥ <input type="number" class="gcp-min-wallets" min="2" max="20" value="${config.minWallets}"> 钱包</label>
        <label>内 <input type="number" class="gcp-time-window" min="1" max="1440" value="${config.timeWindowMin}"> 分钟</label>
        <span class="gcp-status" title="数据状态：监听中">🔍 等待</span>
      </div>
      <div class="gcp-alerts"><div class="gcp-empty">监听中…等待信号</div></div>
      <button class="gcp-clear-btn">清空提醒</button>
      <span class="gcp-resize-handle gcp-resize-left" data-dir="left"></span>
      <span class="gcp-resize-handle gcp-resize-right" data-dir="right"></span>
      <span class="gcp-resize-handle gcp-resize-bottom" data-dir="bottom"></span>
      <span class="gcp-resize-handle gcp-resize-bottom-left" data-dir="bottom-left"></span>
      <span class="gcp-resize-handle gcp-resize-bottom-right" data-dir="bottom-right"></span>
    `;
    return el;
  }

  function bindPanelEvents() {
    if (!panelEl) return;
    panelEl.querySelector('.gcp-header').addEventListener('click', (e) => {
      if (panelEl.dataset.dragMoved === '1') {
        e.stopPropagation();
        e.preventDefault();
        panelEl.dataset.dragMoved = '0';
        return;
      }
      if (e.target.closest('.gcp-icon-btn')) return;
      panelEl.classList.toggle('collapsed');
      config.collapsed = panelEl.classList.contains('collapsed');
      saveConfig();
    });

    const soundBtn = panelEl.querySelector('.gcp-sound-btn');
    soundBtn.textContent = config.soundEnabled ? '🔔' : '🔕';
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      config.soundEnabled = !config.soundEnabled;
      soundBtn.textContent = config.soundEnabled ? '🔔' : '🔕';
      saveConfig();
    });

    const tierBtn = panelEl.querySelector('.gcp-tier-btn');
    if (tierBtn) {
      tierBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        config.tieredAlerts = !config.tieredAlerts;
        tierBtn.textContent = config.tieredAlerts ? '🔥' : '🌫️';
        tierBtn.title = config.tieredAlerts ? '分级提醒：开（点击关闭）' : '分级提醒：关（点击开启）';
        saveConfig();
        // 重算所有现有 alert 的 tier
        for (const a of alerts) a.tier = calcTier(a.walletCount);
        lastRenderState = '';
        renderAlerts();
      });
    }

    const minW = panelEl.querySelector('.gcp-min-wallets');
    minW.addEventListener('change', (e) => {
      config.minWallets = Math.max(2, parseInt(e.target.value) || 2);
      e.target.value = config.minWallets;
      saveConfig(); resetAndRescan();
    });
    minW.addEventListener('click', e => e.stopPropagation());

    const tw = panelEl.querySelector('.gcp-time-window');
    tw.addEventListener('change', (e) => {
      config.timeWindowMin = Math.max(1, parseInt(e.target.value) || 30);
      e.target.value = config.timeWindowMin;
      saveConfig(); resetAndRescan();
    });
    tw.addEventListener('click', e => e.stopPropagation());

    panelEl.querySelector('.gcp-settings').addEventListener('click', e => e.stopPropagation());
    panelEl.querySelector('.gcp-alerts').addEventListener('click', e => e.stopPropagation());
    panelEl.querySelector('.gcp-clear-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      alerts = []; renderAlerts();
    });
  }

  function resetAndRescan() {
    alerts = [];
    seenKeys.clear();
    seenClosedKeys.clear();
    buyRecords = [];
    closedRecords = [];
    schedulePublishSharedSnapshot();
    scanTrades(); renderAlerts();
  }

  let lastRenderState = '';
  function renderAlerts() {
    if (!panelEl) return;
    const container = panelEl.querySelector('.gcp-alerts');
    const badge = panelEl.querySelector('.gcp-badge');
    if (!container || !badge) return;
    badge.textContent = alerts.length;

    let html;
    if (alerts.length === 0) {
      html = '<div class="gcp-empty">监听中…等待信号</div>';
    } else {
      html = alerts.map(a => {
        const hasStar = isAlertStarred(a);
        const closedCount = a.closedCount || 0;
        const effective = (a.effectiveCount != null) ? a.effectiveCount : a.walletCount;
        const tier = a.tier || calcTier(effective);
        const tierIcon = tier >= 4 ? ' 🚨' : tier >= 3 ? ' 🔥' : tier >= 2 ? ' ⚡' : '';
        const logoImg = a.tokenLogo
          ? `<img class="gcp-token-logo" src="${escHtml(a.tokenLogo)}" loading="lazy" referrerpolicy="no-referrer" />`
          : '';
        const requiredWallets = hasStar ? 1 : config.minWallets;
        const isFaded = effective < requiredWallets;
        return `
        <div class="gcp-alert-item gcp-tier-${tier} ${a.isNew ? 'is-new' : ''} ${hasStar ? 'is-starred' : ''} ${isFaded ? 'is-faded' : ''}" data-token="${escHtml(a.token)}">
          <div class="gcp-alert-token">
            <span class="gcp-alert-token-name gcp-token-link" data-mint="${escHtml(a.mint || '')}" data-chain="${escHtml(a.chain || '')}" data-token="${escHtml(a.token)}" title="跳转到 ${escHtml(a.token)}">${logoImg}${escHtml(a.token)} ↗</span>${a.mint ? `<span class="gcp-mint-tag" title="合约：${escHtml(a.mint)}（点击复制）" data-mint="${escHtml(a.mint)}">${escHtml(shortMint(a.mint))}</span>` : ''}${a.platform ? `<span class="gcp-plat-badge ${escHtml(a.platform.cls)}" title="${escHtml(a.platform.label)}">${escHtml(a.platform.tag)}</span>` : ''}
            <span class="gcp-alert-count">${effective} 个钱包${closedCount > 0 ? ` <span class="gcp-closed-tag">−${closedCount} 清仓</span>` : ''}${tierIcon}</span>
          </div>
          <div class="gcp-alert-time">${a.mcap ? '市值 ' + escHtml(a.mcap) : ''}${a.chain ? ' · ' + escHtml(a.chain.toUpperCase()) : ''}</div>
          <div class="gcp-alert-wallets">
            ${a.wallets.map(w => {
              const star = starred.has(w.name);
              const blacklisted = isWalletBlacklisted(w.name);
              const av = w.avatar
                ? `<img class="gcp-wallet-avatar" src="${escHtml(w.avatar)}" loading="lazy" referrerpolicy="no-referrer" />`
                : '';
              return `
              <span class="gcp-alert-wallet-tag ${star ? 'is-starred' : ''} ${blacklisted ? 'is-blacklisted' : ''} ${w.closed ? 'is-closed' : ''}" title="${w.closed ? '已清仓' : ''}">
                <span class="gcp-watch-toggle ${star ? 'on' : ''}" data-wallet="${escHtml(w.name)}" title="${star ? '取消语音特别关注' : '加入语音特别关注'}">${star ? '★' : '☆'}</span>
                ${av}<span class="gcp-wallet-name">${escHtml(w.name)}</span>
                <span class="gcp-blacklist-toggle ${blacklisted ? 'on' : ''}" data-wallet="${escHtml(w.name)}" title="${blacklisted ? '移出黑名单钱包' : '加入黑名单钱包'}">!</span>
                <span class="gcp-wallet-amount">${escHtml(w.amount)}</span>
                ${w.timeAgo ? '<span style="color:#666">' + escHtml(w.timeAgo) + '前</span>' : ''}
              </span>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
    }

    if (html === lastRenderState) return;
    lastRenderState = html;
    container.innerHTML = html;

    container.querySelectorAll('.gcp-token-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToToken(el.dataset.token, el.dataset.mint, el.dataset.chain);
      });
    });
    container.querySelectorAll('.gcp-mint-tag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const fullMint = el.dataset.mint || '';
        try {
          navigator.clipboard.writeText(fullMint);
          const oldText = el.textContent;
          el.textContent = '已复制';
          setTimeout(() => { el.textContent = oldText; }, 1000);
        } catch (e2) {}
      });
    });
    container.querySelectorAll('.gcp-watch-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(el.dataset.wallet);
      });
    });
    container.querySelectorAll('.gcp-blacklist-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBlacklistWallet(el.dataset.wallet);
      });
    });
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ===== 跳转（页面内 SPA）=====
  function spaNavigate(url) {
    try {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      return true;
    } catch (e) { return false; }
  }

  function isMonitorWindowPage() {
    return FOLLOW_PATH_RE.test(location.pathname);
  }

  async function openPanelLinkInMainWindow(url) {
    if (!isMonitorWindowPage()) return false;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return false;
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'open-in-main-window',
        url
      });
      return !!(result && result.ok);
    } catch (e) {
      return false;
    }
  }

  async function jumpToToken(token, mint, chain) {
    // 策略 1（优先）：用 mint+chain 直接 SPA pushState，精准到 CA
    let useMint = mint, useChain = chain;
    if (!useMint || !useChain) {
      // 反查 tokenMeta（按 symbol，可能不准）
      for (const [k, v] of tokenMeta.entries()) {
        if (v.symbol === token) { useMint = useMint || k; useChain = useChain || v.chain; break; }
      }
    }
    if (useMint && useChain) {
      const url = `/${useChain}/token/${useMint}`;
      if (await openPanelLinkInMainWindow(location.origin + url)) return;
      if (spaNavigate(url)) return;
      window.location.href = location.origin + url;
      return;
    }

    // 策略 2（兜底）：没 mint 时找列表里 href 含同名的 <a>（很难精准，先试 mint match）
    const list = findVirtualList();
    if (list && mint) {
      const links = list.querySelectorAll('a');
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (href.includes(mint)) { a.click(); return; }
      }
    }
    alert('找不到 ' + token + ' 的跳转入口');
  }

  // ===== 注入星标按钮到原列表 =====
  function scheduleInjectStars() {
    if (injectStarsScheduled) return;
    injectStarsScheduled = true;
    setTimeout(() => {
      injectStarsScheduled = false;
      injectOrigStars();
    }, 250);
  }

  function injectOrigStars() {
    const all = findAllTrackingLists();
    for (const { list, isOnTracking } of all) {
      if (!isOnTracking) continue;
      injectStarsInList(list);
    }
  }
  function injectStarsInList(list) {
    const rowsRoot = list.children[0]?.children[0];
    if (!rowsRoot) return;
    for (const row of rowsRoot.children) {
      const walletEl = row.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
        || row.querySelector('[data-sentry-component="AutoTruncateText"]');
      if (!walletEl) continue;
      const wallet = walletEl.textContent.trim();
      const isStar = starred.has(wallet);
      const isBlacklisted = isWalletBlacklisted(wallet);

      row.classList.toggle('gcp-orig-starred', isStar);

      let starBtn = row.querySelector('.gcp-orig-star');
      if (!starBtn) {
        starBtn = document.createElement('span');
        starBtn.className = 'gcp-orig-star';
        starBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const w = (row.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]') || row.querySelector('[data-sentry-component="AutoTruncateText"]'))?.textContent.trim();
          if (w) toggleStar(w);
        });
        // 往上找最近的横向 flex 容器（避免插到 flex-col 父级导致换行撑高）
        let anchor = walletEl.parentElement;
        while (anchor && anchor !== row) {
          const cs = getComputedStyle(anchor);
          if (cs.display === 'flex' && cs.flexDirection !== 'column') break;
          anchor = anchor.parentElement;
        }
        if (!anchor || anchor === row) anchor = walletEl.parentElement;
        if (anchor) anchor.insertBefore(starBtn, anchor.firstChild);
      }
      starBtn.textContent = isStar ? '★' : '☆';
      starBtn.classList.toggle('on', isStar);
      starBtn.title = isStar ? '取消语音特别关注' : '加入语音特别关注';

      let blacklistBadge = row.querySelector('.gcp-orig-blacklist');
      if (isBlacklisted) {
        if (!blacklistBadge) {
          blacklistBadge = document.createElement('span');
          blacklistBadge.className = 'gcp-orig-blacklist';
          blacklistBadge.textContent = '!';
          blacklistBadge.title = '黑名单钱包';
          if (starBtn.parentElement) {
            starBtn.parentElement.insertBefore(blacklistBadge, starBtn.nextSibling);
          }
        }
      } else if (blacklistBadge) {
        blacklistBadge.remove();
      }
    }
  }

  // ===== 挂载面板 =====
/*
  function mountPanel() {
    if (!isMonitorWindowPage() || !document.body) return false;
    const mountedPanel = document.getElementById('gcp-inline-panel');
    if (mountedPanel) {
      panelEl = mountedPanel;
      return true;
    }
    if (!panelEl) {
      panelEl = createPanel();
      panelEl.classList.add('gcp-floating');
      restorePanelSize();
      try {
    // 恢复保存的位置
    try {
      const pos = JSON.parse(localStorage.getItem('gcp_pos') || '{}');
      if (pos.right != null) panelEl.style.right = pos.right + 'px';
      if (pos.top != null) panelEl.style.top = pos.top + 'px';
      } catch (e) {}
      bindPanelEvents();
      enableDrag();
      enableResize();
    }
    document.body.appendChild(panelEl);
    keepPanelInViewport();
    return true;
  }

*/
  function mountPanel() {
    if (!isMonitorWindowPage() || !document.body) return false;
    const mountedPanel = document.getElementById('gcp-inline-panel');
    if (mountedPanel) {
      panelEl = mountedPanel;
      return true;
    }
    if (!panelEl) {
      panelEl = createPanel();
      panelEl.classList.add('gcp-floating');
      restorePanelSize();
      try {
        const pos = JSON.parse(localStorage.getItem('gcp_pos') || '{}');
        if (pos.right != null) panelEl.style.right = pos.right + 'px';
        if (pos.top != null) panelEl.style.top = pos.top + 'px';
      } catch (e) {}
      bindPanelEvents();
      enableDrag();
      enableResize();
    }
    document.body.appendChild(panelEl);
    keepPanelInViewport();
    return true;
  }

  function keepPanelInViewport() {
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    const isOutOfView =
      rect.right < 40 ||
      rect.left > window.innerWidth - 40 ||
      rect.bottom < 40 ||
      rect.top > window.innerHeight - 40;
    if (!isOutOfView) return;

    panelEl.style.top = '80px';
    panelEl.style.right = '16px';
    try {
      localStorage.setItem('gcp_pos', JSON.stringify({ right: 16, top: 80 }));
    } catch (e) {}
  }

  // 拖拽
  function clampPanelSize(width, height) {
    const minWidth = 260;
    const minHeight = 180;
    const maxWidth = Math.max(minWidth, window.innerWidth - 20);
    const maxHeight = Math.max(minHeight, window.innerHeight - 20);
    return {
      width: Math.max(minWidth, Math.min(maxWidth, Math.round(width || 360))),
      height: Math.max(minHeight, Math.min(maxHeight, Math.round(height || 420)))
    };
  }

  function restorePanelSize() {
    if (!panelEl) return;
    try {
      const saved = JSON.parse(localStorage.getItem('gcp_size') || '{}');
      const size = clampPanelSize(saved.width, saved.height);
      if (saved.width != null) panelEl.style.width = size.width + 'px';
      if (saved.height != null) panelEl.style.height = size.height + 'px';
    } catch (e) {}
  }

  function savePanelSize() {
    if (!panelEl || panelEl.classList.contains('collapsed')) return;
    const rect = panelEl.getBoundingClientRect();
    const size = clampPanelSize(rect.width, rect.height);
    try {
      localStorage.setItem('gcp_size', JSON.stringify(size));
    } catch (e) {}
  }

  function enableDrag() {
    if (!panelEl) return;
    const header = panelEl.querySelector('.gcp-header');
    if (!header) return;
    let dragging = false, moved = false, sx = 0, sy = 0, startRight = 0, startTop = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.gcp-icon-btn')) return;
      dragging = true;
      moved = false;
      panelEl.dataset.dragMoved = '0';
      sx = e.clientX; sy = e.clientY;
      const r = panelEl.getBoundingClientRect();
      startRight = window.innerWidth - r.right;
      startTop = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        panelEl.dataset.dragMoved = '1';
      }
      const newRight = Math.max(0, Math.min(window.innerWidth - 100, startRight - dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 40, startTop + dy));
      panelEl.style.right = newRight + 'px';
      panelEl.style.top = newTop + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = panelEl.getBoundingClientRect();
      try {
        localStorage.setItem('gcp_pos', JSON.stringify({
          right: Math.round(window.innerWidth - r.right),
          top: Math.round(r.top)
        }));
      } catch (e) {}
      if (moved) {
        setTimeout(() => { if (panelEl) panelEl.dataset.dragMoved = '0'; }, 80);
      }
    });
  }

  function enableResize() {
    if (!panelEl) return;
    const handles = panelEl.querySelectorAll('.gcp-resize-handle');
    let state = null;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (panelEl.classList.contains('collapsed')) return;
        const rect = panelEl.getBoundingClientRect();
        state = {
          dir: handle.dataset.dir || '',
          sx: e.clientX,
          sy: e.clientY,
          left: rect.left,
          right: window.innerWidth - rect.right,
          width: rect.width,
          height: rect.height
        };
        panelEl.classList.add('is-resizing');
        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (!state) return;
      const dx = e.clientX - state.sx;
      const dy = e.clientY - state.sy;
      let width = state.width;
      let height = state.height;
      let right = state.right;

      if (state.dir.includes('left')) width = state.width - dx;
      if (state.dir.includes('right')) width = state.width + dx;
      if (state.dir.includes('bottom')) height = state.height + dy;

      const size = clampPanelSize(width, height);
      if (state.dir.includes('right')) {
        right = Math.max(0, window.innerWidth - state.left - size.width);
      }

      panelEl.style.width = size.width + 'px';
      panelEl.style.height = size.height + 'px';
      panelEl.style.right = right + 'px';
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (!state) return;
      state = null;
      panelEl.classList.remove('is-resizing');
      savePanelSize();
      const rect = panelEl.getBoundingClientRect();
      try {
        localStorage.setItem('gcp_pos', JSON.stringify({
          right: Math.round(window.innerWidth - rect.right),
          top: Math.round(rect.top)
        }));
      } catch (e) {}
    });
  }

  // ===== Observer =====
  let observers = [];
  function startObserver() {
    if (!followModeActive || !isMonitorWindowPage()) return false;
    const all = findAllTrackingLists();
    if (all.length === 0) return false;
    // 拆掉旧的
    observers.forEach(o => { try { o.disconnect(); } catch(e) {} });
    observers = [];
    // 给每个追踪面板一个 observer
    for (const { list } of all) {
      const ob = new MutationObserver(() => scanTrades());
      ob.observe(list, { childList: true, subtree: true });
      observers.push(ob);
    }
    // 兼容旧变量（有地方还在用 observer 判断）
    observer = observers[0] || null;
    if (scanInterval) clearInterval(scanInterval);
    scanInterval = setInterval(scanTrades, 5000);
    return true;
  }

  function stopObserver() {
    observers.forEach(o => { try { o.disconnect(); } catch(e) {} });
    observers = [];
    observer = null;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
  }

  function startMountWatcher() {
    if (mountCheckInterval) clearInterval(mountCheckInterval);
    mountCheckInterval = setInterval(() => {
      if (!isMonitorWindowPage()) {
        deactivateFollowMode();
        return;
      }
      // 浮窗独立存在：只要不在 DOM 里就重新挂
      if (!document.getElementById('gcp-inline-panel')) {
        if (mountPanel()) renderAlerts();
      }
      // 追踪列表数量变化时重启 observer（新增/移除面板）
      const all = findAllTrackingLists();
      if (all.length > 0 && observers.length !== all.length) {
        startObserver();
      } else if (all.length === 0 && observers.length > 0) {
        observers.forEach(o => { try { o.disconnect(); } catch(e) {} });
        observers = [];
        observer = null;
      }
    }, 2000);
  }

  // ===== 检查新版本 =====
  function stopMountWatcher() {
    if (mountCheckInterval) {
      clearInterval(mountCheckInterval);
      mountCheckInterval = null;
    }
  }

  function resetRuntimeState() {
    alerts = [];
    buyRecords = [];
    closedRecords = [];
    seenKeys.clear();
    seenClosedKeys.clear();
    spokenWatchedTradeKeys.clear();
    tokenMeta.clear();
    sharedSources = {};
    watchedTradesPrimed = false;
    watchedTradeSpeechQueue = Promise.resolve();
    lastScanInfo = {
      panelCount: 0,
      activeTrackingPanels: 0,
      rowCount: 0,
      panelsOff: 0,
      error: ''
    };
    lastRenderState = '';
  }

  function activateFollowMode() {
    if (!isMonitorWindowPage()) return false;
    followModeActive = true;
    if (!mountPanel()) {
      followModeActive = false;
      return false;
    }
    ensureAudioSyncChannel();
    warmupAlertAudio();
    renderAlerts();
    startSharedPoolSync();
    startObserver();
    scanTrades();
    startMountWatcher();
    checkForUpdate();
    return true;
  }

  function deactivateFollowMode() {
    if (!followModeActive && !document.getElementById('gcp-inline-panel')) return;
    followModeActive = false;
    stopMountWatcher();
    stopObserver();
    stopSharedPoolSync();
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    resetRuntimeState();
    if (panelEl && panelEl.isConnected) {
      panelEl.remove();
    }
    void removeSharedSnapshot();
  }

  function syncFollowMode() {
    if (isMonitorWindowPage()) {
      return activateFollowMode();
    }
    deactivateFollowMode();
    return false;
  }

  function installRouteWatcher() {
    if (routeWatcherInstalled) return;
    routeWatcherInstalled = true;

    const syncAfterNavigation = () => queueMicrotask(syncFollowMode);
    const nativePushState = history.pushState;
    const nativeReplaceState = history.replaceState;

    history.pushState = function patchedPushState(...args) {
      const result = nativePushState.apply(this, args);
      syncAfterNavigation();
      return result;
    };

    history.replaceState = function patchedReplaceState(...args) {
      const result = nativeReplaceState.apply(this, args);
      syncAfterNavigation();
      return result;
    };

    window.addEventListener('popstate', syncFollowMode);
    window.addEventListener('hashchange', syncFollowMode);
  }

  const REPO = '0xuezhang985/wallet-convergence-alert';
  function cmpVer(a, b) {
    const pa = a.split('.').map(n => parseInt(n) || 0);
    const pb = b.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  async function checkForUpdate() {
    try {
      const cacheRaw = localStorage.getItem('gcp_update_cache');
      const cache = cacheRaw ? JSON.parse(cacheRaw) : null;
      const now = Date.now();
      let latest = null;
      if (cache && cache.fetchedAt && (now - cache.fetchedAt) < 6 * 3600 * 1000) {
        latest = cache.tag;
      } else {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        if (!r.ok) return;
        const j = await r.json();
        latest = (j.tag_name || '').replace(/^v/, '');
        localStorage.setItem('gcp_update_cache', JSON.stringify({ tag: latest, fetchedAt: now }));
      }
      const cur = chrome.runtime.getManifest().version;
      if (latest && cmpVer(latest, cur) > 0) {
        showUpdateBanner(latest);
      }
    } catch (e) {}
  }

  function showUpdateBanner(latest) {
    if (!panelEl) return;
    if (panelEl.querySelector('.gcp-update-banner')) return;
    const b = document.createElement('div');
    b.className = 'gcp-update-banner';
    b.innerHTML = `🎉 新版 v${escHtml(latest)} 可用 — <a href="https://github.com/${REPO}/releases/latest" target="_blank" rel="noopener">点击下载</a> <span class="gcp-update-close" title="忽略本次提醒">×</span>`;
    panelEl.insertBefore(b, panelEl.firstChild);
    b.querySelector('.gcp-update-close').addEventListener('click', (e) => {
      e.stopPropagation();
      b.remove();
    });
  }

  // ===== 初始化 =====
  function init() {
    installRouteWatcher();
    ensureAudioSyncChannel();
    Promise.all([
      loadSpeechWatchlist(),
      loadBlacklistWallets(),
      loadAudioSettings(),
      loadTtsSettings()
    ]).catch(() => null).finally(() => {
      const tryInit = () => {
        if (syncFollowMode()) {
          return true;
        }
        return false;
      };
      if (tryInit()) return;
      const w = setInterval(() => { if (tryInit()) clearInterval(w); }, 1500);
      setTimeout(() => clearInterval(w), 60000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 调试
  window.__gcp = {
    config, alerts, buyRecords, tokenMeta, starred,
    sourceId,
    get audioSettings() { return audioSettings; },
    get speechWatchlist() { return speechWatchlist; },
    get sharedSources() { return sharedSources; },
    get combinedBuyRecords() { return getCombinedBuyRecords(); },
    rerender: () => { lastRenderState = ''; renderAlerts(); },
    rescan: () => scanTrades(),
    syncShared: () => loadSharedSnapshots({ recalculate: true })
  };
})();
