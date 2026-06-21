(function () {
  'use strict';

  if (window.__gmgnTwitterTriggerHookLoaded) return;
  window.__gmgnTwitterTriggerHookLoaded = true;

  const SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
  const RULES_KEY = 'gmgnTwitterTriggerRules';
  const TRADE_PROFILES_KEY = 'gmgnTwitterTradeProfiles';
  const DISPATCH_MESSAGE = 'dispatch-gmgn-twitter-trigger-hook';
  const DEBUG_PREFIX = '[GMGN Twitter Hook]';
  const DEFAULT_SETTINGS = {
    enabled: false,
    webhookUrl: '',
    secret: '',
    timeoutMs: 3000,
    directCaEnabled: false,
    directCaChain: 'bsc',
    directCaBuyAmount: '',
    directCaTwitterIds: ''
  };
  const DEFAULT_RULES = [];
  const DEFAULT_PROFILES = [];
  const RECENT_DISPATCH_TTL_MS = 15000;
  const SYNC_CHANNEL_NAME = 'gmgn_twitter_trigger_hook_sync';

  let settings = { ...DEFAULT_SETTINGS };
  let rules = [...DEFAULT_RULES];
  let tradeProfiles = [...DEFAULT_PROFILES];
  let isReady = false;
  let pendingEvents = [];
  const recentDispatches = new Map();
  const syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);

  void loadState();

  window.addEventListener('TWITTER_WS_MSG_RECEIVED', handleTwitterMessage);
  chrome.storage.onChanged.addListener(handleStorageChanges);

  syncChannel.onmessage = (event) => {
    if (!event.data || event.data.type !== 'trigger-dispatched' || !event.data.key) return;
    recentDispatches.set(event.data.key, Number(event.data.ts) || Date.now());
  };

  window.addEventListener('pagehide', () => {
    syncChannel.close();
  }, { once: true });

  async function loadState() {
    const stored = await chrome.storage.local.get([SETTINGS_KEY, RULES_KEY, TRADE_PROFILES_KEY]);
    settings = normalizeSettings(stored[SETTINGS_KEY]);
    rules = normalizeRules(stored[RULES_KEY]);
    tradeProfiles = normalizeTradeProfiles(stored[TRADE_PROFILES_KEY]);
    isReady = true;

    if (pendingEvents.length > 0) {
      const queue = pendingEvents;
      pendingEvents = [];
      for (const event of queue) {
        processTwitterTriggers(event);
      }
    }
  }

  function handleStorageChanges(changes, areaName) {
    if (areaName !== 'local') return;

    if (changes[SETTINGS_KEY]) {
      settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    }
    if (changes[RULES_KEY]) {
      rules = normalizeRules(changes[RULES_KEY].newValue);
    }
    if (changes[TRADE_PROFILES_KEY]) {
      tradeProfiles = normalizeTradeProfiles(changes[TRADE_PROFILES_KEY].newValue);
    }
  }

  function handleTwitterMessage(event) {
    if (!isReady) {
      pendingEvents.push(event);
      return;
    }
    processTwitterTriggers(event);
  }

  function processTwitterTriggers(event) {
    if (!settings.enabled || !settings.webhookUrl) return;
    if (rules.length === 0 && !settings.directCaEnabled && tradeProfiles.length === 0) return;

    const triggers = event.detail && Array.isArray(event.detail.triggers) ? event.detail.triggers : [];
    if (triggers.length === 0) return;

    pruneRecentDispatches(Date.now());
    for (const rawTrigger of triggers) {
      const trigger = normalizeTrigger(rawTrigger);
      if (!trigger.twitterId) continue;
      const dispatchedContracts = new Set();

      for (const rule of rules) {
        const matchedKeywords = matchRule(rule, trigger);
        if (!matchedKeywords) continue;

        const dedupeKey = buildDispatchKey(rule, trigger, matchedKeywords);
        if (recentDispatches.has(dedupeKey)) continue;

        dispatchedContracts.add(buildContractKey(rule.chain, rule.ca));
        recentDispatches.set(dedupeKey, Date.now());
        syncChannel.postMessage({
          type: 'trigger-dispatched',
          key: dedupeKey,
          ts: Date.now()
        });

        const payload = buildHookPayload(rule, trigger, matchedKeywords, dedupeKey);
        void dispatchHookPayload(payload, dedupeKey);
      }

      if (settings.directCaEnabled) {
        const directPayloads = buildDirectCaPayloads(trigger, dispatchedContracts);
        for (const { payload, dedupeKey } of directPayloads) {
          recentDispatches.set(dedupeKey, Date.now());
          syncChannel.postMessage({
            type: 'trigger-dispatched',
            key: dedupeKey,
            ts: Date.now()
          });
          void dispatchHookPayload(payload, dedupeKey);
        }
      }

      if (tradeProfiles.length > 0) {
        const profilePayloads = buildTradeProfilePayloads(trigger, dispatchedContracts);
        for (const { payload, dedupeKey } of profilePayloads) {
          recentDispatches.set(dedupeKey, Date.now());
          syncChannel.postMessage({
            type: 'trigger-dispatched',
            key: dedupeKey,
            ts: Date.now()
          });
          void dispatchHookPayload(payload, dedupeKey);
        }
      }
    }
  }

  async function dispatchHookPayload(payload, dedupeKey) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: DISPATCH_MESSAGE,
        payload
      });

      if (!result || !result.ok) {
        recentDispatches.delete(dedupeKey);
        logWarn('Hook dispatch failed.', {
          ruleId: payload.rule.id,
          error: result && result.error ? result.error : 'Unknown error'
        });
        return;
      }

      logInfo('Hook dispatched.', {
        ruleId: payload.rule.id,
        twitterId: payload.rule.twitterId,
        status: result.status || 200
      });
    } catch (error) {
      recentDispatches.delete(dedupeKey);
      logWarn('Hook dispatch threw.', {
        ruleId: payload.rule.id,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  function buildHookPayload(rule, trigger, matchedKeywords, dedupeKey) {
    return {
      source: 'wallet-convergence-alert-gmgn-monitor',
      signalType: 'gmgn_twitter_trigger',
      signalId: dedupeKey,
      triggeredAt: Date.now(),
      rule: {
        id: rule.id,
        twitterId: rule.twitterId,
        eventType: rule.eventType,
        keywords: rule.keywords,
        chain: rule.chain,
        ca: rule.ca,
        tokenSymbol: rule.tokenSymbol,
        buyAmount: rule.buyAmount,
        note: rule.note || '',
        filters: rule.filters || {},
        execution: rule.execution || {},
        conditionOrders: Array.isArray(rule.conditionOrders) ? rule.conditionOrders : [],
        profileId: rule.profileId || ''
      },
      trigger: {
        twitterId: trigger.twitterId,
        username: trigger.username,
        userId: trigger.userId,
        name: trigger.name,
        remark: trigger.remark,
        eventType: trigger.eventType,
        rawEventType: trigger.rawEventType,
        tweetId: trigger.tweetId,
        text: trigger.text,
        url: trigger.url,
        ts: trigger.ts
      },
      matchedKeywords,
      page: {
        url: location.href,
        title: document.title
      }
    };
  }

  function buildDirectCaPayloads(trigger, dispatchedContracts) {
    if (!settings.directCaBuyAmount) {
      logWarn('Direct CA trigger skipped because buy amount is empty.', {
        twitterId: trigger.twitterId,
        tweetId: trigger.tweetId || ''
      });
      return [];
    }

    const allowedTwitterIds = normalizeTwitterIdList(settings.directCaTwitterIds);
    if (allowedTwitterIds.length > 0 && !allowedTwitterIds.includes(trigger.twitterId)) {
      return [];
    }

    const chain = normalizeChain(settings.directCaChain);
    const contracts = extractContractAddresses(trigger.text, chain);
    if (contracts.length === 0) return [];

    const payloads = [];
    for (const ca of contracts) {
      const contractKey = buildContractKey(chain, ca);
      if (dispatchedContracts.has(contractKey)) continue;

      const rule = {
        id: `direct-ca-${chain}`,
        enabled: true,
        twitterId: trigger.twitterId,
        eventType: trigger.eventType || 'any',
        keywords: [],
        chain,
        ca,
        tokenSymbol: '',
        buyAmount: settings.directCaBuyAmount,
        note: 'direct-ca-from-tweet'
      };
      const dedupeKey = buildDirectCaDispatchKey(rule, trigger);
      if (recentDispatches.has(dedupeKey)) continue;

      dispatchedContracts.add(contractKey);
      payloads.push({
        dedupeKey,
        payload: buildHookPayload(rule, trigger, [`CA:${ca}`], dedupeKey)
      });
    }

    return payloads;
  }

  function buildTradeProfilePayloads(trigger, dispatchedContracts) {
    const payloads = [];
    for (const profile of tradeProfiles) {
      const matchedKeywords = matchTradeProfile(profile, trigger);
      if (!matchedKeywords) continue;

      const contracts = extractContractAddresses(trigger.text, profile.chain);
      if (contracts.length === 0) continue;

      for (const ca of contracts) {
        const contractKey = buildContractKey(profile.chain, ca);
        if (dispatchedContracts.has(contractKey)) continue;

        const rule = {
          id: profile.id,
          profileId: profile.id,
          enabled: true,
          twitterId: profile.twitterId,
          eventType: trigger.eventType || 'any',
          keywords: profile.keywords,
          chain: profile.chain,
          ca,
          tokenSymbol: '',
          buyAmount: profile.buyAmount,
          note: profile.note || 'twitter-trade-profile',
          filters: profile.filters,
          execution: profile.execution,
          conditionOrders: profile.conditionOrders
        };
        const dedupeKey = buildProfileDispatchKey(rule, trigger);
        if (recentDispatches.has(dedupeKey)) continue;

        dispatchedContracts.add(contractKey);
        payloads.push({
          dedupeKey,
          payload: buildHookPayload(rule, trigger, matchedKeywords.length > 0 ? matchedKeywords : [`CA:${ca}`], dedupeKey)
        });
      }
    }

    return payloads;
  }

  function matchRule(rule, trigger) {
    if (!rule.enabled) return null;
    if (rule.twitterId !== trigger.twitterId) return null;
    if (rule.eventType !== 'any' && rule.eventType !== trigger.eventType) return null;

    if (!rule.keywords || rule.keywords.length === 0) {
      return [];
    }

    const haystack = [
      trigger.text,
      trigger.name,
      trigger.remark,
      trigger.username
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();

    const matchedKeywords = rule.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
    if (matchedKeywords.length === 0) return null;
    return matchedKeywords;
  }

  function matchTradeProfile(profile, trigger) {
    if (!profile.enabled) return null;
    if (profile.twitterId !== trigger.twitterId) return null;
    if (!profile.eventTypes.includes(trigger.eventType)) return null;

    const haystack = buildTriggerHaystack(trigger);
    if (profile.excludeKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return null;
    }

    if (profile.keywords.length === 0) {
      return [];
    }

    const matchedKeywords = profile.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
    return matchedKeywords.length > 0 ? matchedKeywords : null;
  }

  function buildTriggerHaystack(trigger) {
    return [
      trigger.text,
      trigger.name,
      trigger.remark,
      trigger.username
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  function buildDispatchKey(rule, trigger, matchedKeywords) {
    return [
      rule.id,
      trigger.twitterId,
      trigger.eventType,
      trigger.tweetId || String(trigger.ts || ''),
      matchedKeywords.join(',')
    ].join('|');
  }

  function buildDirectCaDispatchKey(rule, trigger) {
    return [
      rule.id,
      trigger.twitterId,
      trigger.eventType,
      trigger.tweetId || String(trigger.ts || ''),
      rule.ca.toLowerCase()
    ].join('|');
  }

  function buildProfileDispatchKey(rule, trigger) {
    return [
      rule.id,
      trigger.twitterId,
      trigger.eventType,
      trigger.tweetId || String(trigger.ts || ''),
      rule.ca.toLowerCase()
    ].join('|');
  }

  function buildContractKey(chain, ca) {
    return `${normalizeChain(chain)}:${String(ca || '').trim().toLowerCase()}`;
  }

  function normalizeTrigger(trigger) {
    return {
      twitterId: normalizeTwitterId(trigger && (trigger.id || trigger.username)),
      username: normalizeTwitterId(trigger && (trigger.username || trigger.id)),
      userId: typeof trigger?.userId === 'string' ? trigger.userId.trim() : '',
      name: typeof trigger?.name === 'string' ? trigger.name.trim() : '',
      remark: typeof trigger?.remark === 'string' ? trigger.remark.trim() : '',
      eventType: normalizeEventType(trigger && trigger.tw),
      rawEventType: typeof trigger?.tw === 'string' ? trigger.tw.trim() : '',
      tweetId: typeof trigger?.tweetId === 'string' ? trigger.tweetId.trim() : '',
      text: typeof trigger?.text === 'string' ? trigger.text.trim() : '',
      url: typeof trigger?.url === 'string' ? trigger.url.trim() : '',
      ts: Number.isFinite(Number(trigger?.ts)) ? Number(trigger.ts) : null
    };
  }

  function normalizeSettings(raw) {
    const next = {
      ...DEFAULT_SETTINGS,
      ...(raw || {})
    };
    next.enabled = next.enabled === true;
    next.webhookUrl = typeof next.webhookUrl === 'string' ? next.webhookUrl.trim() : '';
    next.secret = typeof next.secret === 'string' ? next.secret.trim() : '';
    next.timeoutMs = clampTimeout(next.timeoutMs);
    next.directCaEnabled = next.directCaEnabled === true;
    next.directCaChain = normalizeChain(next.directCaChain);
    next.directCaBuyAmount = typeof next.directCaBuyAmount === 'string'
      ? next.directCaBuyAmount.trim()
      : String(next.directCaBuyAmount || '').trim();
    next.directCaTwitterIds = normalizeTwitterIdList(next.directCaTwitterIds).join('\n');
    return next;
  }

  function normalizeRules(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((rule, index) => normalizeRule(rule, index))
      .filter((rule) => rule && rule.twitterId && rule.ca);
  }

  function normalizeRule(rule, index) {
    if (!rule || typeof rule !== 'object') return null;
    return {
      id: typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : `rule-${index + 1}`,
      enabled: rule.enabled !== false,
      twitterId: normalizeTwitterId(rule.twitterId),
      eventType: normalizeRuleEventType(rule.eventType),
      keywords: normalizeKeywords(rule.keywords),
      chain: normalizeChain(rule.chain),
      ca: typeof rule.ca === 'string' ? rule.ca.trim() : '',
      tokenSymbol: typeof rule.tokenSymbol === 'string' ? rule.tokenSymbol.trim() : '',
      buyAmount: typeof rule.buyAmount === 'string' ? rule.buyAmount.trim() : String(rule.buyAmount || '').trim(),
      note: typeof rule.note === 'string' ? rule.note.trim() : '',
      filters: normalizeTradeFilters(rule.filters),
      execution: normalizeTradeExecution(rule.execution),
      conditionOrders: normalizeConditionOrders(rule.conditionOrders),
      profileId: typeof rule.profileId === 'string' ? rule.profileId.trim() : ''
    };
  }

  function normalizeTradeProfiles(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((profile, index) => normalizeTradeProfile(profile, index)).filter(Boolean);
  }

  function normalizeTradeProfile(profile, index) {
    if (!profile || typeof profile !== 'object') return null;
    const twitterId = normalizeTwitterId(profile.twitterId);
    const buyAmount = typeof profile.buyAmount === 'string'
      ? profile.buyAmount.trim()
      : String(profile.buyAmount || '').trim();
    if (!twitterId || !buyAmount) return null;

    return {
      id: typeof profile.id === 'string' && profile.id.trim() ? profile.id.trim() : `twitter-trade-${index + 1}`,
      enabled: profile.enabled !== false,
      twitterId,
      eventTypes: normalizeEventTypes(profile.eventTypes),
      keywords: normalizeKeywords(profile.keywords),
      excludeKeywords: normalizeKeywords(profile.excludeKeywords),
      chain: normalizeChain(profile.chain),
      mode: 'tweet-ca',
      buyAmount,
      filters: normalizeTradeFilters(profile.filters),
      execution: normalizeTradeExecution(profile.execution),
      conditionOrders: normalizeConditionOrders(profile.conditionOrders),
      note: typeof profile.note === 'string' ? profile.note.trim() : ''
    };
  }

  function normalizeEventTypes(value) {
    const allowed = new Set(['tweet', 'reply', 'repost', 'quote', 'other']);
    const items = Array.isArray(value)
      ? value.map((item) => String(item || '').trim().toLowerCase()).filter((item) => allowed.has(item))
      : [];
    return items.length > 0 ? items : ['tweet'];
  }

  function normalizeTradeFilters(value) {
    const filters = value && typeof value === 'object' ? value : {};
    return {
      marketCapMinUsd: normalizeOptionalNumber(filters.marketCapMinUsd),
      marketCapMaxUsd: normalizeOptionalNumber(filters.marketCapMaxUsd),
      maxTokenAgeSeconds: normalizeOptionalNumber(filters.maxTokenAgeSeconds)
    };
  }

  function normalizeTradeExecution(value) {
    const raw = value && typeof value === 'object' ? value : {};
    return {
      autoSlippage: raw.autoSlippage !== false,
      slippage: normalizeOptionalNumber(raw.slippage),
      gasPriceGwei: normalizeOptionalNumber(raw.gasPriceGwei),
      tipFeeBnb: normalizeOptionalNumber(raw.tipFeeBnb),
      antiMev: raw.antiMev !== false
    };
  }

  function normalizeConditionOrders(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((order) => ({
        order_type: String(order?.order_type || 'profit_stop').trim(),
        side: String(order?.side || 'sell').trim(),
        price_scale: String(order?.price_scale || '').trim(),
        sell_ratio: String(order?.sell_ratio || '').trim()
      }))
      .filter((order) => order.price_scale && order.sell_ratio);
  }

  function normalizeOptionalNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
  }

  function normalizeKeywords(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
      .split(/[\r\n,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeTwitterIdList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeTwitterId(item)).filter(Boolean);
    }
    return String(value || '')
      .split(/[\s,，]+/)
      .map((item) => normalizeTwitterId(item))
      .filter(Boolean);
  }

  function extractContractAddresses(text, chain) {
    const source = String(text || '');
    if (!source) return [];

    const normalizedChain = normalizeChain(chain);
    const pattern = normalizedChain === 'sol'
      ? /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g
      : /\b0x[a-fA-F0-9]{40}\b/g;
    const matches = source.match(pattern) || [];
    const unique = [];
    const seen = new Set();
    for (const match of matches) {
      const ca = normalizedChain === 'sol' ? match : match.toLowerCase();
      if (seen.has(ca)) continue;
      seen.add(ca);
      unique.push(ca);
    }
    return unique;
  }

  function normalizeChain(value) {
    const chain = String(value || '').trim().toLowerCase();
    if (['sol', 'bsc', 'eth', 'base'].includes(chain)) return chain;
    return 'bsc';
  }

  function normalizeRuleEventType(value) {
    const eventType = String(value || '').trim().toLowerCase();
    if (!eventType || eventType === 'any') return 'any';
    return normalizeEventType(eventType);
  }

  function normalizeTwitterId(value) {
    return String(value || '').trim().toLowerCase().replace(/^@/, '');
  }

  function normalizeEventType(value) {
    const actionType = String(value || '').trim().toLowerCase();
    if (!actionType) return 'other';
    if (/delete|deleted|delete_tweet|remove|删除这条推文|删除推文|已删除推文/.test(actionType)) return 'delete';
    if (/tweet|post|new_tweet|create|create_tweet|发推|推文/.test(actionType)) return 'tweet';
    if (/repost|retweet|retweeted|转推|转发/.test(actionType)) return 'repost';
    if (/reply|replied|回复/.test(actionType)) return 'reply';
    if (/quote|quoted|quote_tweet|引用/.test(actionType)) return 'quote';
    if (/unfollow|unfollowed|取消关注|取关/.test(actionType)) return 'unfollow';
    if (/follow|followed|关注/.test(actionType)) return 'follow';
    if (/like|liked|点赞/.test(actionType)) return 'like';
    if (/pin|pinned|置顶/.test(actionType)) return 'pin';
    if (/update|profile_update|avatar|bio|username|资料|头像|简介|用户名/.test(actionType)) return 'update';
    return 'other';
  }

  function clampTimeout(value) {
    const timeout = Number(value);
    if (!Number.isFinite(timeout)) return DEFAULT_SETTINGS.timeoutMs;
    return Math.max(500, Math.min(15000, Math.round(timeout)));
  }

  function pruneRecentDispatches(now) {
    for (const [key, ts] of recentDispatches.entries()) {
      if ((now - ts) > RECENT_DISPATCH_TTL_MS) {
        recentDispatches.delete(key);
      }
    }
  }

  function logInfo(message, detail) {
    const prefix = `${DEBUG_PREFIX} ${formatLogTimestamp()}`;
    if (detail === undefined) {
      console.info(prefix, message);
      return;
    }
    console.info(prefix, message, detail);
  }

  function logWarn(message, detail) {
    const prefix = `${DEBUG_PREFIX} ${formatLogTimestamp()}`;
    if (detail === undefined) {
      console.warn(prefix, message);
      return;
    }
    console.warn(prefix, message, detail);
  }

  function formatLogTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
})();
