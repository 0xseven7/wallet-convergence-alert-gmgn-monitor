(() => {
  'use strict';

  const FOMO_API_ORIGIN = 'https://prod-api.fomo.family';
  const FOMO_WS_URL = 'wss://prod-api.fomo.family/ws';
  const FOMO_WSS_EVENT = 'wallet-convergence:fomo-wss-event';
  const FOMO_WSS_STATE = 'wallet-convergence:fomo-wss-state';
  const FOMO_WSS_READY = 'wallet-convergence:fomo-wss-ready';
  const PROFILE_CACHE_LIMIT = 500;
  const PENDING_EVENT_LIMIT = 100;
  const WSS_CONNECT_TIMEOUT_MS = 20000;
  // FOMO timestamps are minute-granular. Keep one rounded minute plus normal
  // transport jitter when distinguishing a live event from reconnect backlog.
  const LIVE_DELIVERY_MAX_LAG_MS = 90 * 1000;
  const LIVE_DELIVERY_MAX_CLOCK_SKEW_MS = 5 * 1000;

  function definedChainName(value) {
    return {
      '1': 'ethereum',
      '56': 'bnb',
      '8453': 'base',
      '4663': 'robinhood',
      '1399811149': 'solana',
      'ct_501': 'solana',
      ethereum: 'ethereum',
      eth: 'ethereum',
      bnb: 'bnb',
      bsc: 'bnb',
      base: 'base',
      robinhood: 'robinhood',
      sol: 'solana',
      solana: 'solana'
    }[String(value || '').trim().toLowerCase()] || '';
  }

  function compactNumber(value) {
    const number = Math.abs(Number(value || 0));
    if (!Number.isFinite(number)) return '';
    const units = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K']
    ];
    for (const [threshold, suffix] of units) {
      if (number < threshold) continue;
      const scaled = number / threshold;
      const decimals = scaled >= 10 ? 1 : 2;
      return `${scaled.toFixed(decimals).replace(/\.?0+$/, '')}${suffix}`;
    }
    const decimals = number >= 100 ? 0 : number >= 10 ? 1 : 2;
    return number.toFixed(decimals).replace(/\.?0+$/, '');
  }

  function formatUsd(value) {
    const compact = compactNumber(value);
    return compact ? `$${compact}` : '';
  }

  function formatAge(createdAt, nowMs = Date.now()) {
    const createdMs = new Date(createdAt || 0).getTime();
    if (!Number.isFinite(createdMs) || createdMs <= 0) return '0s';
    const seconds = Math.max(0, Math.floor((Number(nowMs || Date.now()) - createdMs) / 1000));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  function profileAddressForChain(profile, chain) {
    if (!profile) return '';
    return String(chain === 'solana' ? profile.address : profile.evmAddress || '').trim();
  }

  function buildTokenUrl(chain, tokenAddress, tradeId = '') {
    if (!chain || !tokenAddress) return '';
    const url = new URL(`/tokens/${encodeURIComponent(chain)}/${encodeURIComponent(tokenAddress)}`, 'https://fomo.family');
    if (tradeId) url.searchParams.set('tradeId', tradeId);
    return url.href;
  }

  function normalizeTradingActivity(activity, profile = null, nowMs = Date.now()) {
    if (!activity || typeof activity !== 'object') return null;
    const type = String(activity.type || '').trim().toLowerCase();
    const chain = definedChainName(activity.networkId ?? activity.chainId ?? activity.chain);
    const tokenAddress = String(activity.tokenAddress || activity.body?.tokenAddress || '').trim();
    if (!chain || !tokenAddress) return null;

    const createdAt = activity.createdAt || new Date(nowMs).toISOString();
    const observedAt = new Date(createdAt).getTime() || Number(nowMs || Date.now());
    const receivedAt = Number(nowMs || Date.now());
    const deliveryLagMs = receivedAt - observedAt;
    const liveDelivery = deliveryLagMs >= -LIVE_DELIVERY_MAX_CLOCK_SKEW_MS
      && deliveryLagMs <= LIVE_DELIVERY_MAX_LAG_MS;
    const activityId = String(activity.id || '').trim();
    const tradeId = String(activity.tradeId || '').trim();

    if (type === 'swap_buy' || type === 'swap_sell') {
      const side = type === 'swap_sell' ? 'sell' : 'buy';
      const traderName = String(activity.userHandle || profile?.userHandle || activity.displayName || profile?.displayName || 'Unknown').trim();
      const amountUsd = Math.abs(Number(activity.usdAmount || 0));
      const rawTokenAmount = side === 'buy'
        ? (activity.outHumanAmount ?? activity.tokenAmount ?? activity.outputTokenAmount)
        : (activity.inHumanAmount ?? activity.tokenAmount ?? activity.inputTokenAmount);
      const parsedTokenAmount = Math.abs(Number(rawTokenAmount));
      const tokenAmount = Number.isFinite(parsedTokenAmount) && parsedTokenAmount > 0
        ? parsedTokenAmount
        : undefined;
      const remainingTokenAmount = activity.remainingTokenAmount
        ?? activity.remainingAmount
        ?? activity.position?.remainingTokenAmount;
      const positionClosed = side === 'sell' && (
        activity.positionClosed === true
        || activity.isClosed === true
        || activity.closed === true
        || (remainingTokenAmount != null && Number(remainingTokenAmount) === 0)
      );
      const marketCapUsd = Number(activity.fdv ?? activity.marketCap ?? 0);
      const amountText = formatUsd(amountUsd);
      const marketCapText = formatUsd(marketCapUsd);
      return {
        alertKind: 'trader',
        stableKey: activityId
          ? `activity|${activityId}`
          : [
              'trade',
              tradeId || 'unknown',
              chain,
              tokenAddress.toLowerCase(),
              side,
              String(activity.userId || traderName).toLowerCase(),
              observedAt,
              amountUsd,
              marketCapUsd
            ].join('|'),
        activityId,
        chain,
        tokenAddress,
        symbol: String(activity.ticker || activity.symbol || '').trim(),
        tokenImage: String(activity.tokenImageUrl || '').trim(),
        side,
        traderCount: 1,
        traderName,
        traderHandle: String(activity.userHandle || profile?.userHandle || traderName).trim(),
        traderUserId: String(activity.userId || profile?.id || '').trim(),
        traderAddress: profileAddressForChain(profile, chain),
        traderAvatar: String(activity.profilePictureLink || profile?.profilePictureLink || '').trim(),
        followedTrader: Boolean(profileAddressForChain(profile, chain)),
        tradeId,
        amountText,
        amountUsd,
        tokenAmount,
        positionClosed,
        marketCapText,
        marketCapUsd,
        displayTime: formatAge(createdAt, nowMs),
        url: buildTokenUrl(chain, tokenAddress, tradeId),
        observedAt,
        receivedAt,
        liveDelivery
      };
    }

    if (type === 'multi_user_buy' || type === 'multi_user_sell') {
      const body = activity.body || {};
      const side = type === 'multi_user_sell' ? 'sell' : 'buy';
      const traderCount = Math.max(0, Number(body.uniqueTraders || body.traderCount || 0));
      const amountUsd = Math.abs(Number(body.totalVolume || 0));
      const marketCapUsd = Number(body.fdv ?? body.marketCap ?? 0);
      const amountText = formatUsd(amountUsd);
      const marketCapText = formatUsd(marketCapUsd);
      return {
        alertKind: 'aggregate',
        stableKey: activityId
          ? `activity|${activityId}`
          : ['aggregate', tradeId || 'unknown', chain, tokenAddress.toLowerCase(), side, observedAt, traderCount, amountUsd, marketCapUsd].join('|'),
        activityId,
        chain,
        tokenAddress,
        symbol: String(body.ticker || activity.ticker || '').trim(),
        tokenImage: String(body.tokenImageUrl || activity.tokenImageUrl || '').trim(),
        side,
        traderCount,
        amountText,
        amountUsd,
        marketCapText,
        marketCapUsd,
        displayTime: formatAge(createdAt, nowMs),
        url: buildTokenUrl(chain, tokenAddress),
        observedAt,
        receivedAt,
        liveDelivery
      };
    }

    if (type === 'thesis') {
      const actorName = String(activity.userHandle || profile?.userHandle || activity.displayName || profile?.displayName || 'Unknown').trim();
      const text = String(activity.comment?.comment || activity.comment?.text || '').trim();
      if (!text) return null;
      return {
        alertKind: 'thesis',
        stableKey: activityId
          ? `activity|${activityId}`
          : `thesis|${tradeId || 'unknown'}|${chain}|${tokenAddress.toLowerCase()}|${observedAt}`,
        activityId,
        chain,
        tokenAddress,
        symbol: String(activity.ticker || '').trim(),
        actorName,
        actorHandle: String(activity.userHandle || profile?.userHandle || actorName).trim(),
        actorUserId: String(activity.userId || profile?.id || '').trim(),
        actorAddress: profileAddressForChain(profile, chain),
        followedTrader: Boolean(profileAddressForChain(profile, chain)),
        profileImage: String(activity.profilePictureLink || profile?.profilePictureLink || '').trim(),
        tokenImage: String(activity.tokenImageUrl || '').trim(),
        text,
        displayTime: formatAge(createdAt, nowMs),
        closed: Boolean(activity.authorTrade?.closedAt),
        url: buildTokenUrl(chain, tokenAddress, activity.tradeId),
        observedAt,
        receivedAt,
        liveDelivery
      };
    }

    return null;
  }

  function parseFomoSocketMessage(raw, profile = null, nowMs = Date.now()) {
    let message;
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_error) {
      return null;
    }
    if (!message || typeof message !== 'object') return null;
    if (message.type !== 'data' || message.topicType !== 'trading_activity') {
      return { kind: 'control', type: String(message.type || '') };
    }
    const payload = normalizeTradingActivity(message.payload, profile, nowMs);
    return payload ? { kind: 'alert', payload } : null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      compactNumber,
      definedChainName,
      formatAge,
      formatUsd,
      normalizeTradingActivity,
      parseFomoSocketMessage,
      profileAddressForChain
    };
    return;
  }

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== 'function' || window.__walletConvergenceFomoWsBridgeInstalled) return;
  window.__walletConvergenceFomoWsBridgeInstalled = true;

  const profileCache = new Map();
  const profileRequests = new Map();
  const emittedKeys = new Set();
  const intentionallyClosedSockets = new WeakSet();
  let latestJwt = '';
  let latestUserId = '';
  let directSocket = null;
  let reconnectTimer = null;
  let connectWatchdogTimer = null;
  let reconnectAttempts = 0;
  let shuttingDown = false;
  let consumerReady = false;
  let latestState = { status: 'waiting_for_session', at: Date.now() };
  const pendingPayloads = [];

  function emitState(status, detail = {}) {
    latestState = { status, at: Date.now(), ...detail };
    if (consumerReady) {
      window.dispatchEvent(new CustomEvent(FOMO_WSS_STATE, { detail: latestState }));
    }
  }

  function dispatchPayload(payload) {
    window.dispatchEvent(new CustomEvent(FOMO_WSS_EVENT, { detail: payload }));
  }

  function emitPayload(payload) {
    if (!payload?.stableKey || emittedKeys.has(payload.stableKey)) return;
    emittedKeys.add(payload.stableKey);
    if (emittedKeys.size > 2000) {
      const keep = Array.from(emittedKeys).slice(-1000);
      emittedKeys.clear();
      keep.forEach((key) => emittedKeys.add(key));
    }
    if (!consumerReady) {
      pendingPayloads.push(payload);
      if (pendingPayloads.length > PENDING_EVENT_LIMIT) pendingPayloads.shift();
      return;
    }
    dispatchPayload(payload);
  }

  async function fetchProfile(userId) {
    const normalizedId = String(userId || '').trim();
    if (!normalizedId || !latestJwt) return null;
    if (profileCache.has(normalizedId)) return profileCache.get(normalizedId);
    if (profileRequests.has(normalizedId)) return profileRequests.get(normalizedId);
    const request = fetch(`${FOMO_API_ORIGIN}/v2/users/${encodeURIComponent(normalizedId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${latestJwt}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then(async (response) => {
      if (!response.ok) return null;
      const body = await response.json();
      const profile = body?.responseObject || null;
      if (profile) {
        profileCache.set(normalizedId, profile);
        if (profileCache.size > PROFILE_CACHE_LIMIT) {
          profileCache.delete(profileCache.keys().next().value);
        }
      }
      return profile;
    }).catch(() => null).finally(() => {
      profileRequests.delete(normalizedId);
    });
    profileRequests.set(normalizedId, request);
    return request;
  }

  async function handleDataMessage(message) {
    // Record the WSS arrival before profile enrichment. A slow profile request
    // must not make an old notification eligible for speech.
    const receivedAt = Date.now();
    const activity = message?.payload;
    const userId = String(activity?.userId || '').trim();
    const profile = userId ? await fetchProfile(userId) : null;
    const parsed = parseFomoSocketMessage(message, profile, receivedAt);
    if (parsed?.kind === 'alert') emitPayload(parsed.payload);
  }

  function clearReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function clearConnectWatchdog() {
    if (connectWatchdogTimer) clearTimeout(connectWatchdogTimer);
    connectWatchdogTimer = null;
  }

  function scheduleReconnect() {
    if (shuttingDown || reconnectTimer || !latestJwt || !latestUserId) return;
    const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempts, 5)));
    reconnectAttempts += 1;
    emitState('reconnecting', { retryInMs: delay });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectDedicatedSocket();
    }, delay);
  }

  function closeDedicatedSocket() {
    clearReconnect();
    clearConnectWatchdog();
    if (directSocket) {
      const socket = directSocket;
      directSocket = null;
      try {
        intentionallyClosedSockets.add(socket);
        socket.close(1000, 'restart');
      } catch (_error) {
        // Socket may already be closed.
      }
    }
  }

  function restartDedicatedSocket(reason) {
    clearConnectWatchdog();
    const socket = directSocket;
    directSocket = null;
    if (socket) {
      try {
        intentionallyClosedSockets.add(socket);
        socket.close(4000, reason);
      } catch (_error) {
        // Socket may already be closed.
      }
    }
    emitState('error', { message: reason });
    scheduleReconnect();
  }

  function connectDedicatedSocket() {
    if (!latestJwt || !latestUserId || directSocket) return;
    emitState('connecting');
    const socket = new NativeWebSocket(FOMO_WS_URL);
    directSocket = socket;
    connectWatchdogTimer = setTimeout(() => {
      if (directSocket === socket) restartDedicatedSocket('connect_timeout');
    }, WSS_CONNECT_TIMEOUT_MS);

    socket.addEventListener('open', () => {
      emitState('authenticating');
    });
    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data || ''));
      } catch (_error) {
        return;
      }
      if (message.type === 'challenge') {
        socket.send(JSON.stringify({ type: 'challengeResponse', jwt: latestJwt }));
        return;
      }
      if (message.type === 'challengeAccepted') {
        socket.send(JSON.stringify({
          type: 'subscribe',
          topicType: 'trading_activity',
          topicId: latestUserId
        }));
        return;
      }
      if (message.type === 'subscribed' && message.topicType === 'trading_activity') {
        clearConnectWatchdog();
        reconnectAttempts = 0;
        emitState('ready', { topicId: latestUserId });
        return;
      }
      if (message.type === 'data' && message.topicType === 'trading_activity') {
        handleDataMessage(message);
        return;
      }
      if (message.type === 'error') {
        restartDedicatedSocket(String(message.code || message.message || 'server_error'));
      }
    });
    socket.addEventListener('close', () => {
      if (directSocket === socket) clearConnectWatchdog();
      if (intentionallyClosedSockets.has(socket)) {
        intentionallyClosedSockets.delete(socket);
        return;
      }
      if (directSocket === socket) directSocket = null;
      if (!shuttingDown) scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      emitState('error', { message: 'socket_error' });
    });
  }

  function updateCredentials(nextJwt, nextUserId) {
    const jwt = String(nextJwt || '').trim();
    const userId = String(nextUserId || '').trim();
    const jwtChanged = jwt && jwt !== latestJwt;
    const userChanged = userId && userId !== latestUserId;
    if (jwt) latestJwt = jwt;
    if (userId) latestUserId = userId;
    if (!latestJwt || !latestUserId) return;
    if (userChanged || (jwtChanged && directSocket)) {
      closeDedicatedSocket();
    }
    connectDedicatedSocket();
  }

  function inspectFomoSocketSend(socket, data) {
    if (String(socket?.url || '') !== FOMO_WS_URL || typeof data !== 'string') return;
    let message;
    try {
      message = JSON.parse(data);
    } catch (_error) {
      return;
    }
    if (message.type === 'challengeResponse' && message.jwt) {
      updateCredentials(message.jwt, '');
      return;
    }
    if (message.type === 'subscribe' && message.topicType === 'trading_activity' && message.topicId) {
      updateCredentials('', message.topicId);
    }
  }

  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args) {
      const socket = Reflect.construct(Target, args);
      if (String(socket.url || '') === FOMO_WS_URL) {
        const nativeSend = socket.send;
        socket.send = function send(data) {
          inspectFomoSocketSend(socket, data);
          return nativeSend.call(socket, data);
        };
      }
      return socket;
    }
  });

  window.addEventListener(FOMO_WSS_READY, () => {
    if (consumerReady) return;
    consumerReady = true;
    window.dispatchEvent(new CustomEvent(FOMO_WSS_STATE, { detail: latestState }));
    pendingPayloads.splice(0).forEach(dispatchPayload);
  });
  window.addEventListener('pagehide', () => {
    shuttingDown = true;
    clearConnectWatchdog();
    closeDedicatedSocket();
  }, { once: true });
  emitState('waiting_for_session');
})();
