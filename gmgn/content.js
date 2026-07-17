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
    tieredAlerts: true,
    sortBy: 'walletCount',
    chainFilter: 'all'
  };
  const ALERT_SORT_OPTIONS = new Set(['walletCount', 'latest', 'mcap']);
  const ALERT_CHAIN_FILTER_OPTIONS = ['all', 'bsc', 'eth', 'base', 'sol', 'robinhood'];
  const HIDDEN_ALERTS_KEY = 'gcp_hidden_alerts_v1';
  const MAX_VISIBLE_ALERTS = 30;

  let config = { ...DEFAULT_CONFIG };
  let alerts = [];
  let hiddenAlertsByGroup = loadHiddenAlertsState();
  let buyRecords = [];
  let sellRecords = [];
  let closedRecords = [];
  let seenKeys = new Set();
  let seenSellKeys = new Set();
  let seenClosedKeys = new Set();
  let panelEl = null;
  let observer = null;
  let scanInterval = null;
  let mountCheckInterval = null;
  let injectStarsScheduled = false;
  const GMGN_SPEECH_WATCHLIST_KEY = 'gmgnSpeechWatchlist';
  const GMGN_FOCUS_ADDRESSES_KEY = 'gmgnFocusAddresses';
  const GMGN_BLACKLIST_WALLETS_KEY = 'gmgnBlacklistWallets';
  const GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
  const GET_MONITOR_SCREEN_STATUS_MESSAGE = 'get-monitor-screen-status';
  const MONITOR_STATE_STORAGE_KEY = 'monitorState';
  const DEFAULT_MAIN_SCREEN_RELAY_BASE_URL = 'https://market-watch.macmini.lan';
  const LEGACY_MAIN_SCREEN_RELAY_BASE_URL = 'http://127.0.0.1:17390';
  const FOCUS_ADDRESS_SYNC_INTERVAL_MS = 30000;
  let speechWatchlist = {};
  let focusAddresses = {};
  let blacklistWallets = new Set();
  let focusAddressSyncInterval = null;
  let focusAddressSyncInFlight = false;

  // 特别关注的钱包名
  let starred = new Set();

  // 代币元数据：mint → { chain, symbol, logo }
  const tokenMeta = new Map();

  const SHARED_STATE_KEY = 'gcp_gmgn_sources_v1';
  const SHARED_SOURCE_TTL_MS = 5 * 60 * 1000;
  const USE_MULTI_PAGE_SHARED_POOL = false;
  const canUseSharedStorage = typeof chrome !== 'undefined'
    && chrome.storage
    && chrome.storage.local;
  const sourceId = getSourceId();
  let sharedSources = {};
  let publishSharedTimer = null;
  let sharedRefreshInterval = null;
  let sharedPoolSyncStarted = false;
  let followModeActive = false;
  let monitorScreenActive = false;
  let routeWatcherInstalled = false;
  const GMGN_AUDIO_SETTINGS_KEY = 'gmgnAudioSettings';
  const AUDIO_SYNC_CHANNEL_NAME = 'gmgn_convergence_audio_sync_channel';
  const DISPATCH_GMGN_SIGNAL_EVENT_MESSAGE = 'dispatch-gmgn-signal-event';
  const TTS_STORAGE_KEYS = ['ttsVoice', 'ttsRate', 'ttsPitch', 'ttsApiUrl'];
  const AUDIO_LOCK_MS = 4500;
  const PRESET_AUDIO_OPTIONS = new Set(['default.MP3', 'preset1.MP3', 'elonmusk.MP3', 'CZ.MP3', 'heyi.MP3']);
  const CHAIN_DISPLAY = {
    sol: { label: 'SOL', cls: 'gcp-chain-sol' },
    eth: { label: 'ETH', cls: 'gcp-chain-eth' },
    bsc: { label: 'BSC', cls: 'gcp-chain-bsc' },
    base: { label: 'BASE', cls: 'gcp-chain-base' },
    robinhood: { label: 'RH', cls: 'gcp-chain-robinhood' },
    tron: { label: 'TRON', cls: 'gcp-chain-tron' },
    blast: { label: 'BLAST', cls: 'gcp-chain-blast' },
    unknown: { label: 'UNKNOWN', cls: 'gcp-chain-unknown' }
  };
  const AGGREGATE_DEBUG_PREFIX = '[GMGN Aggregate Debug]';
  const TRADE_ACTION_RE = /(清仓|加仓|建仓|减仓|买入|卖出)/;
  const DEFAULT_TTS_SETTINGS = {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: '+0%',
    pitch: '+0%',
    apiUrl: 'https://cloudflare-edge-tts.tech-melon.workers.dev/tts'
  };
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
  const MAX_AUDIO_VOLUME = 2;
  let audioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  let ttsSettings = { ...DEFAULT_TTS_SETTINGS };
  let preloadedAlertAudio = null;
  let audioSyncChannel = null;
  let isLockedByOtherTab = false;
  let watchedTradesPrimed = false;
  let watchedTradeSpeechQueue = Promise.resolve();
  const spokenWatchedTradeKeys = new Map();
  const WATCHED_TRADE_TTS_MAX_AGE_MS = 10 * 1000;
  const INFERRED_TRADE_TIME_TTL_MS = 2 * 60 * 60 * 1000;
  const inferredTradeTimeByKey = new Map();
  const SUPPORTED_GMGN_CHAINS = new Set(['sol', 'eth', 'bsc', 'bnb', 'base', 'tron', 'blast', 'robinhood']);
  const FOLLOW_PATH_RE = /^\/(?:follow(?:\/|$)|(?:sol|eth|bsc|base|tron|blast|robinhood)\/follow(?:\/|$))/i;
  const DEBOT_TRACK_MESSAGE_FLAG = '__gcpDebot';
  const DEBOT_TRACK_CHANNEL = 'wallet-track-transactions';
  const DEBOT_TRACK_API_PATH = '/api/wallet/track/transactions';
  const DEBOT_TRACK_CHAINS = ['solana', 'bsc', 'base', 'eth'];
  const DEBOT_API_FETCH_MIN_INTERVAL_MS = 5000;
  let debotApiFetchInFlight = false;
  let debotLastApiFetchAt = 0;
  let debotNetworkBridgeInstalled = false;
  let debotScanScheduled = false;
  const debotWalletNameByAddress = new Map();
  const debotTokenDomMetaByMint = new Map();

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
      walletAddress: r.walletAddress || '',
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
      inferredTime: !!r.inferredTime,
      tokenLogo: r.tokenLogo || '',
      href: r.href || '',
      platform: r.platform || null,
      stableKey: r.stableKey || '',
      sourceTradeId: r.sourceTradeId || '',
      identityConfidence: r.identityConfidence || ''
    };
  }

  function normalizeTradeKeyPart(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function buildStableTradeKey(parts) {
    const sourceTradeId = normalizeTradeKeyPart(parts.sourceTradeId || parts.txHash || parts.signature || '');
    const walletIdentity = normalizeTradeKeyPart(parts.walletAddress || parts.wallet).toLowerCase();
    const fallbackFingerprint = normalizeTradeKeyPart(parts.fingerprint || `${parts.action || ''}|${parts.amount || ''}`);
    return [
      normalizeTradeKeyPart(parts.chain).toLowerCase(),
      normalizeTradeKeyPart(parts.mint || parts.token).toLowerCase(),
      walletIdentity,
      sourceTradeId ? `source:${sourceTradeId}` : `row:${fallbackFingerprint}`
    ].join('|');
  }

  function extractTradeSourceId(row) {
    if (!row || !row.querySelectorAll) return '';
    const nodes = [row, ...row.querySelectorAll('[data-tx-hash],[data-transaction-hash],[data-signature],[data-trade-id],a[href]')];
    const attributes = ['data-tx-hash', 'data-transaction-hash', 'data-signature', 'data-trade-id'];
    for (const node of nodes) {
      for (const attribute of attributes) {
        const value = normalizeTradeKeyPart(node.getAttribute?.(attribute) || '');
        if (value.length >= 16) return value;
      }
      const href = String(node.getAttribute?.('href') || node.href || '').trim();
      if (!href) continue;
      try {
        const parsed = new URL(href, location.href);
        const pathMatch = parsed.pathname.match(/\/(?:tx|transaction)\/([^/?#]+)/i);
        const queryId = parsed.searchParams.get('tx_hash') || parsed.searchParams.get('txHash') || parsed.searchParams.get('signature');
        const value = normalizeTradeKeyPart(queryId || (pathMatch ? decodeURIComponent(pathMatch[1]) : ''));
        if (value.length >= 16) return value;
      } catch (_error) {}
    }
    return '';
  }

  function buildObservedTradeKey(parts) {
    return [
      normalizeTradeKeyPart(parts.chain),
      normalizeTradeKeyPart(parts.mint || parts.token),
      normalizeTradeKeyPart(parts.wallet),
      normalizeTradeKeyPart(parts.action),
      normalizeTradeKeyPart(parts.amount),
      normalizeTradeKeyPart(parts.fingerprint)
    ].join('|');
  }

  function normalizeTradeAgeText(value) {
    const text = String(value || '').replace(/\s+/g, '').trim();
    if (!text) return '';

    let match = text.match(/^(\d+)([smhd])$/i);
    if (match) {
      return `${match[1]}${match[2].toLowerCase()}`;
    }

    match = text.match(/^(\d+)(\u79d2|\u79d2\u949f)$/);
    if (match) return `${match[1]}s`;

    match = text.match(/^(\d+)(\u5206|\u5206\u949f)$/);
    if (match) return `${match[1]}m`;

    match = text.match(/^(\d+)(\u65f6|\u5c0f\u65f6)$/);
    if (match) return `${match[1]}h`;

    match = text.match(/^(\d+)(\u5929|\u65e5)$/);
    if (match) return `${match[1]}d`;

    return '';
  }

  function stripTrailingTradeAgeText(value) {
    const text = String(value || '').trim();
    const match = text.match(/(\d+\s*(?:[smhdSMHD]|\u79d2|\u79d2\u949f|\u5206|\u5206\u949f|\u65f6|\u5c0f\u65f6|\u5929|\u65e5))\s*$/);
    if (!match) {
      return { text, age: '' };
    }
    return {
      text: text.slice(0, match.index).trim(),
      age: normalizeTradeAgeText(match[1])
    };
  }

  function deriveStableTradeTimeMs(timeAgo, now = Date.now()) {
    const normalizedAge = normalizeTradeAgeText(timeAgo);
    const tm = normalizedAge.match(/^(\d+)([smhd])$/);
    if (!tm) return Math.round(now / 1000) * 1000;
    const value = parseInt(tm[1], 10);
    const unit = tm[2];
    if (!Number.isFinite(value) || value < 0) return Math.round(now / 1000) * 1000;

    const unitMs = unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

    return Math.round((now - (value * unitMs)) / unitMs) * unitMs;
  }

  function resolveTradeTimeInfo(timeAgo, observedKey, now = Date.now()) {
    const normalizedAge = normalizeTradeAgeText(timeAgo);
    if (normalizedAge) {
      return {
        timeAgo: normalizedAge,
        timeMs: deriveStableTradeTimeMs(normalizedAge, now),
        inferredTime: false
      };
    }

    const key = normalizeTradeKeyPart(observedKey);
    const roundedNow = Math.round(now / 1000) * 1000;
    if (!key) {
      return { timeAgo: '', timeMs: roundedNow, inferredTime: true };
    }

    const existing = inferredTradeTimeByKey.get(key);
    if (existing) {
      return { timeAgo: '', timeMs: existing, inferredTime: true };
    }

    inferredTradeTimeByKey.set(key, roundedNow);
    return { timeAgo: '', timeMs: roundedNow, inferredTime: true };
  }

  function pruneInferredTradeTimes(now = Date.now()) {
    for (const [key, timeMs] of inferredTradeTimeByKey.entries()) {
      if (!timeMs || (now - timeMs) > INFERRED_TRADE_TIME_TTL_MS) {
        inferredTradeTimeByKey.delete(key);
      }
    }
  }

  function normalizeChainName(value) {
    let normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'solana') normalized = 'sol';
    if (normalized === 'ethereum') normalized = 'eth';
    if (normalized === 'bnb' || normalized === 'binance' || normalized === 'binance-smart-chain') normalized = 'bsc';
    const compact = normalized.replace(/[\s_-]+/g, '');
    if (normalized === 'rh' || normalized === 'robin' || compact === 'robinhood' || compact === 'robinhoodchain') normalized = 'robinhood';
    if (!SUPPORTED_GMGN_CHAINS.has(normalized)) return '';
    return normalized;
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

      const followPrefixMatch = currentUrl.pathname.match(/^\/(sol|eth|bsc|bnb|base|tron|blast|robinhood)\/follow(?:\/|$)/i);
      if (followPrefixMatch) return normalizeChainName(followPrefixMatch[1]);

      const followSuffixMatch = currentUrl.pathname.match(/^\/follow\/(sol|eth|bsc|bnb|base|tron|blast|robinhood)(?:\/|$)/i);
      if (followSuffixMatch) return normalizeChainName(followSuffixMatch[1]);

      const pathMatch = currentUrl.pathname.match(/^\/(sol|eth|bsc|bnb|base|tron|blast|robinhood)(?:\/|$)/i);
      if (pathMatch) return normalizeChainName(pathMatch[1]);
    } catch (e) {}
    return '';
  }

  function parseGmgnTokenHref(rawHref) {
    const href = String(rawHref || '').trim();
    if (!href) return { href: '', chain: '', mint: '' };

    const pathMatch = href.match(/\/(sol|eth|bsc|bnb|base|tron|blast|robinhood)\/(token|profile)\/([1-9A-HJ-NP-Za-km-z]{32,}|0x[a-fA-F0-9]{40})/i);
    if (pathMatch) {
      const chain = normalizeChainName(pathMatch[1]);
      const routeType = String(pathMatch[2] || '').toLowerCase();
      if (routeType === 'profile' && chain !== 'sol') return { href, chain: '', mint: '' };
      return {
        href,
        chain,
        mint: pathMatch[3]
      };
    }

    try {
      const parsed = new URL(href, location.href);
      const queryMatch = parsed.pathname.match(/\/(token|profile)\/([1-9A-HJ-NP-Za-km-z]{32,}|0x[a-fA-F0-9]{40})/i);
      if (queryMatch) {
        const chain = normalizeChainName(parsed.searchParams.get('chain') || parsed.searchParams.get('network') || getLocationChainHint());
        const routeType = String(queryMatch[1] || '').toLowerCase();
        if (routeType === 'profile' && chain !== 'sol') return { href, chain: '', mint: '' };
        return {
          href,
          chain,
          mint: queryMatch[2]
        };
      }
    } catch (e) {}

    return { href, chain: '', mint: '' };
  }

  function normalizeFocusAddress(value) {
    return String(value || '').trim();
  }

  function normalizeFocusAddressKey(address) {
    const normalized = normalizeFocusAddress(address);
    return /^0x[a-f0-9]{40}$/i.test(normalized) ? normalized.toLowerCase() : normalized;
  }

  function buildFocusAddressKey(chain, address) {
    const normalizedChain = normalizeChainName(chain);
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

  function parseGmgnAddressHref(rawHref) {
    const href = String(rawHref || '').trim();
    if (!href) return { href: '', chain: '', address: '' };
    try {
      const parsed = new URL(href, location.href);
      if (!/(^|\.)gmgn\.ai$/i.test(parsed.hostname)) {
        return { href, chain: '', address: '' };
      }
      const parts = parsed.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
      let chain = '';
      let address = '';
      if (parts.length >= 3 && String(parts[1]).toLowerCase() === 'address') {
        chain = normalizeChainName(parts[0]);
        address = normalizeFocusAddress(parts[2]);
      } else if (parts.length >= 3 && String(parts[0]).toLowerCase() === 'address') {
        chain = normalizeChainName(parts[1]);
        address = normalizeFocusAddress(parts[2]);
      } else if (parts.length >= 2 && String(parts[0]).toLowerCase() === 'address') {
        chain = normalizeChainName(parsed.searchParams.get('chain') || parsed.searchParams.get('network') || getLocationChainHint());
        address = normalizeFocusAddress(parts[1]);
      }
      if (!chain || !isLikelyFocusAddress(address)) {
        return { href, chain: '', address: '' };
      }
      return { href, chain, address };
    } catch (_error) {
      return { href, chain: '', address: '' };
    }
  }

  function normalizeDebotTokenAddress(value) {
    const token = String(value || '').trim();
    const prefixed = token.match(/^\d+_(.+)$/);
    return prefixed ? prefixed[1] : token;
  }

  function parseDebotTokenHref(rawHref) {
    const href = String(rawHref || '').trim();
    if (!href) return { href: '', chain: '', mint: '' };

    try {
      const parsed = new URL(href, location.href);
      const tokenMatch = parsed.pathname.match(/\/token\/([^/]+)\/([^/?#]+)/i);
      if (!tokenMatch) return { href, chain: '', mint: '' };
      return {
        href,
        chain: normalizeChainName(tokenMatch[1]),
        mint: normalizeDebotTokenAddress(decodeURIComponent(tokenMatch[2] || ''))
      };
    } catch (e) {
      return { href, chain: '', mint: '' };
    }
  }

  function buildGmgnTokenPath(chain, mint) {
    const normalizedChain = normalizeChainName(chain);
    const tokenMint = String(mint || '').trim();
    if (!normalizedChain || !tokenMint) return '';
    return `/${normalizedChain}/token/${tokenMint}`;
  }

  function getExternalTokenChainSlug(chain, provider) {
    const normalizedChain = normalizeChainName(chain);
    if (!normalizedChain) return '';

    if (provider === 'fomo') {
      if (normalizedChain === 'sol') return 'solana';
      if (normalizedChain === 'bsc') return 'bnb';
      if (normalizedChain === 'eth') return 'ethereum';
      if (normalizedChain === 'base') return 'base';
      return '';
    }

    if (provider === 'debot') {
      if (normalizedChain === 'sol') return 'solana';
      if (normalizedChain === 'bsc') return 'bsc';
      if (normalizedChain === 'eth') return 'ethereum';
      if (normalizedChain === 'base') return 'base';
      return '';
    }

    return '';
  }

  function buildFomoTokenUrl(chain, mint) {
    const chainSlug = getExternalTokenChainSlug(chain, 'fomo');
    const tokenMint = String(mint || '').trim();
    if (!chainSlug || !tokenMint) return '';
    return `https://fomo.family/tokens/${chainSlug}/${encodeURIComponent(tokenMint)}`;
  }

  function buildDebotTokenUrl(chain, mint) {
    const chainSlug = getExternalTokenChainSlug(chain, 'debot');
    const tokenMint = String(mint || '').trim();
    if (!chainSlug || !tokenMint) return '';
    return `https://debot.ai/token/${chainSlug}/${encodeURIComponent(tokenMint)}`;
  }

  function renderTokenExternalLinks(alert) {
    const fomoUrl = buildFomoTokenUrl(alert?.chain, alert?.mint);
    const debotUrl = buildDebotTokenUrl(alert?.chain, alert?.mint);
    const links = [];

    if (fomoUrl) {
      links.push(`<a class="gcp-token-ext-link gcp-token-ext-link-fomo" href="${escHtml(fomoUrl)}" target="_blank" rel="noopener noreferrer" title="在 fomo.family 打开">Fomo</a>`);
    }
    if (debotUrl) {
      links.push(`<a class="gcp-token-ext-link gcp-token-ext-link-debot" href="${escHtml(debotUrl)}" target="_blank" rel="noopener noreferrer" title="在 Debot 打开">Debot</a>`);
    }

    return links.length ? `<span class="gcp-token-ext-links">${links.join('')}</span>` : '';
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
    if (!USE_MULTI_PAGE_SHARED_POOL || !canUseSharedStorage || publishSharedTimer) return;
    publishSharedTimer = setTimeout(() => {
      publishSharedTimer = null;
      publishSharedSnapshot();
    }, 250);
  }

  async function publishSharedSnapshot() {
    if (!USE_MULTI_PAGE_SHARED_POOL || !canUseSharedStorage) return;
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
        sells: sellRecords.slice(-300).map(stripTradeForStorage),
        closes: closedRecords.slice(-300).map(stripTradeForStorage)
      };
      sharedSources = sources;
      await chrome.storage.local.set({ [SHARED_STATE_KEY]: sources });
      updateStatus();
    } catch (e) {}
  }

  async function removeSharedSnapshot() {
    if (!USE_MULTI_PAGE_SHARED_POOL || !canUseSharedStorage) return;
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
    if (!USE_MULTI_PAGE_SHARED_POOL || !canUseSharedStorage) return;
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
    if (USE_MULTI_PAGE_SHARED_POOL && changes[SHARED_STATE_KEY]) {
      sharedSources = pruneSharedSources(changes[SHARED_STATE_KEY].newValue || {});
      cleanOldRecords();
      checkConvergence();
      updateStatus();
    }
    if (changes[GMGN_AUDIO_SETTINGS_KEY]) {
      audioSettings = normalizeAudioSettings(changes[GMGN_AUDIO_SETTINGS_KEY].newValue);
      warmupAlertAudio();
      updateFocusSpeechButtonState();
    }
    if (changes[GMGN_SPEECH_WATCHLIST_KEY]) {
      applySpeechWatchlist(changes[GMGN_SPEECH_WATCHLIST_KEY].newValue || {});
      lastRenderState = '';
      renderAlerts();
      injectOrigStars();
    }
    if (changes[GMGN_FOCUS_ADDRESSES_KEY]) {
      applyFocusAddresses(changes[GMGN_FOCUS_ADDRESSES_KEY].newValue || {});
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
    if (changes.ttsVoice || changes.ttsRate || changes.ttsPitch || changes.ttsApiUrl) {
      ttsSettings = normalizeTtsSettings({
        ttsVoice: changes.ttsVoice ? changes.ttsVoice.newValue : ttsSettings.voice,
        ttsRate: changes.ttsRate ? changes.ttsRate.newValue : ttsSettings.rate,
        ttsPitch: changes.ttsPitch ? changes.ttsPitch.newValue : ttsSettings.pitch,
        ttsApiUrl: changes.ttsApiUrl ? changes.ttsApiUrl.newValue : ttsSettings.apiUrl
      });
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'fomo-aggregate-alert' || !message.payload) return false;
    const result = ingestFomoAggregateAlert(message.payload);
    sendResponse(result);
    return false;
  });

  function ingestFomoAggregateAlert(payload) {
    const chain = normalizeChainName(payload.chain);
    const mint = String(payload.tokenAddress || '').trim();
    const token = String(payload.symbol || '').trim() || shortAddress(mint);
    const side = String(payload.side || '').toLowerCase();
    const traderCount = Math.max(1, Number(payload.traderCount || 1));
    const isTraderAlert = payload.alertKind === 'trader';
    const traderName = String(payload.traderHandle || payload.traderName || '').trim();
    if (!chain || !mint || !token || side !== 'buy') {
      return { ok: false, skipped: true };
    }
    const stableKey = String(payload.stableKey || [chain, mint.toLowerCase(), side, traderCount, payload.amountText, payload.marketCapText].join('|'));
    if (alerts.some((item) => item.externalStableKey === stableKey || (item.fomoSignals || []).some((signal) => signal.stableKey === stableKey))) {
      return { ok: true, duplicate: true };
    }
    const observedAt = Number(payload.observedAt || Date.now());
    const fomoSignal = {
      stableKey,
      traderCount,
      alertKind: isTraderAlert ? 'trader' : 'aggregate',
      traderName,
      traderAddress: String(payload.traderAddress || '').trim(),
      amountText: String(payload.amountText || ''),
      marketCapText: String(payload.marketCapText || ''),
      displayTime: String(payload.displayTime || ''),
      observedAt,
      url: String(payload.url || '')
    };
    const groupKey = getAlertGroupKey({ token, mint, chain });
    const existing = alerts.find((item) => getAlertGroupKey(item) === groupKey);
    if (existing) {
      existing.fomoSignals = [...(existing.fomoSignals || []), fomoSignal].slice(-5);
      existing.wallets = [
        ...(existing.wallets || []).filter((wallet) => !wallet.external),
        ...existing.fomoSignals.map((signal) => ({
          name: signal.alertKind === 'trader' ? `FOMO @${signal.traderName}` : `FOMO ${signal.traderCount} traders`,
          amount: signal.amountText,
          timeAgo: signal.displayTime,
          address: signal.traderAddress || '',
          external: true,
          stableKey: signal.stableKey
        }))
      ];
      existing.externalStableKey = stableKey;
      existing.externalSource = 'fomo';
      existing.latestTradeTimeMs = Math.max(Number(existing.latestTradeTimeMs || 0), observedAt);
      existing.updatedAt = Date.now();
      existing.isNew = true;
      renderAlerts();
      if (config.soundEnabled) { playSound(Math.max(existing.tier || 1, calcTier(traderCount)), chain); flashBadge(); }
      setTimeout(() => { existing.isNew = false; renderAlerts(); }, 1500);
      return { ok: true, merged: true };
    }
    const alert = {
      token,
      mint,
      chain,
      tokenLogo: '',
      platform: { tag: 'FOMO', label: 'FOMO Alert', cls: 'gcp-plat-fomo' },
      walletCount: 0,
      effectiveCount: 0,
      closedCount: 0,
      wallets: [{
        name: isTraderAlert ? `FOMO @${traderName}` : `FOMO ${traderCount} traders`,
        amount: String(payload.amountText || ''),
        timeAgo: String(payload.displayTime || ''),
        address: String(payload.traderAddress || ''),
        external: true
      }],
      mcap: String(payload.marketCapText || ''),
      latestTradeTimeMs: observedAt,
      tier: calcTier(traderCount),
      triggeredAt: Date.now(),
      updatedAt: Date.now(),
      isNew: true,
      externalSource: 'fomo',
      externalStableKey: stableKey,
      fomoSignals: [fomoSignal],
      sourceUrl: String(payload.url || '')
    };
    alerts.unshift(alert);
    pruneHiddenAlertsState();
    renderAlerts();
    if (config.soundEnabled) {
      playSound(alert.tier || 1, chain);
      flashBadge();
    }
    setTimeout(() => { alert.isNew = false; renderAlerts(); }, 1500);
    return { ok: true };
  }

  function startSharedPoolSync() {
    if (!canUseSharedStorage || sharedPoolSyncStarted) return;
    sharedPoolSyncStarted = true;
    chrome.storage.onChanged.addListener(handleSharedStorageChange);
    if (!USE_MULTI_PAGE_SHARED_POOL) return;
    loadSharedSnapshots({ recalculate: true });
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
    if (!USE_MULTI_PAGE_SHARED_POOL) return;
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
      ? Math.min(MAX_AUDIO_VOLUME, Math.max(0, volume))
      : DEFAULT_AUDIO_SETTINGS.volume;
    return settings;
  }

  function normalizeTtsSettings(raw) {
    return {
      voice: normalizeTtsVoice(raw && raw.ttsVoice),
      rate: normalizeTtsRate(raw && raw.ttsRate),
      pitch: normalizeTtsPitch(raw && raw.ttsPitch),
      apiUrl: normalizeTtsApiUrl(raw && raw.ttsApiUrl)
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

  function normalizeTtsApiUrl(value) {
    const rawUrl = String(value || '').trim();
    if (!rawUrl) return DEFAULT_TTS_SETTINGS.apiUrl;
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch (e) {}
    return DEFAULT_TTS_SETTINGS.apiUrl;
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

  function persistAudioSettings() {
    if (!canUseSharedStorage) return Promise.resolve();
    return chrome.storage.local.set({ [GMGN_AUDIO_SETTINGS_KEY]: audioSettings }).catch(() => {});
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
    const local = kind === 'closes'
      ? closedRecords
      : kind === 'sells'
        ? sellRecords
        : buyRecords;
    const combined = [];
    const seen = new Set();

    function addRecord(r, source) {
      if (!r || !r.timeMs || (now - r.timeMs) > windowMs) return;
      const key = `${kind}|${r.stableKey || buildStableTradeKey(r)}`;
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(r);
    }

    for (const r of local) addRecord(r, 'local');
    return combined;
  }

  function getCombinedBuyRecords() {
    return getCombinedRecords('buys');
  }

  function getCombinedSellRecords() {
    return getCombinedRecords('sells');
  }

  function getCombinedClosedRecords() {
    return getCombinedRecords('closes');
  }

  function getSharedChainSummary() {
    const counts = {};
    for (const r of getCombinedBuyRecords()) {
      const chain = getChainDisplay(r.chain).label;
      counts[chain] = (counts[chain] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chain, count]) => ({ chain, count }));
  }

  // 缩写合约
  function shortMint(m) {
    if (!m) return '';
    if (m.length <= 10) return m;
    return m.slice(0, 4) + '…' + m.slice(-4);
  }

  function getChainDisplay(chain) {
    const normalized = normalizeChainName(chain) || 'unknown';
    return CHAIN_DISPLAY[normalized] || CHAIN_DISPLAY.unknown;
  }

  function renderChainBadge(chain, extraText = '') {
    const meta = getChainDisplay(chain);
    const suffix = extraText ? ` ${escHtml(extraText)}` : '';
    return `<span class="gcp-chain-badge ${meta.cls}">${escHtml(meta.label)}${suffix}</span>`;
  }

  function getAggregateChainSoundProfile(chain) {
    const normalized = normalizeChainName(chain);
    if (normalized === 'bsc') return { key: 'bsc', label: 'BSC', scale: 1.0 };
    if (normalized === 'eth') return { key: 'eth', label: 'ETH', scale: 1.16 };
    if (normalized === 'base') return { key: 'base', label: 'BASE', scale: 1.3 };
    if (normalized === 'sol') return { key: 'sol', label: 'SOL', scale: 1.46 };
    if (normalized === 'robinhood') return { key: 'robinhood', label: 'RH', scale: 1.22 };
    return { key: normalized || 'default', label: getChainDisplay(chain).label, scale: 1.08 };
  }

  function chooseAggregateSoundCue(currentCue, nextCue) {
    if (!nextCue) return currentCue;
    if (!currentCue) return nextCue;
    if ((nextCue.tier || 0) !== (currentCue.tier || 0)) {
      return (nextCue.tier || 0) > (currentCue.tier || 0) ? nextCue : currentCue;
    }
    if ((nextCue.latestTradeTimeMs || 0) !== (currentCue.latestTradeTimeMs || 0)) {
      return (nextCue.latestTradeTimeMs || 0) > (currentCue.latestTradeTimeMs || 0) ? nextCue : currentCue;
    }
    return currentCue;
  }

  function scaleBeepSeq(seq, scale) {
    return seq.map((item) => ({
      ...item,
      f: Math.round(item.f * scale)
    }));
  }

  // ===== 检测代币发射平台 =====
  function detectPlatform(mint, chain, dexHint) {
    const m = (mint || '').toLowerCase();
    const c = (chain || '').toLowerCase();
    const d = (dexHint || '').toLowerCase();
    if (d.includes('robinhood')) return { tag: 'RH', label: 'Robinhood', cls: 'gcp-plat-robinhood' };
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
  if (!ALERT_SORT_OPTIONS.has(config.sortBy)) config.sortBy = DEFAULT_CONFIG.sortBy;
  if (!ALERT_CHAIN_FILTER_OPTIONS.includes(config.chainFilter)) config.chainFilter = DEFAULT_CONFIG.chainFilter;

  function saveConfig() {
    try { localStorage.setItem('gcp_config', JSON.stringify(config)); } catch (e) {}
  }

  function getDebugTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  function aggregateDebugLog(message, detail) {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    if (typeof detail !== 'undefined') {
      console.warn(`${AGGREGATE_DEBUG_PREFIX} ${getDebugTimestamp()} ${message}`, detail);
      return;
    }
    console.warn(`${AGGREGATE_DEBUG_PREFIX} ${getDebugTimestamp()} ${message}`);
  }

  const SCAN_DEBUG_LOG_INTERVAL_MS = 3000;
  let lastScanDebugLogAt = 0;

  function shouldLogScanDebug(force = false) {
    const now = Date.now();
    if (!force && (now - lastScanDebugLogAt) < SCAN_DEBUG_LOG_INTERVAL_MS) return false;
    lastScanDebugLogAt = now;
    return true;
  }

  function getElementClassText(element) {
    const className = element?.className;
    if (!className) return '';
    if (typeof className === 'string') return className;
    return String(className.baseVal || className.animVal || '');
  }

  function isExcludedTradeTextElement(element) {
    if (!element) return false;
    const tagName = String(element.tagName || element.nodeName || '').toLowerCase();
    if (['svg', 'use', 'symbol', 'path', 'title', 'desc'].includes(tagName)) {
      return true;
    }
    if (element.hidden || element.getAttribute?.('aria-hidden') === 'true') return true;
    const role = String(element.getAttribute?.('role') || '').toLowerCase();
    if (role === 'img' || role === 'presentation' || role === 'none') return true;
    const classText = getElementClassText(element);
    return /(^|[\s_-])(svg|icon|avatar|logo|sprite)([\s_-]|$)/i.test(classText);
  }

  function hasExcludedTradeTextAncestor(node, boundary) {
    let current = node?.parentElement || null;
    while (current && current !== boundary) {
      if (isExcludedTradeTextElement(current)) return true;
      current = current.parentElement;
    }
    return false;
  }

  function getTextExcludingSvg(node) {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);

    if (isExcludedTradeTextElement(node)) {
      return '';
    }

    const childNodes = Array.from(node.childNodes || []);
    if (childNodes.length) {
      return childNodes.map(getTextExcludingSvg).join('');
    }

    return String(node.textContent || '');
  }

  function compactDebugText(node, maxLen = 220) {
    const text = getTextExcludingSvg(node)
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
  }

  function getTrackingTabDebugTexts() {
    return Array.from(document.querySelectorAll('.pi-tabs-tab-btn'))
      .slice(0, 24)
      .map((tab, index) => ({
        index,
        text: compactDebugText(tab, 80),
        active: tab.classList.contains('pi-tabs-tab-btn-active')
          || tab.parentElement?.classList.contains('pi-tabs-tab-active')
      }));
  }

  function describeTrackingListsForDebug(lists) {
    return Array.from(lists || []).map((item, index) => {
      const list = item && item.list ? item.list : item;
      const rowsRoot = list?.children?.[0]?.children?.[0] || null;
      return {
        index,
        isOnTracking: !!(item && item.isOnTracking),
        listChildren: list?.children?.length || 0,
        firstChildChildren: list?.children?.[0]?.children?.length || 0,
        rowCount: rowsRoot?.children?.length || 0,
        text: compactDebugText(list, 180)
      };
    });
  }

  function describeTradeForDebug(trade) {
    return {
      wallet: trade?.wallet || '',
      walletAddress: trade?.walletAddress || '',
      action: trade?.action || '',
      isBuy: !!trade?.isBuy,
      token: trade?.token || '',
      amount: trade?.amount || '',
      chain: trade?.chain || '',
      mint: trade?.mint || '',
      timeAgo: trade?.timeAgo || '',
      inferredTime: !!trade?.inferredTime,
      mcap: trade?.mcap || ''
    };
  }

  function getTradeRowParseIssue(row) {
    if (!row || !row.querySelector) return 'row-not-element';
    const anchors = Array.from(row.querySelectorAll('a[href]'));
    if (!anchors.length) return 'missing-anchor';
    const a = anchors.find((anchor) => anchor.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]'))
      || anchors.find((anchor) => anchor.querySelector('[data-sentry-component="AutoTruncateText"]'))
      || anchors[0];
    if (!a) return 'missing-trade-anchor';
    const walletEl = a.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
      || a.querySelector('[data-sentry-component="AutoTruncateText"]');
    if (!walletEl || !getTextExcludingSvg(walletEl).trim()) {
      return extractFallbackWalletNameFromText(getTextExcludingSvg(row) || getTextExcludingSvg(a) || '')
        ? 'missing-wallet-selector'
        : 'missing-wallet';
    }
    if (!a.children[0] || !a.children[1]) return 'missing-line1-or-line2';
    if (!TRADE_ACTION_RE.test(getTextExcludingSvg(a.children[0]))) return 'missing-action';
    if (!compactDebugText(a.children[1], 80)) return 'missing-line2-text';
    return 'unknown';
  }

  function buildScanDebugSnapshot(extra = {}) {
    return {
      url: location.href,
      pathname: location.pathname,
      followModeActive,
      isMonitorWindowPage: isMonitorWindowPage(),
      virtualListCount: document.querySelectorAll('.virtual-list-container').length,
      tabTexts: getTrackingTabDebugTexts(),
      lastScanInfo: { ...lastScanInfo },
      records: {
        buys: buyRecords.length,
        sells: sellRecords.length,
        closes: closedRecords.length,
        alerts: alerts.length
      },
      ...extra
    };
  }

  const PAGE_DEBUG_REQUEST_TYPE = 'GCP_DEBUG_REQUEST';
  const PAGE_DEBUG_RESPONSE_TYPE = 'GCP_DEBUG_RESPONSE';
  let pageDebugBridgeInstalled = false;

  function getDebugRecordsSnapshot() {
    return {
      buys: getCombinedBuyRecords().slice(-20).map(describeTradeForDebug),
      sells: getCombinedSellRecords().slice(-20).map(describeTradeForDebug),
      closes: getCombinedClosedRecords().slice(-20).map(describeTradeForDebug),
      alerts: alerts.slice(0, 20).map((alert) => ({
        token: alert?.token || '',
        chain: alert?.chain || '',
        mint: alert?.mint || '',
        walletCount: alert?.walletCount || 0,
        effectiveCount: alert?.effectiveCount || 0,
        closedCount: alert?.closedCount || 0,
        mcap: alert?.mcap || '',
        latestTradeTimeMs: alert?.latestTradeTimeMs || 0
      }))
    };
  }

  function buildConvergenceDebugSnapshot() {
    const now = Date.now();
    const windowMs = config.timeWindowMin * 60 * 1000;
    const combinedBuyRecords = getCombinedBuyRecords();
    const combinedClosedRecords = getCombinedClosedRecords();
    const groups = {};
    let missingMint = 0;
    let missingGroupKey = 0;

    for (const r of combinedBuyRecords) {
      if (!r || !r.timeMs || (now - r.timeMs) > windowMs) continue;
      if (!r.mint) missingMint++;
      const key = buildAlertGroupKey(r);
      if (!key) {
        missingGroupKey++;
        continue;
      }
      if (!groups[key]) {
        groups[key] = {
          key,
          chain: r.chain || '',
          mint: r.mint || '',
          token: r.token || '',
          mcap: r.mcap || '',
          wallets: new Set(),
          latestTradeTimeMs: r.timeMs || 0
        };
      }
      const group = groups[key];
      if (r.wallet) group.wallets.add(r.wallet);
      if ((r.timeMs || 0) >= (group.latestTradeTimeMs || 0)) {
        group.latestTradeTimeMs = r.timeMs || group.latestTradeTimeMs || 0;
        if (r.token) group.token = r.token;
        if (r.mcap) group.mcap = r.mcap;
      }
    }

    const groupList = Object.values(groups)
      .map((group) => {
        const walletNames = Array.from(group.wallets);
        const closedCount = walletNames.filter((wallet) => combinedClosedRecords.some((closeRecord) =>
          closeRecord.wallet === wallet
          && (closeRecord.chain || '') === (group.chain || '')
          && ((group.mint && closeRecord.mint === group.mint)
            || (!group.mint && !closeRecord.mint && closeRecord.token === group.token))
        )).length;
        const effectiveCount = walletNames.length - closedCount;
        return {
          key: group.key,
          token: group.token,
          chain: group.chain,
          mint: group.mint,
          mcap: group.mcap,
          walletCount: walletNames.length,
          closedCount,
          effectiveCount,
          qualifies: walletNames.length >= config.minWallets || hasStarredWallet(walletNames),
          wallets: walletNames.slice(0, 8)
        };
      })
      .sort((a, b) => (b.effectiveCount - a.effectiveCount) || (b.walletCount - a.walletCount));

    return {
      config: {
        minWallets: config.minWallets,
        timeWindowMin: config.timeWindowMin,
        chainFilter: config.chainFilter,
        sortBy: config.sortBy
      },
      buyPool: combinedBuyRecords.length,
      closePool: combinedClosedRecords.length,
      missingMint,
      missingGroupKey,
      groupCount: groupList.length,
      qualifyingGroupCount: groupList.filter((group) => group.qualifies).length,
      alertCount: alerts.length,
      topGroups: groupList.slice(0, 20)
    };
  }

  function handlePageDebugCommand(command) {
    if (command === 'rescan') {
      scanTrades();
      const snapshot = buildScanDebugSnapshot({
        lists: describeTrackingListsForDebug(findAllTrackingLists())
      });
      aggregateDebugLog('page bridge rescan result.', snapshot);
      return snapshot;
    }
    if (command === 'dumpScanDebug') {
      const snapshot = buildScanDebugSnapshot({
        lists: describeTrackingListsForDebug(findAllTrackingLists())
      });
      aggregateDebugLog('manual scan debug snapshot.', snapshot);
      return snapshot;
    }
    if (command === 'lastScanInfo') {
      return { ...lastScanInfo };
    }
    if (command === 'records') {
      return getDebugRecordsSnapshot();
    }
    if (command === 'convergence') {
      return buildConvergenceDebugSnapshot();
    }
    throw new Error(`Unknown GMGN debug command: ${command}`);
  }

  function installPageDebugMessageBridge() {
    if (pageDebugBridgeInstalled) return;
    pageDebugBridgeInstalled = true;

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (!data || data.type !== PAGE_DEBUG_REQUEST_TYPE) return;
      let result = null;
      let error = '';
      try {
        result = handlePageDebugCommand(data.command);
      } catch (e) {
        error = e && e.message ? e.message : String(e);
        aggregateDebugLog('page bridge command failed.', {
          command: data.command,
          error
        });
      }
      window.postMessage({
        type: PAGE_DEBUG_RESPONSE_TYPE,
        id: data.id || '',
        command: data.command || '',
        result,
        error
      }, '*');
    });

    injectPageDebugConsoleHelper();
  }

  function installDebotNetworkMessageBridge() {
    if (debotNetworkBridgeInstalled) return;
    debotNetworkBridgeInstalled = true;
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (!data || data[DEBOT_TRACK_MESSAGE_FLAG] !== true) return;
      if (data.channel !== DEBOT_TRACK_CHANNEL) return;
      handleDebotTrackPayload(data.payload, data.payload?.source || 'network-hook');
    });
  }

  function injectPageDebugConsoleHelper() {
    if (!document.documentElement) return;
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        const REQ = '${PAGE_DEBUG_REQUEST_TYPE}';
        const RES = '${PAGE_DEBUG_RESPONSE_TYPE}';
        if (window.__gcp && window.__gcp.__pageBridge) return;
        let seq = 1;
        const pending = new Map();
        function send(command, args) {
          const id = 'gcp-debug-' + Date.now() + '-' + (seq++);
          const promise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(new Error('GMGN debug command timed out'));
            }, 5000);
            pending.set(id, { resolve, reject, timer });
          });
          window.postMessage({ type: REQ, id, command, args }, '*');
          return promise;
        }
        window.addEventListener('message', (event) => {
          if (event.source !== window) return;
          const data = event.data || {};
          if (data.type !== RES) return;
          const item = pending.get(data.id);
          if (!item) return;
          clearTimeout(item.timer);
          pending.delete(data.id);
          if (data.error) {
            item.reject(new Error(data.error));
            return;
          }
          item.resolve(data.result);
        });
        const api = {
          __pageBridge: true,
          lastScanInfo: null,
          rescan: async () => {
            const result = await send('rescan');
            api.lastScanInfo = result && result.lastScanInfo ? result.lastScanInfo : api.lastScanInfo;
            console.warn('[GMGN Aggregate Debug] page rescan result', result);
            return result;
          },
          dumpScanDebug: async () => {
            const result = await send('dumpScanDebug');
            api.lastScanInfo = result && result.lastScanInfo ? result.lastScanInfo : api.lastScanInfo;
            console.warn('[GMGN Aggregate Debug] page debug snapshot', result);
            return result;
          },
          getLastScanInfo: async () => {
            const result = await send('lastScanInfo');
            api.lastScanInfo = result;
            console.warn('[GMGN Aggregate Debug] page lastScanInfo', result);
            return result;
          },
          getRecords: async () => {
            const result = await send('records');
            console.warn('[GMGN Aggregate Debug] page records', result);
            return result;
          },
          getConvergence: async () => {
            const result = await send('convergence');
            console.warn('[GMGN Aggregate Debug] page convergence', result);
            return result;
          },
          help: () => {
            console.info('GMGN debug ready. Use: await window.__gcp.rescan(), await window.__gcp.dumpScanDebug(), await window.__gcp.getLastScanInfo(), await window.__gcp.getRecords(), await window.__gcp.getConvergence()');
          }
        };
        window.__gcp = api;
        api.help();
      })();
    `;
    try {
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      aggregateDebugLog('failed to inject page debug helper.', {
        error: e && e.message ? e.message : String(e)
      });
    }
  }

  function normalizeHiddenAlertsState(raw) {
    const next = {};
    for (const [key, value] of Object.entries(raw || {})) {
      const normalizedKey = String(key || '').trim();
      const latestTradeTimeMs = Number(value);
      if (!normalizedKey || !Number.isFinite(latestTradeTimeMs) || latestTradeTimeMs <= 0) continue;
      next[normalizedKey] = latestTradeTimeMs;
    }
    return next;
  }

  function loadHiddenAlertsState() {
    try {
      const saved = localStorage.getItem(HIDDEN_ALERTS_KEY);
      if (!saved) return {};
      return normalizeHiddenAlertsState(JSON.parse(saved));
    } catch (e) {
      return {};
    }
  }

  function saveHiddenAlertsState() {
    try {
      const next = normalizeHiddenAlertsState(hiddenAlertsByGroup);
      hiddenAlertsByGroup = next;
      if (Object.keys(next).length) {
        localStorage.setItem(HIDDEN_ALERTS_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(HIDDEN_ALERTS_KEY);
      }
    } catch (e) {}
  }

  function parseCompactDollarValue(value) {
    const raw = String(value || '').trim().replace(/^\$/, '');
    const match = raw.match(/^([\d.]+)\s*([KMB])?$/i);
    if (!match) return 0;
    const base = parseFloat(match[1]);
    if (!Number.isFinite(base)) return 0;
    const unit = (match[2] || '').toUpperCase();
    const multiplier = unit === 'B' ? 1e9 : unit === 'M' ? 1e6 : unit === 'K' ? 1e3 : 1;
    return base * multiplier;
  }

  function getAlertEffectiveCount(alert) {
    return alert && alert.effectiveCount != null ? alert.effectiveCount : (alert?.walletCount || 0);
  }

  function sortAlertsForDisplay(list) {
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (config.sortBy === 'mcap') {
        const mcapDiff = parseCompactDollarValue(b?.mcap) - parseCompactDollarValue(a?.mcap);
        if (mcapDiff !== 0) return mcapDiff;
      } else if (config.sortBy === 'latest') {
        const latestDiff = ((b?.latestTradeTimeMs || b?.triggeredAt) || 0) - ((a?.latestTradeTimeMs || a?.triggeredAt) || 0);
        if (latestDiff !== 0) return latestDiff;
      } else {
        const countDiff = getAlertEffectiveCount(b) - getAlertEffectiveCount(a);
        if (countDiff !== 0) return countDiff;
      }

      const tierDiff = (b?.tier || 0) - (a?.tier || 0);
      if (tierDiff !== 0) return tierDiff;

      const walletCountDiff = (b?.walletCount || 0) - (a?.walletCount || 0);
      if (walletCountDiff !== 0) return walletCountDiff;

      const mcapDiff = parseCompactDollarValue(b?.mcap) - parseCompactDollarValue(a?.mcap);
      if (mcapDiff !== 0) return mcapDiff;

      return ((b?.triggeredAt || 0)) - ((a?.triggeredAt || 0));
    });
    return sorted;
  }

  function dedupeTradeRecords(records) {
    const next = [];
    const seen = new Set();
    for (const record of records || []) {
      const key = record?.stableKey || buildStableTradeKey(record || {});
      if (!key || seen.has(key)) continue;
      seen.add(key);
      next.push(record);
    }
    return next;
  }

  function filterAlertsByChain(list) {
    if (config.chainFilter === 'all') return list;
    return list.filter((alert) => normalizeChainName(alert?.chain) === config.chainFilter);
  }

  function buildAlertGroupKey(parts) {
    const mintOrToken = normalizeTradeKeyPart(parts?.mint || parts?.token);
    if (!mintOrToken) return '';
    return `${normalizeChainName(parts?.chain) || 'unknown'}|${mintOrToken}`;
  }

  function getAlertGroupKey(alert) {
    return buildAlertGroupKey(alert || {});
  }

  function isAlertHidden(alert) {
    const groupKey = getAlertGroupKey(alert);
    if (!groupKey) return false;
    const hiddenAtTradeTime = hiddenAlertsByGroup[groupKey];
    if (!hiddenAtTradeTime) return false;
    return (alert?.latestTradeTimeMs || 0) <= hiddenAtTradeTime;
  }

  function releaseHiddenAlertIfNewBuy(groupKey, latestTradeTimeMs) {
    if (!groupKey) return false;
    const hiddenAtTradeTime = hiddenAlertsByGroup[groupKey];
    if (!hiddenAtTradeTime) return false;
    if ((latestTradeTimeMs || 0) <= hiddenAtTradeTime) return false;
    delete hiddenAlertsByGroup[groupKey];
    saveHiddenAlertsState();
    return true;
  }

  function pruneHiddenAlertsState() {
    const activeKeys = new Set(alerts.map(getAlertGroupKey).filter(Boolean));
    let changed = false;
    for (const key of Object.keys(hiddenAlertsByGroup)) {
      if (activeKeys.has(key)) continue;
      delete hiddenAlertsByGroup[key];
      changed = true;
    }
    if (changed) saveHiddenAlertsState();
  }

  function hideAlertUntilNextBuy(groupKey, latestTradeTimeMs) {
    if (!groupKey) return;
    hiddenAlertsByGroup[groupKey] = latestTradeTimeMs || Date.now();
    saveHiddenAlertsState();
    lastRenderState = '';
    renderAlerts();
  }
  function normalizeSpeechWatchlist(raw) {
    const next = {};
    for (const [walletName, meta] of Object.entries(raw || {})) {
      const normalizedWallet = normalizeSpeechWatchWallet(walletName);
      if (!normalizedWallet) continue;
      next[normalizedWallet] = {
        alias: typeof meta?.alias === 'string' ? meta.alias.trim() : '',
        focusPushEnabled: typeof meta?.focusPushEnabled === 'boolean'
          ? meta.focusPushEnabled
          : true
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

  function normalizeFocusAddressEntries(raw) {
    const next = {};
    const entries = Array.isArray(raw)
      ? raw
      : Object.values(raw || {});
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue;
      const chain = normalizeChainName(item.chain);
      const address = normalizeFocusAddress(item.address);
      const key = buildFocusAddressKey(chain, address);
      if (!key) continue;
      next[key] = {
        key,
        chain,
        address,
        addressKey: normalizeFocusAddressKey(address),
        alias: typeof item.alias === 'string' ? item.alias.trim() : '',
        name: typeof item.name === 'string' ? item.name.trim() : '',
        focusPushEnabled: typeof item.focusPushEnabled === 'boolean'
          ? item.focusPushEnabled
          : true,
        source: typeof item.source === 'string' ? item.source.trim() : '',
        sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl.trim() : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : ''
      };
    }
    return next;
  }

  function applyFocusAddresses(raw) {
    focusAddresses = normalizeFocusAddressEntries(raw);
  }

  function isLocalFocusAddressEntry(entry) {
    const source = String(entry?.source || '').trim().toLowerCase();
    return source === 'gmgn-monitor-address-page'
      || source === 'gmgn-address-page'
      || source === 'monitor-address-page'
      || source === 'manual';
  }

  function mergeRelayFocusAddressesWithLocal(relayItems) {
    const relayEntries = normalizeFocusAddressEntries(relayItems);
    for (const entry of Object.values(focusAddresses)) {
      if (!entry || !entry.key || !isLocalFocusAddressEntry(entry)) continue;
      relayEntries[entry.key] = entry;
    }
    return relayEntries;
  }

  async function loadFocusAddresses() {
    if (!canUseSharedStorage) {
      applyFocusAddresses({});
      return;
    }
    try {
      const stored = await chrome.storage.local.get(GMGN_FOCUS_ADDRESSES_KEY);
      applyFocusAddresses(stored[GMGN_FOCUS_ADDRESSES_KEY]);
    } catch (_error) {
      applyFocusAddresses({});
    }
  }

  function persistFocusAddresses() {
    if (!canUseSharedStorage) return Promise.resolve();
    return chrome.storage.local.set({ [GMGN_FOCUS_ADDRESSES_KEY]: focusAddresses }).catch(() => {});
  }

  function findFocusAddressKey(walletAddress, chain) {
    const key = buildFocusAddressKey(chain, walletAddress);
    return key && focusAddresses[key] ? key : '';
  }

  function getFocusWalletMatch(walletName, walletAddress, chain) {
    const nameKey = findSpeechWatchWalletKey(walletName);
    if (nameKey) {
      return {
        key: nameKey,
        type: 'name',
        meta: speechWatchlist[nameKey] || {}
      };
    }

    const addressKey = findFocusAddressKey(walletAddress, chain);
    if (addressKey) {
      return {
        key: addressKey,
        type: 'address',
        meta: focusAddresses[addressKey] || {}
      };
    }

    return null;
  }

  function findFocusWalletKey(walletName, walletAddress, chain) {
    return getFocusWalletMatch(walletName, walletAddress, chain)?.key || '';
  }

  function getFocusWalletAlias(walletName, walletAddress, chain) {
    const match = getFocusWalletMatch(walletName, walletAddress, chain);
    return match?.meta?.alias || match?.meta?.name || '';
  }

  function isFocusWalletPushEnabled(walletName, walletAddress, chain) {
    const match = getFocusWalletMatch(walletName, walletAddress, chain);
    if (!match) return false;
    return match.meta?.focusPushEnabled !== false;
  }

  function normalizeHttpBaseUrl(value, defaultValue = '') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return defaultValue;
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue) ? rawValue : `http://${rawValue}`;
    try {
      const url = new URL(withProtocol);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      url.pathname = url.pathname.replace(/\/+$/, '');
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch (_error) {
      return '';
    }
  }

  function buildRelayUrl(baseUrl, pathname) {
    try {
      const normalizedBaseUrl = normalizeHttpBaseUrl(baseUrl, DEFAULT_MAIN_SCREEN_RELAY_BASE_URL);
      if (!normalizedBaseUrl) return '';
      return new URL(pathname, `${normalizedBaseUrl}/`).toString();
    } catch (_error) {
      return '';
    }
  }

  async function getConfiguredRelayBaseUrl() {
    if (!canUseSharedStorage) return DEFAULT_MAIN_SCREEN_RELAY_BASE_URL;
    try {
      const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
      const settings = stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY] || {};
      const normalized = normalizeHttpBaseUrl(settings.mainScreenRelayBaseUrl, DEFAULT_MAIN_SCREEN_RELAY_BASE_URL);
      return normalized === LEGACY_MAIN_SCREEN_RELAY_BASE_URL
        ? DEFAULT_MAIN_SCREEN_RELAY_BASE_URL
        : normalized;
    } catch (_error) {
      return DEFAULT_MAIN_SCREEN_RELAY_BASE_URL;
    }
  }

  async function syncFocusAddressesFromRelay() {
    if (!canUseSharedStorage || focusAddressSyncInFlight) return;
    focusAddressSyncInFlight = true;
    try {
      const relayBaseUrl = await getConfiguredRelayBaseUrl();
      const requestUrl = buildRelayUrl(relayBaseUrl, '/focus-addresses');
      if (!requestUrl) return;
      const response = await fetch(requestUrl, { method: 'GET', cache: 'no-store' });
      if (!response.ok) return;
      const body = await response.json().catch(() => null);
      if (!body?.ok || !Array.isArray(body.items)) return;
      focusAddresses = mergeRelayFocusAddressesWithLocal(body.items);
      await persistFocusAddresses();
      lastRenderState = '';
      renderAlerts();
      injectOrigStars();
    } catch (_error) {
      // Relay is optional; keep the last cached focus address list.
    } finally {
      focusAddressSyncInFlight = false;
    }
  }

  function startFocusAddressSync() {
    if (!canUseSharedStorage || focusAddressSyncInterval) return;
    void syncFocusAddressesFromRelay();
    focusAddressSyncInterval = setInterval(() => {
      if (!document.hidden) {
        void syncFocusAddressesFromRelay();
      }
    }, FOCUS_ADDRESS_SYNC_INTERVAL_MS);
  }

  function normalizeSpeechWatchWallet(value) {
    return String(value || '').trim();
  }

  function sanitizeSpeechName(value) {
    if (value == null) return '';
    return String(value)
      .replace(/[\u200B-\u200D\uFE0E\uFE0F\u20E3]/g, '')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\p{Extended_Pictographic}+/gu, ' ')
      .replace(/[★☆◆◇●○■□▲△▼▽◉◎◌◍•·▪▫◦※]/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,，.。:：;；\-—_~|/\\]+|[\s,，.。:：;；\-—_~|/\\]+$/g, '')
      .trim();
  }

  function normalizeWalletMatchName(value) {
    return sanitizeSpeechName(value).toLowerCase();
  }

  function findSpeechWatchWalletKey(walletName) {
    const exact = normalizeSpeechWatchWallet(walletName);
    if (exact && starred.has(exact)) return exact;

    const normalized = normalizeWalletMatchName(walletName);
    if (!normalized) return '';
    for (const key of starred) {
      if (normalizeWalletMatchName(key) === normalized) return key;
    }
    return '';
  }

  function getSpeechWatchAlias(walletName, walletAddress = '', chain = '') {
    const matchedWallet = findSpeechWatchWalletKey(walletName) || normalizeSpeechWatchWallet(walletName);
    return speechWatchlist[matchedWallet]?.alias || getFocusWalletAlias(walletName, walletAddress, chain) || '';
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
    const existingWallet = findSpeechWatchWalletKey(normalizedWallet);
    if (existingWallet) {
      delete speechWatchlist[existingWallet];
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
    return a.wallets && a.wallets.some(w => !!findFocusWalletKey(w.name, w.address, a.chain));
  }

  function isTradeStarred(trade) {
    return !!(trade && findFocusWalletKey(trade.wallet, trade.walletAddress, trade.chain));
  }

  function isWalletBlacklisted(walletName) {
    return !!(walletName && blacklistWallets.has(walletName));
  }

  function hasStarredWallet(wallets, chain = '') {
    return Array.isArray(wallets) && wallets.some((wallet) => {
      if (wallet && typeof wallet === 'object') {
        return !!findFocusWalletKey(wallet.name, wallet.address, chain || wallet.chain);
      }
      return !!findFocusWalletKey(wallet, '', chain);
    });
  }

  function isBuyAction(action) {
    return /(\u52a0\u4ed3|\u5efa\u4ed3|\u4e70\u5165|\bbuy\b|\bopen\b|\badd\b)/i.test(action || '');
  }

  function isCloseAction(action) {
    return /(\u6e05\u4ed3|\bclose\b)/i.test(action || '');
  }

  function isSellAction(action) {
    return /(\u51cf\u4ed3|\u5356\u51fa|\u6e05\u4ed3|\bsell\b|\breduce\b|\bclose\b)/i.test(action || '');
  }

  function normalizeWatchedTradeVerb(trade) {
    const action = trade && trade.action ? trade.action : '';
    if (/清仓/.test(action)) return '清仓了';
    if (/建仓/.test(action)) return '建仓了';
    if (/(减仓|卖出)/.test(action)) return '卖出了';
    if (/(加仓|买入)/.test(action) || trade.isBuy) return '买入了';
    return '操作了';
  }

  function getWatchedTradeQuoteAsset(chain) {
    const normalized = normalizeChainName(chain);
    if (normalized === 'bsc' || normalized === 'bnb') return 'BNB';
    if (normalized === 'base') return 'baseETH';
    if (normalized === 'blast') return 'blastETH';
    if (normalized === 'eth') return 'ETH';
    if (normalized === 'sol') return 'SOL';
    if (normalized === 'tron') return 'TRX';
    return '';
  }

  function normalizeTradeEventAction(value) {
    const action = String(value || '').trim();
    if (/\bopen\b|建仓/i.test(action)) return 'open';
    if (/\badd\b|加仓/i.test(action)) return 'add';
    if (/\bbuy\b|买入/i.test(action)) return 'buy';
    if (/\breduce\b|减仓/i.test(action)) return 'reduce';
    if (/\bsell\b|卖出/i.test(action)) return 'sell';
    if (/\bclose\b|清仓/i.test(action)) return 'close';
    return '';
  }

  function getTradeEventActionLabel(action) {
    if (action === 'open') return '建仓';
    if (action === 'add') return '加仓';
    if (action === 'buy') return '买入';
    if (action === 'reduce') return '减仓';
    if (action === 'sell') return '卖出';
    if (action === 'close') return '清仓';
    return '';
  }

  function getSignalEventSource() {
    return isDebotMonitorWindowPage() ? 'debot' : 'gmgn';
  }

  function normalizeSignalEventMcap(value) {
    return String(value || '').trim().replace(/^[\$￥]\s*/, '');
  }

  function buildSignalEventUrl(rawUrl, chain, mint) {
    const href = String(rawUrl || '').trim();
    if (href) {
      try {
        return new URL(href, location.origin).href;
      } catch (e) {}
    }

    const debotUrl = isDebotMonitorWindowPage() ? buildDebotTokenUrl(chain, mint) : '';
    if (debotUrl) {
      return debotUrl;
    }

    const path = buildGmgnTokenPath(chain, mint);
    if (path) {
      try {
        return new URL(path, location.origin).href;
      } catch (e) {}
    }

    return location.href;
  }

  function buildSignalWalletPayload(walletName, walletAddress = '', chain = '') {
    const name = String(walletName || '').trim();
    const address = normalizeFocusAddress(walletAddress);
    const focusMatch = getFocusWalletMatch(name, address, chain);
    const alias = focusMatch
      ? (focusMatch.meta?.alias || focusMatch.meta?.name || '')
      : (typeof getSpeechWatchAlias === 'function' ? (getSpeechWatchAlias(name, address, chain) || '') : '');
    const payload = {
      name,
      address,
      remark: alias
    };
    if (focusMatch) {
      payload.focusKey = focusMatch.key || '';
      payload.focusType = focusMatch.type || '';
      payload.isFocus = true;
      payload.focusPushEnabled = focusMatch.meta?.focusPushEnabled !== false;
    }
    return payload;
  }

  function buildWalletTradeEventText(trade, action, walletPayload, amountUnit) {
    const walletName = walletPayload.remark || walletPayload.name || '关注钱包';
    const actionLabel = getTradeEventActionLabel(action) || String(trade?.action || '').trim() || '操作';
    const amount = String(trade?.amount || '').trim();
    const token = String(trade?.token || '').trim() || shortAddress(trade?.mint || '') || '这个代币';
    const assetText = [amount, amountUnit, token].filter(Boolean).join(' ') || token;
    return `${walletName} ${actionLabel} ${assetText}`.trim();
  }

  function buildWalletTradeSignalEvent(trade) {
    if (!trade) return null;
    const action = normalizeTradeEventAction(trade.action || '');
    const chain = normalizeChainName(trade.chain);
    const ca = String(trade.mint || '').trim();
    const symbol = String(trade.token || '').trim();
    if (!action || !chain || !ca || !symbol) return null;

    const wallet = buildSignalWalletPayload(trade.wallet, trade.walletAddress, chain);
    const amount = String(trade.amount || '').trim();
    const amountUnit = amount ? getWatchedTradeQuoteAsset(chain) : '';
    const raw = {
      from: `${getSignalEventSource()}-extension`,
      stable_key: trade.stableKey || '',
      trade_id: trade.stableKey || '',
      identity_confidence: trade.identityConfidence || (trade.sourceTradeId ? 'exact' : 'heuristic'),
      inferred_time: !!trade.inferredTime,
      original_action: String(trade.action || '').trim()
    };
    if (wallet.isFocus === true) {
      raw.focus_wallet_hit = wallet.focusPushEnabled !== false;
      raw.focus_wallet_key = wallet.focusKey || '';
      raw.focus_wallet_type = wallet.focusType || '';
      raw.focus_wallet_alias = wallet.remark || '';
    }

    return {
      schemaVersion: 2,
      tradeId: trade.stableKey || '',
      identityConfidence: trade.identityConfidence || (trade.sourceTradeId ? 'exact' : 'heuristic'),
      source: getSignalEventSource(),
      type: 'wallet_trade',
      ts: trade.timeMs || Date.now(),
      chain,
      ca,
      symbol,
      token_name: symbol,
      wallet,
      action,
      amount,
      amount_unit: amountUnit,
      mcap: normalizeSignalEventMcap(trade.mcap),
      text: buildWalletTradeEventText(trade, action, wallet, amountUnit),
      url: buildSignalEventUrl(trade.href, chain, ca),
      raw
    };
  }

  function buildConvergenceAlertSignalEvent(alert, extra = {}) {
    if (!alert) return null;
    const chain = normalizeChainName(alert.chain);
    const ca = String(alert.mint || '').trim();
    const symbol = String(alert.token || '').trim();
    if (!chain || !ca || !symbol) return null;

    const focusWallets = Array.isArray(alert.wallets)
      ? alert.wallets
          .map((wallet) => {
            const name = String(wallet?.name || '').trim();
            const address = normalizeFocusAddress(wallet?.address || '');
            const focusMatch = getFocusWalletMatch(name, address, chain);
            if (!focusMatch) return null;
            if (focusMatch.meta?.focusPushEnabled === false) return null;
            return {
              name,
              address,
              focusKey: focusMatch.key || '',
              focusType: focusMatch.type || '',
              alias: focusMatch.meta?.alias || focusMatch.meta?.name || ''
            };
          })
          .filter(Boolean)
      : [];
    const effectiveCount = Number(alert.effectiveCount || alert.walletCount || 0);
    const closedCount = Number(alert.closedCount || 0);
    return {
      schemaVersion: 2,
      source: getSignalEventSource(),
      type: 'convergence_alert',
      ts: alert.latestTradeTimeMs || alert.updatedAt || Date.now(),
      chain,
      ca,
      symbol,
      image: String(alert.tokenLogo || '').trim(),
      action: 'alert',
      mcap: normalizeSignalEventMcap(alert.mcap),
      text: `${symbol} ${effectiveCount} 个关注钱包聚合买入`,
      url: buildSignalEventUrl('', chain, ca),
      raw: {
        buy_wallet_count: effectiveCount,
        sell_wallet_count: closedCount,
        closed_wallet_count: closedCount,
        wallet_count: Number(alert.walletCount || effectiveCount),
        threshold: Number.isFinite(Number(extra.requiredWallets)) ? Number(extra.requiredWallets) : config.minWallets,
        priority_wallet_hit: extra.hasPriorityWallet === true,
        focus_wallet_hit: focusWallets.length > 0,
        focus_wallets: focusWallets,
        group_key: getAlertGroupKey(alert),
        record_kind: 'aggregate_snapshot',
        wallets: Array.isArray(alert.wallets)
          ? alert.wallets.map((wallet) => ({
              name: String(wallet?.name || '').trim(),
              address: normalizeFocusAddress(wallet?.address || ''),
              amount: String(wallet?.amount || '').trim(),
              timeAgo: String(wallet?.timeAgo || '').trim(),
              timeMs: Number(wallet?.timeMs || 0),
              avatar: String(wallet?.avatar || '').trim(),
              closed: wallet?.closed === true,
              closedAt: Number(wallet?.closedAt || 0)
            })).filter((wallet) => wallet.name || wallet.address)
          : []
      }
    };
  }

  async function dispatchSignalEvent(payload) {
    if (!payload) return;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
      const result = await chrome.runtime.sendMessage({
        type: DISPATCH_GMGN_SIGNAL_EVENT_MESSAGE,
        payload
      });
      if (!result || result.ok || result.skipped) return;
      if (shouldLogScanDebug()) {
        aggregateDebugLog('signal event dispatch failed.', {
          eventType: payload.type,
          status: result.status,
          error: result.error || result.statusText || ''
        });
      }
    } catch (error) {
      if (shouldLogScanDebug()) {
        aggregateDebugLog('signal event dispatch exception.', {
          eventType: payload.type,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
  }

  function isCurrencyAmountText(value) {
    return /^[\$￥]\s*[\d.,]+(?:[KMBkmb])?$/i.test(String(value || '').trim());
  }

  function buildWatchedTradeSpeechText(trade) {
    const rawWalletName = (trade && trade.wallet) ? trade.wallet.trim() : '';
    const walletName = sanitizeSpeechName(getSpeechWatchAlias(rawWalletName, trade && trade.walletAddress, trade && trade.chain))
      || sanitizeSpeechName(rawWalletName)
      || '关注钱包';
    const verb = normalizeWatchedTradeVerb(trade);
    const amountText = trade && trade.amount ? String(trade.amount).trim() : '';
    const quoteAsset = isCurrencyAmountText(amountText) ? '' : getWatchedTradeQuoteAsset(trade && trade.chain);
    const tokenText = trade && trade.token ? String(trade.token).trim() : '';
    const assetText = [amountText, quoteAsset, tokenText].filter(Boolean).join(' ') || tokenText || '这个代币';
    const mcapText = normalizeSignalEventMcap(trade && trade.mcap);
    const mcapSpeech = mcapText ? `，市值 ${mcapText}` : '';
    return `${walletName}，${verb} ${assetText}${mcapSpeech}`;
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
    if (!trade.timeMs) return false;
    const ageMs = now - trade.timeMs;
    if (secondsMatch) {
      const ageSeconds = Number(secondsMatch[1]);
      if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > 10) return false;
      return ageMs >= 0 && ageMs <= WATCHED_TRADE_TTS_MAX_AGE_MS;
    }
    if (trade.inferredTime && !trade.timeAgo) {
      return ageMs >= 0 && ageMs <= WATCHED_TRADE_TTS_MAX_AGE_MS;
    }
    return false;
  }

  function flushWatchedTradeAnnouncements(trades) {
    if (!Array.isArray(trades) || trades.length === 0) return;
    const now = Date.now();
    const skippedSamples = [];
    for (const trade of trades) {
      if (!isRecentEnoughForWatchedTradeSpeech(trade, now)) {
        if (skippedSamples.length < 5) {
          skippedSamples.push({
            ...describeTradeForDebug(trade),
            ageMs: trade && trade.timeMs ? now - trade.timeMs : null
          });
        }
        continue;
      }
      const speechKey = buildWatchedTradeSpeechKey(trade);
      if (hasSpokenWatchedTradeRecently(speechKey, now)) continue;
      markWatchedTradeSpoken(speechKey, now);
      aggregateDebugLog('watched trade queued for TTS.', {
        ...describeTradeForDebug(trade),
        speechKey,
        ageMs: now - trade.timeMs
      });
      queueWatchedTradeSpeech(trade);
    }
    if (skippedSamples.length && shouldLogScanDebug()) {
      aggregateDebugLog('watched trade skipped by recency gate.', {
        maxAgeMs: WATCHED_TRADE_TTS_MAX_AGE_MS,
        samples: skippedSamples
      });
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

  function extractLine2Segments(line2, tradeAge) {
    const normalizedTradeAge = normalizeTradeAgeText(tradeAge);
    const segments = [];
    let sawMarketCap = false;

    if (typeof document !== 'undefined' && document.createTreeWalker) {
      const walker = document.createTreeWalker(line2, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if (hasExcludedTradeTextAncestor(textNode, line2)) {
          textNode = walker.nextNode();
          continue;
        }
        const rawText = textNode.textContent || '';
        const text = rawText.replace(/\s+/g, ' ').trim();
        if (!text) {
          textNode = walker.nextNode();
          continue;
        }
        if (/^MC\b/i.test(text) || /^MC[:\s]*[\$￥]?[\d.]+[KMBkmb]?$/i.test(text)) {
          sawMarketCap = true;
          break;
        }
        if (sawMarketCap) break;
        const normalizedSegmentAge = normalizeTradeAgeText(text);
        if ((normalizedTradeAge && normalizedSegmentAge === normalizedTradeAge) || normalizedSegmentAge) {
          textNode = walker.nextNode();
          continue;
        }
        if (segments[segments.length - 1] !== text) {
          segments.push(text);
        }
        textNode = walker.nextNode();
      }
    }

    if (segments.length) {
      return segments;
    }

    for (const child of Array.from(line2.children || [])) {
      if (!child || child.tagName === 'IMG' || isExcludedTradeTextElement(child)) continue;
      const text = getTextExcludingSvg(child).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (/^MC\b/i.test(text) || /^MC[:\s]*[\$￥]?[\d.]+[KMBkmb]?$/i.test(text)) break;
      const normalizedSegmentAge = normalizeTradeAgeText(text);
      if ((normalizedTradeAge && normalizedSegmentAge === normalizedTradeAge) || normalizedSegmentAge) continue;
      if (segments[segments.length - 1] !== text) {
        segments.push(text);
      }
    }
    return segments;
  }

  // ===== 解析单条 trade =====
  function stripDuplicateShortTokenPrefix(tokenSymbol) {
    const text = String(tokenSymbol || '').replace(/\s+/g, ' ').trim();
    const parts = text.split(' ').filter(Boolean);
    if (parts.length < 2) return text;

    const [first, second] = parts;
    if (
      /^[a-z]{1,4}$/i.test(first)
      && second.length > first.length
      && second.toLowerCase().startsWith(first.toLowerCase())
    ) {
      return parts.slice(1).join(' ');
    }

    return text;
  }

  function stripInlineSvgPrefixTokenText(tokenSymbol, line2) {
    const text = String(tokenSymbol || '').trim();
    if (!text) return text;
    if (!line2 || !line2.querySelectorAll) return stripDuplicateShortTokenPrefix(text);
    const svgTexts = Array.from(line2.querySelectorAll('svg'))
      .map((svg) => (svg.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    for (const svgText of svgTexts) {
      if (!text.startsWith(svgText + ' ')) continue;
      const stripped = text.slice(svgText.length).trim();
      if (stripped) return stripDuplicateShortTokenPrefix(stripped);
    }
    return stripDuplicateShortTokenPrefix(text);
  }

  function normalizeTradeAmountText(value) {
    const text = String(value || '').replace(/\s+/g, '').trim();
    if (!text) return '';
    if (/^[\$￥]?\d[\d.,]*(?:[KMBkmb])?$/.test(text)) {
      return text;
    }
    return '';
  }

  function splitTradeAmountAndToken(headPart) {
    const text = String(headPart || '').trim();
    if (!text) {
      return { amount: '', tokenSymbol: '' };
    }

    const currencyPrefixMatch = text.match(/^((?:[\$￥]\s*)\d[\d.,]*(?:[KMBkmb])?)\s*(.+)$/);
    if (currencyPrefixMatch) {
      return {
        amount: normalizeTradeAmountText(currencyPrefixMatch[1]),
        tokenSymbol: currencyPrefixMatch[2].trim()
      };
    }

    const spacedAmountMatch = text.match(/^(\d[\d.,]*(?:[KMBkmb])?)\s+(.+)$/);
    if (spacedAmountMatch) {
      return {
        amount: normalizeTradeAmountText(spacedAmountMatch[1]),
        tokenSymbol: spacedAmountMatch[2].trim()
      };
    }

    return { amount: '', tokenSymbol: text };
  }

  function splitCompactAmountAndToken(headPart) {
    const text = String(headPart || '').trim();
    if (!text) return { amount: '', tokenSymbol: '' };

    const compactMatch = text.match(/^((?:[\$￥]\s*)?\d[\d.,]*)(.+)$/);
    if (!compactMatch) return { amount: '', tokenSymbol: text };
    return {
      amount: normalizeTradeAmountText(compactMatch[1]),
      tokenSymbol: compactMatch[2].trim()
    };
  }

  function sanitizeFallbackWalletName(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[☆★\s]+/, '')
      .trim();
  }

  function extractFallbackWalletNameFromText(text) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    const actionMatch = source.match(TRADE_ACTION_RE);
    if (!actionMatch) return '';
    return sanitizeFallbackWalletName(source.slice(0, actionMatch.index));
  }

  function stripLeadingActionMeta(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[+\-−]?\s*\d+(?:\.\d+)?%\s*/, '')
      .trim();
  }

  function parseTradeRowFromText(row, baseInfo = {}) {
    const fullText = compactDebugText(row, 1000);
    if (!fullText) return null;

    const mcMatch = fullText.match(/\bMC\b[:\s]*[\$￥]?([\d.]+[KMBkmb]?)/);
    const mcap = mcMatch ? '$' + mcMatch[1] : '';
    const beforeMcap = mcMatch ? fullText.slice(0, fullText.indexOf(mcMatch[0])).trim() : fullText;
    const actionMatch = beforeMcap.match(TRADE_ACTION_RE);
    if (!actionMatch) return null;

    const wallet = sanitizeFallbackWalletName(beforeMcap.slice(0, actionMatch.index));
    if (!wallet) return null;

    const action = actionMatch[1];
    const isBuy = isBuyAction(action);
    let tail = stripLeadingActionMeta(beforeMcap.slice(actionMatch.index + action.length));

    let timeAgo = '';
    const leadingAge = tail.match(/^(\d+\s*(?:[smhdSMHD]|\u79d2|\u79d2\u949f|\u5206|\u5206\u949f|\u65f6|\u5c0f\u65f6|\u5929|\u65e5))\s*/);
    if (leadingAge) {
      timeAgo = normalizeTradeAgeText(leadingAge[1]);
      tail = tail.slice(leadingAge[0].length).trim();
    }

    const strippedTail = stripTrailingTradeAgeText(tail);
    const tradeAge = strippedTail.age;
    const headPart = strippedTail.text;

    let parsedHead = splitTradeAmountAndToken(headPart);
    if (!parsedHead.amount && parsedHead.tokenSymbol === headPart) {
      parsedHead = splitCompactAmountAndToken(headPart);
    }

    const amount = parsedHead.amount || '';
    const tokenSymbol = stripInlineSvgPrefixTokenText(parsedHead.tokenSymbol || headPart, row);
    if (!tokenSymbol) return null;

    const chain = baseInfo.chain || getLocationChainHint();
    const mint = baseInfo.mint || '';
    const href = baseInfo.href || '';
    const walletAddress = normalizeFocusAddress(baseInfo.walletAddress || '');
    const platform = detectPlatform(mint, chain, '');
    const stableFingerprint = `${action}|${headPart}`;
    const sourceTradeId = extractTradeSourceId(row);
    const observedKey = buildObservedTradeKey({
      chain,
      mint,
      token: tokenSymbol,
      wallet,
      action,
      amount,
      fingerprint: stableFingerprint
    });
    const timeInfo = resolveTradeTimeInfo(timeAgo, observedKey);
    const walletAvatar = row.querySelector('img')?.src || '';
    let tokenLogo = '';
    row.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (!tokenLogo && !src.includes('/icons/icon_')) tokenLogo = src;
    });

    if (mint) {
      const existing = tokenMeta.get(mint) || {};
      tokenMeta.set(mint, {
        chain: chain || existing.chain,
        symbol: tokenSymbol || existing.symbol,
        logo: tokenLogo || existing.logo
      });
    }

    return {
      wallet,
      walletAddress,
      walletAvatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint,
      chain,
      amount,
      mcap,
      timeAgo: timeInfo.timeAgo,
      tradeAge,
      timeMs: timeInfo.timeMs,
      inferredTime: timeInfo.inferredTime,
      tokenLogo,
      href,
      platform,
      sourceTradeId,
      identityConfidence: sourceTradeId ? 'exact' : 'heuristic',
      stableKey: buildStableTradeKey({
        chain,
        mint,
        token: tokenSymbol,
        wallet,
        walletAddress,
        action,
        amount,
        fingerprint: stableFingerprint,
        sourceTradeId
      })
    };
  }

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
    const walletLink = anchors
      .map((anchor) => parseGmgnAddressHref(anchor.getAttribute('href') || anchor.href || ''))
      .find((candidate) => candidate.address && (!chain || !candidate.chain || candidate.chain === chain))
      || { address: '' };
    const walletAddress = walletLink.address || '';
    const fallbackInfo = { href, chain, mint, walletAddress };

    // 钱包名：第一个 .text-yellow-100 的 AutoTruncateText
    const walletEl = a.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
      || a.querySelector('[data-sentry-component="AutoTruncateText"]');
    const wallet = walletEl
      ? getTextExcludingSvg(walletEl).trim()
      : extractFallbackWalletNameFromText(getTextExcludingSvg(row) || getTextExcludingSvg(a) || '');
    if (!wallet) return parseTradeRowFromText(row, fallbackInfo);

    // 第一行：动作 + 涨跌 + 时间
    const line1 = a.children[0];
    const line2 = a.children[1];
    if (!line1 || !line2) return parseTradeRowFromText(row, fallbackInfo);

    // 动作：含 清仓/加仓/建仓/减仓/买入/卖出
    let action = '';
    let isBuy = false;
    line1.querySelectorAll('.whitespace-nowrap').forEach(el => {
      const t = getTextExcludingSvg(el).trim();
      if (!action && TRADE_ACTION_RE.test(t)) action = t;
    });
    if (!action) {
      const actionMatch = getTextExcludingSvg(line1).replace(/\s+/g, ' ').match(TRADE_ACTION_RE);
      if (actionMatch) action = actionMatch[1];
    }
    if (isBuyAction(action)) isBuy = true;

    // 时间："2h" / "5m" / "3d"
    const timeEls = line1.querySelectorAll('.text-text-300.inline');
    let timeAgo = '';
    timeEls.forEach(el => {
      const t = getTextExcludingSvg(el).trim();
      const normalizedAge = normalizeTradeAgeText(t);
      if (normalizedAge) timeAgo = normalizedAge;
    });
    if (!timeAgo) {
      // 兜底：line1 里找 \d+[smhd] 模式
      const txt = getTextExcludingSvg(line1).replace(/\s+/g, ' ');
      const tm = txt.match(/(\d+)\s*([smhdSMHD]|\u79d2|\u79d2\u949f|\u5206|\u5206\u949f|\u65f6|\u5c0f\u65f6|\u5929|\u65e5)(?=\s|$)/);
      if (tm) timeAgo = normalizeTradeAgeText(tm[0]);
    }
    const line1StableText = getTextExcludingSvg(line1)
      .replace(/\s+/g, ' ')
      .replace(/(\d+)\s*([smhdSMHD]|\u79d2|\u79d2\u949f|\u5206|\u5206\u949f|\u65f6|\u5c0f\u65f6|\u5929|\u65e5)(?=\s|$)/g, '')
      .trim();

    // line2: <amount><tokenSymbol><tradeAge> MC:$<mcap>
    const line2Text = getTextExcludingSvg(line2).replace(/\s+/g, ' ').trim();
    // 拆 MC:
    // 只匹配独立的 "MC" 字段，避免把 "CMC 18m" 里的 "MC 18m" 误识别成市值。
    const mcMatch = line2Text.match(/\bMC\b[:\s]*[\$￥]?([\d.]+[KMBkmb]?)/);
    const mcap = mcMatch ? '$' + mcMatch[1] : '';
    let headPart = mcMatch ? line2Text.substring(0, line2Text.indexOf(mcMatch[0])).trim() : line2Text;
    // **先剥掉末尾的时间** (\d+[smhd]) — 否则会被当成 token 名的一部分
    let tradeAge = '';
    const strippedHeadPart = stripTrailingTradeAgeText(headPart);
    tradeAge = strippedHeadPart.age;
    headPart = strippedHeadPart.text;
    const line2Segments = extractLine2Segments(line2, tradeAge);

    // headPart 现在只剩 "<amount><tokenSymbol>"
    let amount = '', tokenSymbol = '';
    const firstSegmentAmount = normalizeTradeAmountText(line2Segments[0]);
    if (line2Segments.length >= 2 && firstSegmentAmount) {
      amount = firstSegmentAmount;
      tokenSymbol = line2Segments.slice(1).join(' ').trim();
    } else {
      const parsedHead = splitTradeAmountAndToken(headPart);
      amount = parsedHead.amount;
      tokenSymbol = parsedHead.tokenSymbol;
    }
    if (!tokenSymbol) {
      amount = '';
      tokenSymbol = headPart;
    }

    tokenSymbol = stripInlineSvgPrefixTokenText(tokenSymbol, line2);
    const platform = detectPlatform(mint, chain, '');
    const stableFingerprint = `${action}|${line1StableText}|${headPart}`;
    const sourceTradeId = extractTradeSourceId(row);
    const observedKey = buildObservedTradeKey({
      chain,
      mint,
      token: tokenSymbol,
      wallet,
      action,
      amount,
      fingerprint: stableFingerprint
    });
    const timeInfo = resolveTradeTimeInfo(timeAgo, observedKey);

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

    return {
      wallet,
      walletAddress,
      walletAvatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint,
      chain,
      amount,
      mcap,
      timeAgo: timeInfo.timeAgo,
      tradeAge,
      timeMs: timeInfo.timeMs,
      inferredTime: timeInfo.inferredTime,
      tokenLogo,
      href,
      platform,
      sourceTradeId,
      identityConfidence: sourceTradeId ? 'exact' : 'heuristic',
      stableKey: buildStableTradeKey({
        chain,
        mint,
        token: tokenSymbol,
        wallet,
        walletAddress,
        action,
        amount,
        fingerprint: stableFingerprint,
        sourceTradeId
      })
    };
  }

  // ===== 扫描列表 =====
  // 诊断信息（status 指示用）
  let lastScanInfo = {
    panelCount: 0,
    activeTrackingPanels: 0,
    rowCount: 0,
    parsedRows: 0,
    parseMisses: 0,
    parseErrors: 0,
    rowsRootMissing: 0,
    duplicateSkips: 0,
    unclassifiedActions: 0,
    added: 0,
    panelsOff: 0,            // 在非追踪 tab 的面板
    error: ''
  };

  function isDebotHost() {
    return /(^|\.)debot\.ai$/i.test(location.hostname || '');
  }

  function isDebotMonitorWindowPage() {
    return isDebotHost() && !/^\/likwid(?:\/|$)/i.test(location.pathname || '');
  }

  function getDebotRequestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `gcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function buildDebotTrackTransactionsUrl() {
    const params = new URLSearchParams();
    params.set('request_id', getDebotRequestId());
    params.set('next', '');
    DEBOT_TRACK_CHAINS.forEach((chain) => params.append('chains', chain));
    params.append('op', 'buy');
    params.append('op', 'sell');
    return `${DEBOT_TRACK_API_PATH}?${params.toString()}`;
  }

  function normalizeDebotAddress(value) {
    const address = String(value || '').trim();
    if (/^0x[a-f0-9]{40}$/i.test(address)) return address.toLowerCase();
    return address;
  }

  function shortAddress(value) {
    const address = String(value || '').trim();
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  function rememberDebotWallet(address, info = {}) {
    const key = normalizeDebotAddress(address);
    if (!key) return;
    const existing = debotWalletNameByAddress.get(key) || {};
    debotWalletNameByAddress.set(key, {
      ...existing,
      ...info,
      name: info.name || existing.name || shortAddress(key)
    });
  }

  function rememberDebotToken(mint, info = {}) {
    const key = normalizeDebotTokenAddress(mint);
    if (!key) return;
    const existing = debotTokenDomMetaByMint.get(key) || {};
    debotTokenDomMetaByMint.set(key, {
      ...existing,
      ...info
    });
  }

  function normalizeDebotTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric > 1e12 ? Math.round(numeric) : Math.round(numeric * 1000);
  }

  function parseDebotDateTime(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return 0;
    const now = new Date();
    const year = now.getFullYear();
    const date = new Date(
      year,
      Number(match[1]) - 1,
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5] || 0)
    );
    const timeMs = date.getTime();
    if (!Number.isFinite(timeMs)) return 0;
    if (timeMs - now.getTime() > 24 * 60 * 60 * 1000) {
      date.setFullYear(year - 1);
      return date.getTime();
    }
    return timeMs;
  }

  function formatTradeAgeFromTimeMs(timeMs, now = Date.now()) {
    const ageMs = Math.max(0, now - (timeMs || now));
    if (ageMs < 60 * 1000) return `${Math.max(0, Math.round(ageMs / 1000))}s`;
    if (ageMs < 60 * 60 * 1000) return `${Math.floor(ageMs / (60 * 1000))}m`;
    if (ageMs < 24 * 60 * 60 * 1000) return `${Math.floor(ageMs / (60 * 60 * 1000))}h`;
    return `${Math.floor(ageMs / (24 * 60 * 60 * 1000))}d`;
  }

  function formatDebotAmount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return '';
    const abs = Math.abs(numeric);
    if (abs >= 100) return String(Math.round(abs * 100) / 100);
    if (abs >= 1) return String(Math.round(abs * 1000) / 1000);
    return String(Math.round(abs * 1000000) / 1000000).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatUsdCompact(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    const units = [
      { suffix: 'B', value: 1e9 },
      { suffix: 'M', value: 1e6 },
      { suffix: 'K', value: 1e3 }
    ];
    for (const unit of units) {
      if (numeric >= unit.value) {
        const scaled = numeric / unit.value;
        return `$${scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10}${unit.suffix}`;
      }
    }
    return `$${Math.round(numeric * 100) / 100}`;
  }

  function getDebotActionLabel(rowOrAction) {
    const row = rowOrAction && typeof rowOrAction === 'object' ? rowOrAction : {};
    const action = typeof rowOrAction === 'string' ? rowOrAction : (row.position_action || row.op || '');
    const normalized = String(action || '').toLowerCase();
    if (normalized === 'open') return '\u5efa\u4ed3';
    if (normalized === 'add') return '\u52a0\u4ed3';
    if (normalized === 'reduce') return '\u51cf\u4ed3';
    if (normalized === 'close') return '\u6e05\u4ed3';
    if (normalized === 'buy') return '\u4e70\u5165';
    if (normalized === 'sell') return '\u5356\u51fa';
    return String(action || '');
  }

  function findDebotNestedWalletInfo(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.alias || value.remark || value.twitter_name || value.twitter_handle || value.avatar_url) {
      return value;
    }
    for (const nested of Object.values(value)) {
      const found = findDebotNestedWalletInfo(nested);
      if (found) return found;
    }
    return null;
  }

  function getDebotWalletMeta(walletMeta, address) {
    const key = normalizeDebotAddress(address);
    if (!key || !walletMeta || typeof walletMeta !== 'object') return null;
    const direct = walletMeta[key] || walletMeta[address];
    const directInfo = findDebotNestedWalletInfo(direct);
    if (directInfo) return directInfo;

    for (const [candidateAddress, candidateInfo] of Object.entries(walletMeta)) {
      if (normalizeDebotAddress(candidateAddress) !== key) continue;
      return findDebotNestedWalletInfo(candidateInfo);
    }
    return null;
  }

  function getDebotWalletDisplay(row, meta) {
    const address = row?.trader || row?.from || row?.to || '';
    const key = normalizeDebotAddress(address);
    const domInfo = debotWalletNameByAddress.get(key);
    const walletInfo = getDebotWalletMeta(meta?.wallet, address);
    const name = domInfo?.name
      || walletInfo?.alias
      || walletInfo?.remark
      || walletInfo?.twitter_name
      || walletInfo?.twitter_handle
      || shortAddress(address);
    const avatar = domInfo?.avatar || walletInfo?.avatar_url || '';
    return { name, avatar, address };
  }

  function getDebotTokenMarketCap(row, tokenInfo, domInfo) {
    const directValue = tokenInfo?.market_cap
      || tokenInfo?.marketCap
      || tokenInfo?.mcap
      || domInfo?.mcap;
    if (typeof directValue === 'string' && directValue.trim()) {
      return directValue.trim().startsWith('$') ? directValue.trim() : `$${directValue.trim()}`;
    }
    if (Number.isFinite(Number(directValue))) {
      return formatUsdCompact(Number(directValue));
    }

    const price = Number(row?.price);
    const supply = Number(tokenInfo?.total_supply);
    const decimals = Number(tokenInfo?.decimals);
    if (!Number.isFinite(price) || !Number.isFinite(supply) || supply <= 0) return '';
    const adjustedSupply = Number.isFinite(decimals) && decimals > 0 && supply > 1e12
      ? supply / Math.pow(10, decimals)
      : supply;
    return formatUsdCompact(adjustedSupply * price);
  }

  function convertDebotTransactionToTrade(row, meta = {}) {
    if (!row || typeof row !== 'object') return null;
    const chain = normalizeChainName(row.chain);
    const mint = normalizeDebotTokenAddress(row.token || row.address || '');
    if (!chain || !mint) return null;

    const domInfo = debotTokenDomMetaByMint.get(mint) || {};
    const tokenInfo = meta?.token?.[mint] || meta?.token?.[row.token] || {};
    const walletDisplay = getDebotWalletDisplay(row, meta);
    if (!walletDisplay.name) return null;

    const action = getDebotActionLabel(row);
    const isBuy = String(row.op || '').toLowerCase() === 'buy' || isBuyAction(action);
    const timeMs = normalizeDebotTimestamp(row.time) || Date.now();
    const tokenSymbol = tokenInfo.symbol || domInfo.symbol || tokenInfo.name || domInfo.name || shortAddress(mint);
    const tokenLogo = tokenInfo.logo || domInfo.tokenLogo || '';
    const launchpad = tokenInfo.launchpad || tokenInfo.platform || tokenInfo.dex || '';
    const amount = formatDebotAmount(row.base_token_amount);
    const mcap = getDebotTokenMarketCap(row, tokenInfo, domInfo);
    const sourceTradeId = String(row.tx_hash || row.txHash || row.signature || row.uuid || row.tx || '').trim();
    const stableFingerprint = `${row.op || ''}|${row.log_index || ''}|${row.amount || ''}|${row.volume || ''}`;

    if (walletDisplay.address) {
      rememberDebotWallet(walletDisplay.address, {
        name: walletDisplay.name,
        avatar: walletDisplay.avatar
      });
    }
    rememberDebotToken(mint, {
      symbol: tokenSymbol,
      tokenLogo,
      mcap
    });
    tokenMeta.set(mint, {
      chain,
      symbol: tokenSymbol,
      logo: tokenLogo
    });

    return {
      wallet: walletDisplay.name,
      walletAddress: walletDisplay.address,
      walletAvatar: walletDisplay.avatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint,
      chain,
      amount,
      mcap,
      timeAgo: formatTradeAgeFromTimeMs(timeMs),
      tradeAge: '',
      timeMs,
      inferredTime: false,
      tokenLogo,
      href: buildDebotTokenUrl(chain, mint),
      platform: detectPlatform(mint, chain, launchpad),
      sourceTradeId,
      identityConfidence: sourceTradeId ? 'exact' : 'heuristic',
      stableKey: buildStableTradeKey({
        chain,
        mint,
        token: tokenSymbol,
        wallet: walletDisplay.name,
        walletAddress: walletDisplay.address,
        action,
        amount,
        fingerprint: stableFingerprint,
        sourceTradeId
      })
    };
  }

  function getDebotAddressFromHref(rawHref) {
    try {
      const parsed = new URL(String(rawHref || ''), location.href);
      const match = parsed.pathname.match(/\/address\/([^/]+)\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[2] || '') : '';
    } catch (e) {
      return '';
    }
  }

  function extractDebotDomTokenSymbol(text, chain) {
    const chainWord = chain === 'sol' ? 'solana' : chain === 'eth' ? '(?:ethereum|eth)' : chain;
    if (!chainWord) return '';
    const re = new RegExp(`\\b${chainWord}\\b\\s+(.+?)(?:\\s+(?:Pump\\.fun|Four\\.Meme|PancakeSwap|Raydium|Meteora|Uniswap)|\\s+\\d{2}\\/\\d{2}|\\s+\\d{4}\\/|\\s+市值|$)`, 'i');
    const match = String(text || '').match(re);
    return match ? match[1].trim() : '';
  }

  function parseDebotDomTradeText(text) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    const actionMatch = source.match(/(建仓|加仓|买入|减仓|卖出|清仓)/);
    if (!actionMatch) return null;

    const wallet = source.slice(0, actionMatch.index)
      .replace(/\baddress_avatar\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!wallet) return null;

    const action = actionMatch[1];
    const mcapMatch = source.match(/市值\s*\$?\s*([\d.,]+[KMB]?)/i);
    const beforeMcap = mcapMatch
      ? source.slice(0, source.indexOf(mcapMatch[0])).trim()
      : source;
    let tail = beforeMcap.slice(actionMatch.index + action.length).trim();
    tail = stripLeadingActionMeta(tail);

    let timeAgo = '';
    const leadingAge = tail.match(/^(\d+\s*(?:[smhdSMHD]|\u79d2|\u79d2\u949f|\u5206|\u5206\u949f|\u65f6|\u5c0f\u65f6|\u5929|\u65e5))\s*/);
    if (leadingAge) {
      timeAgo = normalizeTradeAgeText(leadingAge[1]);
      tail = tail.slice(leadingAge[0].length).trim();
    }

    const strippedTail = stripTrailingTradeAgeText(tail);
    const tradeAge = strippedTail.age;
    let headPart = strippedTail.text;
    let parsedHead = splitTradeAmountAndToken(headPart);
    if (!parsedHead.amount && parsedHead.tokenSymbol === headPart) {
      parsedHead = splitCompactAmountAndToken(headPart);
    }

    return {
      wallet,
      action,
      amount: parsedHead.amount || '',
      tokenSymbol: (parsedHead.tokenSymbol || headPart || '').trim(),
      timeAgo,
      tradeAge,
      mcap: mcapMatch ? `$${mcapMatch[1]}` : ''
    };
  }

  function parseDebotDomTradeAnchor(anchor) {
    if (!anchor || !anchor.querySelector) return null;
    const tokenInfo = parseDebotTokenHref(anchor.getAttribute('href') || anchor.href || '');
    if (!tokenInfo.mint || !tokenInfo.chain) return null;

    const text = compactDebugText(anchor, 1000);
    const parsedText = parseDebotDomTradeText(text);
    if (!parsedText) return null;
    const wallet = parsedText.wallet;

    const addressAnchor = anchor.querySelector('a[href*="/address/"]');
    const walletAddress = getDebotAddressFromHref(addressAnchor?.getAttribute('href') || addressAnchor?.href || '');
    const walletAvatar = anchor.querySelector('img')?.src || '';
    rememberDebotWallet(walletAddress, { name: wallet, avatar: walletAvatar });

    const timeMatch = text.match(/(\d{2}\/\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
    const absoluteTimeMs = parseDebotDateTime(timeMatch ? timeMatch[1] : '');
    const observedKey = buildObservedTradeKey({
      chain: tokenInfo.chain,
      mint: tokenInfo.mint,
      token: parsedText.tokenSymbol,
      wallet: walletAddress || wallet,
      action: parsedText.action,
      amount: parsedText.amount,
      fingerprint: text
    });
    const timeInfo = absoluteTimeMs
      ? { timeAgo: formatTradeAgeFromTimeMs(absoluteTimeMs), timeMs: absoluteTimeMs, inferredTime: false }
      : resolveTradeTimeInfo(parsedText.timeAgo, observedKey);
    const tokenSymbol = parsedText.tokenSymbol
      || extractDebotDomTokenSymbol(text, tokenInfo.chain)
      || shortAddress(tokenInfo.mint);
    const action = parsedText.action;
    const isBuy = isBuyAction(action);
    const sourceTradeId = extractTradeSourceId(anchor);

    rememberDebotToken(tokenInfo.mint, {
      symbol: tokenSymbol,
      mcap: parsedText.mcap,
      tokenLogo: ''
    });
    tokenMeta.set(tokenInfo.mint, {
      chain: tokenInfo.chain,
      symbol: tokenSymbol,
      logo: ''
    });

    return {
      wallet,
      walletAddress,
      walletAvatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint: tokenInfo.mint,
      chain: tokenInfo.chain,
      amount: parsedText.amount,
      mcap: parsedText.mcap,
      timeAgo: timeInfo.timeAgo,
      tradeAge: parsedText.tradeAge,
      timeMs: timeInfo.timeMs,
      inferredTime: timeInfo.inferredTime,
      tokenLogo: '',
      href: buildDebotTokenUrl(tokenInfo.chain, tokenInfo.mint),
      platform: detectPlatform(tokenInfo.mint, tokenInfo.chain, text),
      sourceTradeId,
      identityConfidence: sourceTradeId ? 'exact' : 'heuristic',
      stableKey: buildStableTradeKey({
        chain: tokenInfo.chain,
        mint: tokenInfo.mint,
        token: tokenSymbol,
        wallet,
        walletAddress,
        action,
        amount: parsedText.amount,
        fingerprint: `${action}|${parsedText.amount}|${tokenInfo.mint}`,
        sourceTradeId
      })
    };
  }

  function findDebotDomTradeAnchors() {
    return Array.from(document.querySelectorAll('a[href*="/token/"]'))
      .filter((anchor) => {
        if (anchor.closest('#gcp-inline-panel')) return false;
        const parsed = parseDebotTokenHref(anchor.getAttribute('href') || anchor.href || '');
        if (!parsed.mint) return false;
        const text = compactDebugText(anchor, 500);
        return /(建仓|加仓|买入|减仓|卖出|清仓)/.test(text);
      });
  }

  function looksLikeAddressLabel(value) {
    const text = String(value || '').trim();
    return /^0x[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/i.test(text)
      || /^[1-9A-HJ-NP-Za-km-z]{4}\.\.\.[1-9A-HJ-NP-Za-km-z]{4}$/.test(text);
  }

  function looksLikeTokenFallbackLabel(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    return looksLikeAddressLabel(text)
      || /^[A-Za-z0-9]{3,10}\.\.\.[A-Za-z0-9]{3,10}$/.test(text);
  }

  function improveDuplicateTradeRecord(trade) {
    if (!trade || !trade.stableKey) return;
    const pools = [buyRecords, sellRecords, closedRecords];
    for (const pool of pools) {
      const existing = pool.find((record) => record && record.stableKey === trade.stableKey);
      if (!existing) continue;
      if (trade.wallet && existing.wallet !== trade.wallet && looksLikeAddressLabel(existing.wallet)) {
        existing.wallet = trade.wallet;
      }
      if (trade.walletAvatar && !existing.walletAvatar) existing.walletAvatar = trade.walletAvatar;
      if (trade.amount && !existing.amount) existing.amount = trade.amount;
      if (trade.mcap && !existing.mcap) existing.mcap = trade.mcap;
      if (trade.tokenLogo && !existing.tokenLogo) existing.tokenLogo = trade.tokenLogo;
      if (
        trade.token
        && trade.token !== existing.token
        && looksLikeTokenFallbackLabel(existing.token)
        && !looksLikeTokenFallbackLabel(trade.token)
      ) {
        existing.token = trade.token;
      }
      if (trade.mint && !existing.mint) existing.mint = trade.mint;
      if (trade.chain && !existing.chain) existing.chain = trade.chain;
      if (trade.href && !existing.href) existing.href = trade.href;
      if (trade.platform && !existing.platform) existing.platform = trade.platform;
      return;
    }
  }

  function addTradeRecordToPools(trade, watchedTradesToSpeak, canAnnounceWatchedTrades) {
    if (!trade) return 'miss';
    if (trade.isBuy) {
      const key = `B|${trade.stableKey || buildStableTradeKey(trade)}`;
      if (seenKeys.has(key)) {
        improveDuplicateTradeRecord(trade);
        return 'duplicate';
      }
      seenKeys.add(key);
      buyRecords.push(trade);
      void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
      if (canAnnounceWatchedTrades && isTradeStarred(trade)) watchedTradesToSpeak.push(trade);
      return 'buy';
    }
    if (isCloseAction(trade.action)) {
      const key = `C|${trade.stableKey || buildStableTradeKey(trade)}`;
      if (seenClosedKeys.has(key)) {
        improveDuplicateTradeRecord(trade);
        return 'duplicate';
      }
      seenClosedKeys.add(key);
      closedRecords.push(trade);
      void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
      if (canAnnounceWatchedTrades && isTradeStarred(trade)) watchedTradesToSpeak.push(trade);
      return 'close';
    }
    if (isSellAction(trade.action)) {
      const key = `S|${trade.stableKey || buildStableTradeKey(trade)}`;
      if (seenSellKeys.has(key)) {
        improveDuplicateTradeRecord(trade);
        return 'duplicate';
      }
      seenSellKeys.add(key);
      sellRecords.push(trade);
      void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
      if (canAnnounceWatchedTrades && isTradeStarred(trade)) watchedTradesToSpeak.push(trade);
      return 'sell';
    }
    return 'unclassified';
  }

  function ingestDebotTradeRecords(records, source, rowCount) {
    const trades = Array.isArray(records) ? records.filter(Boolean) : [];
    const watchedTradesToSpeak = [];
    const canAnnounceWatchedTrades = watchedTradesPrimed;
    let added = 0;
    let duplicateSkips = 0;
    let unclassifiedActions = 0;

    for (const trade of trades) {
      const result = addTradeRecordToPools(trade, watchedTradesToSpeak, canAnnounceWatchedTrades);
      if (result === 'duplicate') duplicateSkips++;
      else if (result === 'unclassified') unclassifiedActions++;
      else if (result !== 'miss') added++;
    }

    lastScanInfo.panelCount = 1;
    lastScanInfo.activeTrackingPanels = 1;
    lastScanInfo.panelsOff = 0;
    lastScanInfo.rowCount = Number.isFinite(rowCount) ? rowCount : trades.length;
    lastScanInfo.parsedRows = trades.length;
    lastScanInfo.parseMisses = Math.max(0, lastScanInfo.rowCount - trades.length);
    lastScanInfo.parseErrors = 0;
    lastScanInfo.rowsRootMissing = 0;
    lastScanInfo.duplicateSkips = duplicateSkips;
    lastScanInfo.unclassifiedActions = unclassifiedActions;
    lastScanInfo.added = added;
    lastScanInfo.error = '';

    if ((added > 0 || shouldLogScanDebug()) && trades.length) {
      aggregateDebugLog('Debot trades ingested.', {
        source,
        rowCount: lastScanInfo.rowCount,
        parsedRows: trades.length,
        added,
        duplicateSkips,
        samples: trades.slice(0, 5).map(describeTradeForDebug)
      });
    }

    cleanOldRecords();
    schedulePublishSharedSnapshot();
    checkConvergence();
    renderAlerts();
    flushWatchedTradeAnnouncements(watchedTradesToSpeak);
    watchedTradesPrimed = true;
    updateStatus();
  }

  function normalizeDebotTrackPayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'string') {
      try { return JSON.parse(payload); } catch (e) { return null; }
    }
    if (payload.text) {
      try { return JSON.parse(payload.text); } catch (e) { return null; }
    }
    return payload;
  }

  function handleDebotTrackPayload(payload, source = 'network') {
    const parsed = normalizeDebotTrackPayload(payload);
    const transactions = parsed?.data?.transactions;
    if (!Array.isArray(transactions)) return;
    const meta = parsed?.data?.meta || {};
    const trades = transactions.map((row) => convertDebotTransactionToTrade(row, meta)).filter(Boolean);
    ingestDebotTradeRecords(trades, source, transactions.length);
  }

  async function maybeFetchDebotTrackTransactions(force = false) {
    if (!isDebotMonitorWindowPage() || debotApiFetchInFlight) return;
    const now = Date.now();
    if (!force && (now - debotLastApiFetchAt) < DEBOT_API_FETCH_MIN_INTERVAL_MS) return;
    debotApiFetchInFlight = true;
    debotLastApiFetchAt = now;
    try {
      const response = await fetch(buildDebotTrackTransactionsUrl(), {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Debot API ${response.status}`);
      const data = await response.json();
      handleDebotTrackPayload(data, 'api-fetch');
    } catch (e) {
      if (shouldLogScanDebug()) {
        aggregateDebugLog('Debot API fetch failed.', {
          error: e && e.message ? e.message : String(e)
        });
      }
    } finally {
      debotApiFetchInFlight = false;
    }
  }

  function scanDebotTrades() {
    const anchors = findDebotDomTradeAnchors();
    const trades = anchors.map(parseDebotDomTradeAnchor).filter(Boolean);
    ingestDebotTradeRecords(trades, 'dom', anchors.length);
    void maybeFetchDebotTrackTransactions();
  }

  function updateStatus() {
    if (!panelEl) return;
    const st = panelEl.querySelector('.gcp-status');
    if (!st) return;
    const i = lastScanInfo;
    const buys = getCombinedBuyRecords().length;
    const sells = getCombinedSellRecords().length;
    const closes = getCombinedClosedRecords().length;
    const chainSummary = getSharedChainSummary();

    let text, title;
    if (i.error) {
      text = `⚠️ ${i.rowCount} 行 · 买 ${buys}${sells ? ` / 卖 ${sells}` : ''}`;
      title = i.error;
      st.classList.add('is-warn');
      st.classList.remove('is-ok');
    } else if (i.rowCount > 0) {
      text = `🔍 ${i.rowCount} 行 · 买 ${buys}${sells ? ` / 卖 ${sells}` : ''}`;
      const parts = [
        `${i.activeTrackingPanels}/${i.panelCount} 个面板在追踪 tab`,
        `当前可见 ${i.rowCount} 行`,
        `解析 ${i.parsedRows || 0} 行，跳过 ${i.parseMisses || 0} 行，异常 ${i.parseErrors || 0} 行，重复 ${i.duplicateSkips || 0} 行，未知动作 ${i.unclassifiedActions || 0} 行`,
        `池中 ${buys} 笔买入${sells ? ' / ' + sells + ' 笔卖出' : ''}${closes ? ' / ' + closes + ' 笔清仓' : ''}`,
      ];
      title = parts.join('\n');
      st.classList.add('is-ok');
      st.classList.remove('is-warn');
    } else {
      text = `🔍 0 行 · 买 ${buys}${sells ? ` / 卖 ${sells}` : ''}`;
      title = '列表无可见行（可能未滚动或 gmgn 自身筛选）';
      st.classList.remove('is-ok');
      st.classList.remove('is-warn');
    }
    if (chainSummary.length) {
      const chainSummaryText = chainSummary.map(({ chain, count }) => `${chain}:${count}`).join(' ');
      const chainSummaryHtml = chainSummary.map(({ chain, count }) => renderChainBadge(chain, count)).join('');
      st.innerHTML = `${escHtml(text)} <span class="gcp-chain-summary">${chainSummaryHtml}</span>`;
      title += `\nChains: ${chainSummaryText}`;
    } else {
      st.textContent = text;
    }
    st.title = title;
  }

  function scanTrades() {
    if (!followModeActive || !isMonitorWindowPage()) {
      if (shouldLogScanDebug()) {
        aggregateDebugLog('scan skipped.', buildScanDebugSnapshot({
          reason: !followModeActive ? 'follow-mode-inactive' : 'not-monitor-page'
        }));
      }
      return;
    }

    if (isDebotMonitorWindowPage()) {
      scanDebotTrades();
      return;
    }

    const all = findAllTrackingLists();
    lastScanInfo.panelCount = all.length;
    lastScanInfo.activeTrackingPanels = all.filter(p => p.isOnTracking).length;
    lastScanInfo.panelsOff = all.length - lastScanInfo.activeTrackingPanels;
    lastScanInfo.parsedRows = 0;
    lastScanInfo.parseMisses = 0;
    lastScanInfo.parseErrors = 0;
    lastScanInfo.rowsRootMissing = 0;
    lastScanInfo.duplicateSkips = 0;
    lastScanInfo.unclassifiedActions = 0;
    lastScanInfo.added = 0;

    if (all.length === 0) {
      lastScanInfo.rowCount = 0;
      lastScanInfo.error = '没找到钱包追踪面板';
      if (shouldLogScanDebug()) {
        aggregateDebugLog('scan found no tracking panels.', buildScanDebugSnapshot({
          lists: describeTrackingListsForDebug(all)
        }));
      }
      cleanOldRecords();
      schedulePublishSharedSnapshot();
      checkConvergence();
      updateStatus();
      return;
    }
    if (lastScanInfo.activeTrackingPanels === 0) {
      lastScanInfo.rowCount = 0;
      lastScanInfo.error = '所有面板都不在「追踪」tab';
      if (shouldLogScanDebug()) {
        aggregateDebugLog('scan found tracking panels but none active.', buildScanDebugSnapshot({
          lists: describeTrackingListsForDebug(all)
        }));
      }
      cleanOldRecords();
      schedulePublishSharedSnapshot();
      checkConvergence();
      updateStatus();
      return;
    }

    let added = 0;
    let totalRows = 0;
    let parsedRows = 0;
    let parseMisses = 0;
    let parseErrors = 0;
    let rowsRootMissing = 0;
    let duplicateSkips = 0;
    let unclassifiedActions = 0;
    const parseMissSamples = [];
    const parseErrorSamples = [];
    const rowsRootMissingSamples = [];
    const parsedTradeSamples = [];
    const duplicateSamples = [];
    const unclassifiedSamples = [];
    const watchedTradesToSpeak = [];
    const canAnnounceWatchedTrades = watchedTradesPrimed;
    // 遍历所有在「追踪」tab 的面板
    for (const { list, isOnTracking } of all) {
      if (!isOnTracking) continue;
      const rowsRoot = list.children[0]?.children[0];
      if (!rowsRoot) {
        rowsRootMissing++;
        if (rowsRootMissingSamples.length < 3) {
          rowsRootMissingSamples.push({
            listChildren: list.children.length,
            firstChildChildren: list.children[0]?.children?.length || 0,
            text: compactDebugText(list, 180)
          });
        }
        continue;
      }
      const rows = rowsRoot.children;
      totalRows += rows.length;
      for (const row of rows) {
        let trade = null;
        try {
          trade = parseTradeRow(row);
        } catch (e) {
          parseErrors++;
          if (parseErrorSamples.length < 5) {
            parseErrorSamples.push({
              message: e && e.message ? e.message : String(e),
              text: compactDebugText(row, 220)
            });
          }
          continue;
        }
        if (!trade) {
          parseMisses++;
          if (parseMissSamples.length < 5) {
            parseMissSamples.push({
              issue: getTradeRowParseIssue(row),
              text: compactDebugText(row, 220)
            });
          }
          continue;
        }
        parsedRows++;
        if (parsedTradeSamples.length < 8) {
          parsedTradeSamples.push(describeTradeForDebug(trade));
        }
        if (trade.isBuy) {
          const key = `B|${trade.stableKey || buildStableTradeKey(trade)}`;
          if (seenKeys.has(key)) {
            duplicateSkips++;
            if (duplicateSamples.length < 5) duplicateSamples.push({ kind: 'buy', ...describeTradeForDebug(trade) });
            continue;
          }
          seenKeys.add(key);
          buyRecords.push(trade);
          void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        } else if (isCloseAction(trade.action)) {
          const ck = `C|${trade.stableKey || buildStableTradeKey(trade)}`;
          if (seenClosedKeys.has(ck)) {
            duplicateSkips++;
            if (duplicateSamples.length < 5) duplicateSamples.push({ kind: 'close', ...describeTradeForDebug(trade) });
            continue;
          }
          seenClosedKeys.add(ck);
          closedRecords.push(trade);
          void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        } else if (isSellAction(trade.action)) {
          const sk = `S|${trade.stableKey || buildStableTradeKey(trade)}`;
          if (seenSellKeys.has(sk)) {
            duplicateSkips++;
            if (duplicateSamples.length < 5) duplicateSamples.push({ kind: 'sell', ...describeTradeForDebug(trade) });
            continue;
          }
          seenSellKeys.add(sk);
          sellRecords.push(trade);
          void dispatchSignalEvent(buildWalletTradeSignalEvent(trade));
          added++;
          if (canAnnounceWatchedTrades && isTradeStarred(trade)) {
            watchedTradesToSpeak.push(trade);
          }
        } else {
          unclassifiedActions++;
          if (unclassifiedSamples.length < 5) {
            unclassifiedSamples.push(describeTradeForDebug(trade));
          }
        }
      }
    }
    lastScanInfo.rowCount = totalRows;
    lastScanInfo.parsedRows = parsedRows;
    lastScanInfo.parseMisses = parseMisses;
    lastScanInfo.parseErrors = parseErrors;
    lastScanInfo.rowsRootMissing = rowsRootMissing;
    lastScanInfo.duplicateSkips = duplicateSkips;
    lastScanInfo.unclassifiedActions = unclassifiedActions;
    lastScanInfo.added = added;
    lastScanInfo.error = parseErrors > 0
      ? `解析异常 ${parseErrors} 行`
      : totalRows > 0 && parsedRows === 0
        ? '可见行全部解析失败'
        : totalRows > 0 && parsedRows > 0 && added === 0 && (buyRecords.length + sellRecords.length + closedRecords.length) === 0
          ? '行已解析但没有进入买卖池'
        : rowsRootMissing > 0 && totalRows === 0
          ? '追踪列表结构变化，找不到行容器'
          : totalRows === 0
            ? '追踪 tab 列表为空（gmgn 过滤无活动钱包？）'
            : '';
    if (lastScanInfo.error && shouldLogScanDebug()) {
      aggregateDebugLog('scan anomaly.', buildScanDebugSnapshot({
        lists: describeTrackingListsForDebug(all),
        parsedTradeSamples,
        parseMissSamples,
        parseErrorSamples,
        rowsRootMissingSamples,
        duplicateSamples,
        unclassifiedSamples
      }));
    }
    updateStatus();

    cleanOldRecords();
    schedulePublishSharedSnapshot();
    checkConvergence();
    renderAlerts();
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
    buyRecords = dedupeTradeRecords(buyRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff));
    sellRecords = dedupeTradeRecords(sellRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff));
    closedRecords = dedupeTradeRecords(closedRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff * 2));
    pruneInferredTradeTimes(now);
    if (seenKeys.size > 5000) seenKeys = new Set(Array.from(seenKeys).slice(-2500));
    if (seenSellKeys.size > 5000) seenSellKeys = new Set(Array.from(seenSellKeys).slice(-2500));
    if (seenClosedKeys.size > 5000) seenClosedKeys = new Set(Array.from(seenClosedKeys).slice(-2500));
    cleanDissolvedAlerts();
  }

  // 全员清仓的提醒保留 5 分钟后自动移除
  const DISSOLVED_KEEP_MS = 5 * 60 * 1000;
  function cleanDissolvedAlerts() {
    const now = Date.now();
    const before = alerts.length;
    alerts = alerts.filter(a => !a.dissolvedAt || (now - a.dissolvedAt) < DISSOLVED_KEEP_MS);
    pruneHiddenAlertsState();
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
      // 优先按 mint 聚合；GMGN 新 DOM 缺少 mint 时，按链 + token 名兜底。
      const key = buildAlertGroupKey(r);
      if (!key) continue;
      if (!groups[key]) {
        groups[key] = {
          wallets: {},
          mcap: r.mcap,
          mint: r.mint,
          chain: r.chain,
          token: r.token,
          tokenLogo: r.tokenLogo,
          platform: r.platform || null,
          latestTradeTimeMs: r.timeMs || 0
        };
      }
      const g = groups[key];
      const normalizedWalletAddress = normalizeFocusAddress(r.walletAddress || '');
      const walletKey = normalizedWalletAddress
        ? `${String(r.chain || '').toLowerCase()}:${normalizedWalletAddress.toLowerCase()}`
        : `name:${String(r.wallet || '').trim().toLowerCase()}`;
      if (!g.wallets[walletKey] || (r.timeMs || 0) > (g.wallets[walletKey].timeMs || 0)) {
        g.wallets[walletKey] = {
          name: r.wallet,
          amount: r.amount,
          timeAgo: r.timeAgo,
          timeMs: r.timeMs,
          avatar: r.walletAvatar,
          address: normalizedWalletAddress || g.wallets[walletKey]?.address || ''
        };
      } else if (normalizedWalletAddress && !g.wallets[walletKey].address) {
        g.wallets[walletKey].address = normalizedWalletAddress;
      }
      if ((r.timeMs || 0) >= (g.latestTradeTimeMs || 0)) {
        g.latestTradeTimeMs = r.timeMs || g.latestTradeTimeMs || 0;
        if (r.mcap) g.mcap = r.mcap;
        if (r.token) g.token = r.token;
        if (r.tokenLogo) g.tokenLogo = r.tokenLogo;
        if (r.platform) g.platform = r.platform;
      }
    }

    let triggered = false, updated = false;
    let shouldPlayAggregateCue = false;
    let highestTierFired = 0;
    let selectedSoundCue = null;
    let qualifyingGroupCount = 0;
    const debugEvents = [];
    const activeQualifyingGroupKeys = new Set();

    for (const [groupKey, group] of Object.entries(groups)) {
      const becameVisibleAgain = releaseHiddenAlertIfNewBuy(groupKey, group.latestTradeTimeMs || 0);
      const walletNames = Object.keys(group.wallets);
      const hasPriorityWallet = hasStarredWallet(walletNames.map((walletKey) => ({
        name: group.wallets[walletKey]?.name || walletKey,
        address: group.wallets[walletKey]?.address || '',
        chain: group.chain
      })), group.chain);
      const requiredWallets = hasPriorityWallet ? 1 : config.minWallets;
      if (walletNames.length < requiredWallets) continue;
      activeQualifyingGroupKeys.add(groupKey);
      qualifyingGroupCount += 1;
      const qualifiesStandardThreshold = walletNames.length >= config.minWallets;

      const walletDetails = walletNames.map((walletKey) => {
        const wd = group.wallets[walletKey];
        const walletName = wd.name || walletKey;
        const walletAddress = normalizeFocusAddress(wd.address || '');
        const closeMatch = combinedClosedRecords.find(c =>
          ((walletAddress && normalizeFocusAddress(c.walletAddress || '') === walletAddress) || (!walletAddress && c.wallet === walletName)) &&
          (c.chain || '') === (group.chain || '') &&
          ((group.mint && c.mint === group.mint) ||
           (!group.mint && !c.mint && c.token === group.token)) &&
          c.timeMs > wd.timeMs
        );
        return {
          name: walletName,
          address: wd.address || '',
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

      const existing = alerts.find(a => getAlertGroupKey(a) === groupKey);

      if (existing) {
        const sameCount = existing.walletCount === walletNames.length;
        const sameClose = (existing.closedCount || 0) === closedCount;
        const sameMcap = (existing.mcap || '') === (group.mcap || '');
        const sameLatestTrade = (existing.latestTradeTimeMs || 0) === (group.latestTradeTimeMs || 0);
        const sameToken = (existing.token || '') === (group.token || '');
        const sameTokenLogo = (existing.tokenLogo || '') === (group.tokenLogo || '');
        const samePlatform = JSON.stringify(existing.platform || null) === JSON.stringify(group.platform || null);
        const sameWalletAddresses = JSON.stringify((existing.wallets || []).map((wallet) => wallet.address || ''))
          === JSON.stringify(walletDetails.map((wallet) => wallet.address || ''));
        if (sameCount && sameClose && sameMcap && sameLatestTrade && sameToken && sameTokenLogo && samePlatform && sameWalletAddresses) continue;
        const prevTier = existing.tier || calcTier(existing.effectiveCount || existing.walletCount);
        const crossedStandardThreshold = qualifiesStandardThreshold && existing.walletCount < config.minWallets;
        existing.walletCount = walletNames.length;
        existing.effectiveCount = effectiveCount;
        existing.closedCount = closedCount;
        // 全员清仓 → 标记 dissolvedAt（之后 5 分钟自动从列表移除）；又有人买回来 → 清掉
        if (effectiveCount === 0) {
          if (!existing.dissolvedAt) existing.dissolvedAt = Date.now();
        } else {
          existing.dissolvedAt = null;
        }
        const fomoWallets = (existing.fomoSignals || []).map((signal) => ({
          name: signal.alertKind === 'trader' ? `FOMO @${signal.traderName}` : `FOMO ${signal.traderCount} traders`,
          amount: signal.amountText,
          timeAgo: signal.displayTime,
          address: signal.traderAddress || '',
          external: true,
          stableKey: signal.stableKey
        }));
        existing.wallets = [...walletDetails, ...fomoWallets];
        existing.mcap = group.mcap || existing.mcap;
        existing.token = group.token || existing.token;
        existing.mint = group.mint || existing.mint;
        existing.chain = group.chain || existing.chain;
        existing.tokenLogo = group.tokenLogo || existing.tokenLogo;
        existing.platform = group.platform || existing.platform;
        existing.latestTradeTimeMs = group.latestTradeTimeMs || existing.latestTradeTimeMs || 0;
        existing.tier = newTier;
        existing.updatedAt = Date.now();
        existing.isNew = true;
        updated = true;
        void dispatchSignalEvent(buildConvergenceAlertSignalEvent(existing, {
          requiredWallets,
          hasPriorityWallet
        }));
        const soundReasons = [];
        if (crossedStandardThreshold) soundReasons.push('crossed-standard-threshold');
        if (newTier > prevTier) soundReasons.push(`tier-up:${prevTier}->${newTier}`);
        if (becameVisibleAgain) soundReasons.push('became-visible-again');
        if (qualifiesStandardThreshold && soundReasons.length) {
          highestTierFired = Math.max(highestTierFired, newTier || 1);
          shouldPlayAggregateCue = true;
          selectedSoundCue = chooseAggregateSoundCue(selectedSoundCue, {
            tier: newTier || 1,
            chain: group.chain,
            latestTradeTimeMs: group.latestTradeTimeMs || 0
          });
          debugEvents.push({
            type: 'existing-alert-sound',
            groupKey,
            token: group.token,
            chain: group.chain,
            walletCount: walletNames.length,
            effectiveCount,
            latestTradeTimeMs: group.latestTradeTimeMs || 0,
            reasons: soundReasons
          });
        }
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
          latestTradeTimeMs: group.latestTradeTimeMs || 0,
          tier: newTier,
          triggeredAt: Date.now(),
          updatedAt: Date.now(),
          isNew: true
        };
        const alertsBeforePush = alerts.length;
        alerts.unshift(alert);
        pruneHiddenAlertsState();
        triggered = true;
        void dispatchSignalEvent(buildConvergenceAlertSignalEvent(alert, {
          requiredWallets,
          hasPriorityWallet
        }));
        if (alertsBeforePush >= MAX_VISIBLE_ALERTS) {
          debugEvents.push({
            type: 'new-alert-while-full',
            groupKey,
            token: group.token,
            walletCount: walletNames.length,
            effectiveCount,
            latestTradeTimeMs: group.latestTradeTimeMs || 0,
            alertsBeforePush
          });
        } else {
          debugEvents.push({
            type: 'new-alert',
            groupKey,
            token: group.token,
            walletCount: walletNames.length,
            effectiveCount,
            latestTradeTimeMs: group.latestTradeTimeMs || 0
          });
        }
        if (qualifiesStandardThreshold) {
          highestTierFired = Math.max(highestTierFired, newTier || 1);
          shouldPlayAggregateCue = true;
          selectedSoundCue = chooseAggregateSoundCue(selectedSoundCue, {
            tier: newTier || 1,
            chain: group.chain,
            latestTradeTimeMs: group.latestTradeTimeMs || 0
          });
        }
        setTimeout(() => { alert.isNew = false; renderAlerts(); }, 1500);
      }
    }

    const alertsBeforePrune = alerts.length;
    alerts = alerts.filter((alert) => {
      const key = getAlertGroupKey(alert);
      if (key && activeQualifyingGroupKeys.has(key)) return true;
      if (alert.externalSource === 'fomo') {
        return (now - Number(alert.updatedAt || alert.triggeredAt || 0)) < windowMs;
      }
      return !!(alert.dissolvedAt && (now - alert.dissolvedAt) < DISSOLVED_KEEP_MS);
    });
    if (alerts.length !== alertsBeforePrune) {
      updated = true;
      debugEvents.push({
        type: 'pruned-inactive-alerts',
        removedCount: alertsBeforePrune - alerts.length,
        remainingCount: alerts.length
      });
    }

    if (triggered || updated) {
      const suspiciousEvents = debugEvents.filter((event) => event.type === 'new-alert-while-full' || event.type === 'existing-alert-sound');
      if (shouldPlayAggregateCue || suspiciousEvents.length) {
        aggregateDebugLog('checkConvergence result.', {
          rowCount: lastScanInfo.rowCount || 0,
          buyPool: combinedBuyRecords.length,
          closePool: combinedClosedRecords.length,
          groupCount: Object.keys(groups).length,
          qualifyingGroupCount,
          alertsCount: alerts.length,
          triggered,
          updated,
          shouldPlayAggregateCue,
          highestTierFired,
          selectedSoundCue,
          events: suspiciousEvents.length ? suspiciousEvents : debugEvents.slice(-5)
        });
      }
      renderAlerts();
      if (shouldPlayAggregateCue) { playSound((selectedSoundCue && selectedSoundCue.tier) || highestTierFired || 1, selectedSoundCue && selectedSoundCue.chain); flashBadge(); }
    }
  }

  // ===== 声音 =====
  const AUDIO_UNLOCK_EVENTS = ['pointerdown', 'mousedown', 'keydown', 'touchstart'];
  const PENDING_AUDIO_CUE_TTL_MS = 30000;
  let _audioCtx = null, _audioReady = false;
  let pendingAggregateCue = null;
  let pendingWatchedTradeSpeech = null;
  function ensureAudioCtx() {
    if (_audioReady) return _audioCtx;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _audioReady = true;
      return _audioCtx;
    } catch (e) { return null; }
  }

  async function resumeAudioCtx() {
    const ctx = ensureAudioCtx();
    if (!ctx) return false;
    if (ctx.state !== 'suspended') return true;
    try {
      await ctx.resume();
      return ctx.state !== 'suspended';
    } catch (e) {
      return false;
    }
  }

  function queuePendingAggregateCue(tier, chain) {
    pendingAggregateCue = {
      tier: tier || 1,
      chain: chain || '',
      queuedAt: Date.now()
    };
  }

  function flushPendingAggregateCue() {
    if (!pendingAggregateCue) return;
    if ((Date.now() - pendingAggregateCue.queuedAt) > PENDING_AUDIO_CUE_TTL_MS) {
      pendingAggregateCue = null;
      return;
    }

    const cue = pendingAggregateCue;
    pendingAggregateCue = null;
    playSound(cue.tier, cue.chain);
  }

  function queuePendingWatchedTradeSpeech(text) {
    pendingWatchedTradeSpeech = {
      text,
      queuedAt: Date.now()
    };
  }

  function flushPendingWatchedTradeSpeech() {
    if (!pendingWatchedTradeSpeech) return;
    if ((Date.now() - pendingWatchedTradeSpeech.queuedAt) > PENDING_AUDIO_CUE_TTL_MS) {
      pendingWatchedTradeSpeech = null;
      return;
    }

    const item = pendingWatchedTradeSpeech;
    pendingWatchedTradeSpeech = null;
    void playWatchedTradeSpeech(item.text);
  }

  function isAutoplayBlockedError(error) {
    const name = String(error && error.name || '');
    const message = String(error && error.message || error || '');
    return name === 'NotAllowedError'
      || /user.*interact|autoplay|notallowed|play\(\) failed/i.test(message);
  }

  function handleAudioUnlockSignal() {
    void resumeAudioCtx().then((ready) => {
      if (!ready) return;
      flushPendingAggregateCue();
      flushPendingWatchedTradeSpeech();
    });
  }

  for (const eventName of AUDIO_UNLOCK_EVENTS) {
    document.addEventListener(eventName, handleAudioUnlockSignal, { capture: true, passive: true });
  }
  window.addEventListener('focus', handleAudioUnlockSignal);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handleAudioUnlockSignal();
  });

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

  function getConfiguredAudioVolume() {
    const volume = Number(audioSettings && audioSettings.volume);
    if (!Number.isFinite(volume)) return 1;
    return Math.min(MAX_AUDIO_VOLUME, Math.max(0, volume));
  }

  function attachAudioBoost(audio, rawVolume) {
    const volume = getConfiguredAudioVolume() * (Number.isFinite(Number(rawVolume)) ? Number(rawVolume) : 1);
    const normalizedVolume = Math.min(MAX_AUDIO_VOLUME, Math.max(0, volume));
    audio.volume = Math.min(normalizedVolume, 1);
    if (normalizedVolume <= 1) {
      return () => {};
    }

    const ctx = ensureAudioCtx();
    if (!ctx) {
      return () => {};
    }

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const sourceNode = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = normalizedVolume;
      return () => {
        try { sourceNode.disconnect(); } catch (e) {}
        try { gainNode.disconnect(); } catch (e) {}
      };
    } catch (e) {
      return () => {};
    }
  }

  function playSound(tier, chain) {
    if (!config.soundEnabled) return;
    if (document.visibilityState === 'hidden') return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      queuePendingAggregateCue(tier, chain);
      void resumeAudioCtx().then((ready) => {
        if (ready) flushPendingAggregateCue();
      });
      aggregateDebugLog('playSound deferred until audio context is unlocked.', {
        tier: tier || 1,
        chain: chain || ''
      });
      return;
    }
    playSoundWithContext(ctx, tier, chain);
  }

  function playSoundWithContext(ctx, tier, chain) {
    tier = tier || 1;
    const soundProfile = getAggregateChainSoundProfile(chain);
    const volumeScale = getConfiguredAudioVolume();
    aggregateDebugLog('playSound invoked.', {
      tier,
      chain: chain || '',
      soundProfile,
      volumeScale,
      alertCount: alerts.length,
      visibleAlertCount: filterAlertsByChain(sortAlertsForDisplay(alerts)).filter((alert) => !isAlertHidden(alert)).length,
      rowCount: lastScanInfo.rowCount || 0,
      buyPool: getCombinedBuyRecords().length,
      sellPool: getCombinedSellRecords().length
    });
    try {
      if (tier === 1) {
        playBeepSeq(ctx, scaleBeepSeq([{ f: 880, t: 0, d: 0.1 }, { f: 880, t: 0.15, d: 0.1 }], soundProfile.scale), 0.25 * volumeScale);
      } else if (tier === 2) {
        playBeepSeq(ctx, scaleBeepSeq([
          { f: 1000, t: 0, d: 0.08 },
          { f: 1000, t: 0.10, d: 0.08 },
          { f: 1000, t: 0.20, d: 0.08 }
        ], soundProfile.scale), 0.27 * volumeScale);
      } else if (tier === 3) {
        const seq = [];
        for (let i = 0; i < 5; i++) {
          seq.push({ f: 1100, t: i * 0.07, d: 0.06 });
          seq.push({ f: 1320, t: i * 0.07, d: 0.06 });
        }
        playBeepSeq(ctx, scaleBeepSeq(seq, soundProfile.scale), 0.20 * volumeScale);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880 * soundProfile.scale, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760 * soundProfile.scale, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.30 * volumeScale, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(440 * soundProfile.scale, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(880 * soundProfile.scale, ctx.currentTime + 0.4);
        gain2.gain.setValueAtTime(0.10 * volumeScale, ctx.currentTime);
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
      const response = await fetch(ttsSettings.apiUrl, {
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
        const cleanupBoost = attachAudioBoost(audio, 1);
        try {
          const playbackFinished = new Promise((resolve) => {
            audio.addEventListener('ended', resolve, { once: true });
            audio.addEventListener('error', resolve, { once: true });
          });
          await audio.play();
          await playbackFinished;
        } finally {
          cleanupBoost();
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (e) {
      if (isAutoplayBlockedError(e)) {
        queuePendingWatchedTradeSpeech(text);
        aggregateDebugLog('watched trade TTS deferred until browser audio is unlocked.', {
          text: text.slice(0, 80)
        });
        return;
      }
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
        utterance.volume = Math.min(getConfiguredAudioVolume(), 1);
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
          <button class="gcp-icon-btn gcp-focus-speech-btn" title="Focus Wallet TTS">TTS</button>
          <button class="gcp-icon-btn gcp-tier-btn" title="${config.tieredAlerts ? '分级提醒：开（点击关闭）' : '分级提醒：关（点击开启）'}">${config.tieredAlerts ? '🔥' : '🌫️'}</button>
          <button class="gcp-icon-btn gcp-sound-btn" title="声音开关">🔔</button>
        </div>
      </div>
      <div class="gcp-settings">
        <label>≥ <input type="number" class="gcp-min-wallets" min="2" max="20" value="${config.minWallets}"> 钱包</label>
        <label>内 <input type="number" class="gcp-time-window" min="1" max="1440" value="${config.timeWindowMin}"> 分钟</label>
        <label>链
          <select class="gcp-chain-filter">
            <option value="all" ${config.chainFilter === 'all' ? 'selected' : ''}>全部</option>
            <option value="bsc" ${config.chainFilter === 'bsc' ? 'selected' : ''}>BSC</option>
            <option value="eth" ${config.chainFilter === 'eth' ? 'selected' : ''}>ETH</option>
            <option value="base" ${config.chainFilter === 'base' ? 'selected' : ''}>BASE</option>
            <option value="sol" ${config.chainFilter === 'sol' ? 'selected' : ''}>SOL</option>
            <option value="robinhood" ${config.chainFilter === 'robinhood' ? 'selected' : ''}>Robinhood</option>
          </select>
        </label>
        <label>排序
          <select class="gcp-sort-by">
            <option value="walletCount" ${config.sortBy === 'walletCount' ? 'selected' : ''}>按人数</option>
            <option value="latest" ${config.sortBy === 'latest' ? 'selected' : ''}>按最新</option>
            <option value="mcap" ${config.sortBy === 'mcap' ? 'selected' : ''}>按市值</option>
          </select>
        </label>
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

  function updateFocusSpeechButtonState() {
    const button = panelEl && panelEl.querySelector('.gcp-focus-speech-btn');
    if (!button) return;
    const enabled = audioSettings.ttsEnabled !== false;
    button.classList.toggle('is-off', !enabled);
    button.textContent = enabled ? 'TTS' : 'TTS-';
    button.title = enabled
      ? 'Focus Wallet TTS is ON. Click to turn it off.'
      : 'Focus Wallet TTS is OFF. Click to turn it on.';
    button.setAttribute('aria-label', button.title);
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

    const focusSpeechBtn = panelEl.querySelector('.gcp-focus-speech-btn');
    if (focusSpeechBtn) {
      updateFocusSpeechButtonState();
      focusSpeechBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audioSettings = normalizeAudioSettings({
          ...audioSettings,
          ttsEnabled: audioSettings.ttsEnabled === false
        });
        updateFocusSpeechButtonState();
        void persistAudioSettings();
      });
    }

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

    const chainFilter = panelEl.querySelector('.gcp-chain-filter');
    if (chainFilter) {
      chainFilter.addEventListener('change', (e) => {
        const nextValue = ALERT_CHAIN_FILTER_OPTIONS.includes(e.target.value) ? e.target.value : DEFAULT_CONFIG.chainFilter;
        if (config.chainFilter === nextValue) return;
        config.chainFilter = nextValue;
        saveConfig();
        lastRenderState = '';
        renderAlerts();
      });
      chainFilter.addEventListener('click', e => e.stopPropagation());
    }

    const sortBy = panelEl.querySelector('.gcp-sort-by');
    if (sortBy) {
      sortBy.addEventListener('change', (e) => {
        const nextValue = ALERT_SORT_OPTIONS.has(e.target.value) ? e.target.value : DEFAULT_CONFIG.sortBy;
        if (config.sortBy === nextValue) return;
        config.sortBy = nextValue;
        saveConfig();
        lastRenderState = '';
        renderAlerts();
      });
      sortBy.addEventListener('click', e => e.stopPropagation());
    }

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
    seenSellKeys.clear();
    seenClosedKeys.clear();
    buyRecords = [];
    sellRecords = [];
    closedRecords = [];
    schedulePublishSharedSnapshot();
    scanTrades(); renderAlerts();
  }

  let lastRenderState = '';

  function getFilteredRecentBuyCount() {
    const now = Date.now();
    const windowMs = config.timeWindowMin * 60 * 1000;
    return getCombinedBuyRecords().filter((record) => {
      if (!record || !record.timeMs || (now - record.timeMs) > windowMs) return false;
      if (config.chainFilter === 'all') return true;
      return normalizeChainName(record.chain) === config.chainFilter;
    }).length;
  }

  function getCurrentFilterLabel() {
    return config.chainFilter === 'all' ? '全部链' : getChainDisplay(config.chainFilter).label;
  }

  function buildEmptyAlertsHtml(filteredAlerts) {
    const buyCount = getFilteredRecentBuyCount();
    if (filteredAlerts.length > 0) {
      return '<div class="gcp-empty">当前提醒已隐藏，等待新买入</div>';
    }
    if (buyCount > 0) {
      const label = getCurrentFilterLabel();
      return `<div class="gcp-empty">${escHtml(label)} 已扫描 ${escHtml(buyCount)} 笔买入，暂无 ≥${escHtml(config.minWallets)} 钱包聚合</div>`;
    }
    return alerts.length === 0
      ? '<div class="gcp-empty">监听中…等待信号</div>'
      : '<div class="gcp-empty">当前链筛选下暂无提醒</div>';
  }

  function renderAlerts() {
    if (!panelEl) return;
    const container = panelEl.querySelector('.gcp-alerts');
    const badge = panelEl.querySelector('.gcp-badge');
    if (!container || !badge) return;
    const filteredAlerts = filterAlertsByChain(sortAlertsForDisplay(alerts));
    const visibleAlerts = filteredAlerts.filter((alert) => !isAlertHidden(alert));
    const limitedVisibleAlerts = visibleAlerts.slice(0, MAX_VISIBLE_ALERTS);
    const visibleTotal = visibleAlerts.length;
    badge.textContent = limitedVisibleAlerts.length !== visibleTotal ? `${limitedVisibleAlerts.length}/${visibleTotal}` : String(visibleTotal);

    let html;
    if (limitedVisibleAlerts.length === 0) {
      html = buildEmptyAlertsHtml(filteredAlerts);
    } else {
      html = limitedVisibleAlerts.map(a => {
        const hasStar = isAlertStarred(a);
        const groupKey = getAlertGroupKey(a);
        const closedCount = a.closedCount || 0;
        const effective = (a.effectiveCount != null) ? a.effectiveCount : a.walletCount;
        const fomoTraderCount = Math.max(0, ...(a.fomoSignals || []).map((signal) => Number(signal.traderCount || 0)));
        const fomoRealBuyerCount = new Set((a.fomoSignals || []).filter((signal) => signal.alertKind === 'trader').map((signal) => String(signal.traderAddress || signal.traderName || '').toLowerCase()).filter(Boolean)).size;
        const fomoAggregateTraderCount = Math.max(0, ...(a.fomoSignals || []).filter((signal) => signal.alertKind !== 'trader').map((signal) => Number(signal.traderCount || 0)));
        const tier = Math.max(a.tier || calcTier(effective), fomoTraderCount ? calcTier(fomoTraderCount) : 0);
        const tierIcon = tier >= 4 ? ' 🚨' : tier >= 3 ? ' 🔥' : tier >= 2 ? ' ⚡' : '';
        const logoImg = a.tokenLogo
          ? `<img class="gcp-token-logo" src="${escHtml(a.tokenLogo)}" loading="lazy" referrerpolicy="no-referrer" />`
          : '';
        const chainBadge = a.chain ? renderChainBadge(a.chain) : '';
        const mcapBadge = a.mcap ? `<span class="gcp-alert-mcap">市值 ${escHtml(a.mcap)}</span>` : '';
        const metaLine = `${mcapBadge}${chainBadge}`;
        const externalLinks = renderTokenExternalLinks(a);
        const hideBtn = groupKey
          ? `<button class="gcp-alert-hide-btn" data-group-key="${escHtml(groupKey)}" data-latest-trade-time="${escHtml(a.latestTradeTimeMs || 0)}" title="闅愯棌杩欐潯鎻愰啋锛岀洿鍒颁笅娆℃湁鏂颁拱鍏?">×</button>`
          : '';
        const requiredWallets = hasStar ? 1 : config.minWallets;
        const isFaded = effective < requiredWallets && fomoRealBuyerCount === 0 && fomoAggregateTraderCount === 0;
        const countLabel = [
          effective > 0 ? `${effective} wallets` : '',
          fomoRealBuyerCount > 0 ? `FOMO ${fomoRealBuyerCount} buyers` : '',
          fomoAggregateTraderCount > 0 ? `FOMO ${fomoAggregateTraderCount} traders` : ''
        ].filter(Boolean).join(' · ');
        return `
        <div class="gcp-alert-item gcp-tier-${tier} ${a.isNew ? 'is-new' : ''} ${isFaded ? 'is-faded' : ''}" data-token="${escHtml(a.token)}">
          <div class="gcp-alert-token">
            <span class="gcp-alert-token-name gcp-token-link" data-mint="${escHtml(a.mint || '')}" data-chain="${escHtml(a.chain || '')}" data-token="${escHtml(a.token)}" title="跳转到 ${escHtml(a.token)}">${logoImg}${escHtml(a.token)} ↗</span>${a.mint ? `<span class="gcp-mint-tag" title="合约：${escHtml(a.mint)}（点击复制）" data-mint="${escHtml(a.mint)}">${escHtml(shortMint(a.mint))}</span>` : ''}${a.platform ? `<span class="gcp-plat-badge ${escHtml(a.platform.cls)}" title="${escHtml(a.platform.label)}">${escHtml(a.platform.tag)}</span>` : ''}${externalLinks}
            <span class="gcp-alert-actions"><span class="gcp-alert-count">${escHtml(countLabel)}${closedCount > 0 ? ` <span class="gcp-closed-tag">−${closedCount} 清仓</span>` : ''}${tierIcon}</span>${hideBtn}</span>
          </div>
          <div class="gcp-alert-time">${metaLine}</div>
          <div class="gcp-alert-wallets">
            ${a.wallets.map(w => {
              if (w.external) {
                return `<span class="gcp-alert-wallet-tag gcp-alert-wallet-tag-external" title="FOMO aggregate alert">
                  <span class="gcp-wallet-name">${escHtml(w.name)}</span>
                  <span class="gcp-wallet-amount">${escHtml(w.amount)}</span>
                  ${w.timeAgo ? `<span style="color:#666">${escHtml(w.timeAgo)}</span>` : ''}
                </span>`;
              }
                const star = !!findFocusWalletKey(w.name, w.address, a.chain);
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
    container.querySelectorAll('.gcp-token-ext-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const url = el.href || el.getAttribute('href') || '';
        if (!url) return;

        if (isMonitorWindowPage()) {
          void openPanelLinkInMainWindow(url).then((opened) => {
            if (!opened) window.open(url, '_blank', 'noopener,noreferrer');
          });
          return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
    container.querySelectorAll('.gcp-mint-tag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
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
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleStar(el.dataset.wallet);
      });
    });
    container.querySelectorAll('.gcp-blacklist-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleBlacklistWallet(el.dataset.wallet);
      });
    });
    container.querySelectorAll('.gcp-alert-hide-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideAlertUntilNextBuy(el.dataset.groupKey || '', parseInt(el.dataset.latestTradeTime || '0', 10) || 0);
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
    return monitorScreenActive && (FOLLOW_PATH_RE.test(location.pathname) || isDebotMonitorWindowPage());
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }

          resolve(response || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function refreshMonitorScreenActive() {
    const response = await sendRuntimeMessage({
      type: GET_MONITOR_SCREEN_STATUS_MESSAGE
    });
    monitorScreenActive = !!(response && response.ok && response.isMonitorScreen);
    return monitorScreenActive;
  }

  function syncFollowModeFromMonitorState() {
    void refreshMonitorScreenActive().then(() => {
      syncFollowMode();
    });
  }

  function watchMonitorScreenState() {
    if (!canUseSharedStorage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[MONITOR_STATE_STORAGE_KEY]) {
        return;
      }

      syncFollowModeFromMonitorState();
    });
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
      if (isDebotMonitorWindowPage()) {
        const debotUrl = buildDebotTokenUrl(useChain, useMint);
        if (debotUrl) {
          if (await openPanelLinkInMainWindow(debotUrl)) return;
          window.location.href = debotUrl;
          return;
        }
      }
      const url = buildGmgnTokenPath(useChain, useMint);
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
      const wallet = getTextExcludingSvg(walletEl).trim();
      const isStar = !!findSpeechWatchWalletKey(wallet);
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
  function findDebotTrackingRoot() {
    return document.querySelector('#root, #__next, [id="app"], main') || document.body;
  }

  function scheduleDebotScan() {
    if (debotScanScheduled) return;
    debotScanScheduled = true;
    setTimeout(() => {
      debotScanScheduled = false;
      scanTrades();
    }, 500);
  }

  function startObserver() {
    if (!followModeActive || !isMonitorWindowPage()) return false;
    if (isDebotMonitorWindowPage()) {
      observers.forEach(o => { try { o.disconnect(); } catch(e) {} });
      observers = [];
      const root = findDebotTrackingRoot();
      if (!root) return false;
      const ob = new MutationObserver(scheduleDebotScan);
      ob.observe(root, { childList: true, subtree: true });
      observers.push(ob);
      observer = ob;
      if (scanInterval) clearInterval(scanInterval);
      scanInterval = setInterval(scanTrades, 5000);
      return true;
    }
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
      if (isDebotMonitorWindowPage()) {
        if (observers.length === 0) startObserver();
        return;
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
    sellRecords = [];
    closedRecords = [];
    seenKeys.clear();
    seenSellKeys.clear();
    seenClosedKeys.clear();
    spokenWatchedTradeKeys.clear();
    inferredTradeTimeByKey.clear();
    tokenMeta.clear();
    debotWalletNameByAddress.clear();
    debotTokenDomMetaByMint.clear();
    debotApiFetchInFlight = false;
    debotLastApiFetchAt = 0;
    debotScanScheduled = false;
    sharedSources = {};
    watchedTradesPrimed = false;
    watchedTradeSpeechQueue = Promise.resolve();
    lastScanInfo = {
      panelCount: 0,
      activeTrackingPanels: 0,
      rowCount: 0,
      parsedRows: 0,
      parseMisses: 0,
      parseErrors: 0,
      rowsRootMissing: 0,
      duplicateSkips: 0,
      unclassifiedActions: 0,
      added: 0,
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

    const syncAfterNavigation = () => queueMicrotask(syncFollowModeFromMonitorState);
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

    window.addEventListener('popstate', syncFollowModeFromMonitorState);
    window.addEventListener('hashchange', syncFollowModeFromMonitorState);
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

  async function checkForUpdate() {}

  function showUpdateBanner() {}

  // ===== 初始化 =====
  function init() {
    installPageDebugMessageBridge();
    installDebotNetworkMessageBridge();
    installRouteWatcher();
    watchMonitorScreenState();
    ensureAudioSyncChannel();
    Promise.all([
      loadSpeechWatchlist(),
      loadFocusAddresses(),
      loadBlacklistWallets(),
      loadAudioSettings(),
      loadTtsSettings()
    ]).catch(() => null).finally(() => {
      const tryInit = async () => {
        await refreshMonitorScreenActive();
        return syncFollowMode();
      };
      startFocusAddressSync();
      void tryInit().then((active) => {
        if (active) return;
        const w = setInterval(() => {
          void tryInit().then((ok) => {
            if (ok) clearInterval(w);
          });
        }, 1500);
        setTimeout(() => clearInterval(w), 60000);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 调试
  window.__gcp = {
    config, alerts, buyRecords, sellRecords, tokenMeta, starred,
    sourceId,
    get audioSettings() { return audioSettings; },
    get speechWatchlist() { return speechWatchlist; },
    get focusAddresses() { return focusAddresses; },
    get sharedSources() { return sharedSources; },
    get lastScanInfo() { return { ...lastScanInfo }; },
    get combinedBuyRecords() { return getCombinedBuyRecords(); },
    get combinedSellRecords() { return getCombinedSellRecords(); },
    dumpScanDebug: () => {
      const all = findAllTrackingLists();
      const snapshot = buildScanDebugSnapshot({
        lists: describeTrackingListsForDebug(all)
      });
      aggregateDebugLog('manual scan debug snapshot.', snapshot);
      return snapshot;
    },
    getConvergence: () => {
      const snapshot = buildConvergenceDebugSnapshot();
      aggregateDebugLog('manual convergence debug snapshot.', snapshot);
      return snapshot;
    },
    rerender: () => { lastRenderState = ''; renderAlerts(); },
    rescan: () => scanTrades(),
    syncShared: () => loadSharedSnapshots({ recalculate: true })
  };
})();
