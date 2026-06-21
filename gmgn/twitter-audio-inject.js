(function () {
  if (window.__gmgnTwitterAudioInjectLoaded) return;
  window.__gmgnTwitterAudioInjectLoaded = true;
  const OriginalWebSocket = window.WebSocket;
  const DEBUG_PREFIX = '[GMGN Twitter Inject]';
  const REMARK_CACHE_KEY = 'x-user-remark-cache';
  const REMARK_CACHE_TTL_MS = 5000;
  let cachedRemarkMap = null;
  let cachedRemarkMapAt = 0;

  logInfo('Installed WebSocket hook.');

  window.__GMGN_TWITTER_AUDIO_ENABLED = true;
  window.addEventListener('GMGN_TWITTER_AUDIO_TOGGLE', (event) => {
    window.__GMGN_TWITTER_AUDIO_ENABLED = Boolean(event.detail && event.detail.enabled);
  });

  window.WebSocket = function WrappedWebSocket(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    logInfo('Observed WebSocket creation.', { url: String(url || '') });

    ws.addEventListener('message', (event) => {
      if (!window.__GMGN_TWITTER_AUDIO_ENABLED) return;
      if (typeof event.data !== 'string') return;
      if (!event.data.includes('twitter_user_monitor_basic')) return;
      logInfo('Matched twitter websocket frame.', { size: event.data.length });

      try {
        let payload = event.data.replace(/^\d+/, '');
        if (!payload) return;

        let parsed = JSON.parse(payload);
        if (Array.isArray(parsed) && parsed.length >= 2) parsed = parsed[1];
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);

        if (!parsed || parsed.channel !== 'twitter_user_monitor_basic' || !Array.isArray(parsed.data)) {
          return;
        }

        const triggers = [];
        const seenTriggerKeys = new Set();
        for (const tweetData of parsed.data) {
          try {
            if (!tweetData || !tweetData.u || !tweetData.u.s) continue;
            const username = String(tweetData.u.s || '').trim();
            const userId = String(
              tweetData.u.user_id
              || tweetData.u.uid
              || tweetData.u.id
              || tweetData.u.i
              || ''
            ).trim();
            const sourceRemark = (
              tweetData.u.r
              || tweetData.u.remark
              || tweetData.u.note
              || tweetData.u.memo
              || ''
            );
            const cachedRemark = sourceRemark
              ? ''
              : safeResolveRemarkFromLocalCache({ userId, username });
            const trigger = {
              id: username,
              username,
              userId,
              tweetId: extractTweetId(tweetData),
              name: tweetData.u.n || username,
              remark: typeof sourceRemark === 'string' && sourceRemark.trim()
                ? sourceRemark.trim()
                : cachedRemark,
              tw: tweetData.tw || 'other',
              text: extractTweetText(tweetData),
              url: extractTweetUrl(tweetData),
              ts: extractTweetTimestamp(tweetData)
            };
            const triggerKey = [
              trigger.id,
              trigger.tw,
              trigger.tweetId || trigger.ts || ''
            ].join('|');
            if (seenTriggerKeys.has(triggerKey)) continue;
            seenTriggerKeys.add(triggerKey);
            triggers.push(trigger);
          } catch (error) {
            logWarn('Failed to build one twitter trigger.', error && error.message ? error.message : error);
          }
        }

        if (triggers.length > 0) {
          logInfo('Dispatching twitter triggers.', {
            count: triggers.length,
            preview: triggers.slice(0, 5).map((trigger) => ({
              id: trigger.id || '',
              remark: trigger.remark || '',
              username: trigger.username || '',
              name: trigger.name || '',
              action: trigger.tw || '',
              tweetId: trigger.tweetId || '',
              text: trigger.text || ''
            }))
          });
          window.dispatchEvent(new CustomEvent('TWITTER_WS_MSG_RECEIVED', {
            detail: {
              triggers
            }
          }));
        }
      } catch (_error) {
        logWarn('Failed to parse twitter websocket payload.', _error && _error.message ? _error.message : _error);
        return;
      }
    });

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;

  function logInfo(message, detail) {
    const prefix = `${DEBUG_PREFIX} ${formatLogTimestamp()}`;
    if (detail === undefined) {
      console.warn(prefix, message);
      return;
    }
    console.warn(prefix, message, detail);
  }

  function logWarn(message, detail) {
    const prefix = `${DEBUG_PREFIX} ${formatLogTimestamp()}`;
    if (detail === undefined) {
      console.error(prefix, message);
      return;
    }
    console.error(prefix, message, detail);
  }

  function formatLogTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function resolveRemarkFromLocalCache({ userId, username }) {
    const cache = getRemarkCache();
    if (!cache) return '';

    if (userId) {
      const direct = cache[`${userId}@0`] || findRemarkEntryByUserId(cache, userId);
      const remark = normalizeRemark(direct && direct.remark);
      if (remark) return remark;
    }

    if (username) {
      const direct = findRemarkEntryByHandle(cache, username);
      const remark = normalizeRemark(direct && direct.remark);
      if (remark) return remark;
    }

    return '';
  }

  function safeResolveRemarkFromLocalCache({ userId, username }) {
    try {
      return resolveRemarkFromLocalCache({ userId, username });
    } catch (error) {
      logWarn('Failed to resolve remark from local cache.', {
        userId,
        username,
        error: error && error.message ? error.message : String(error)
      });
      return '';
    }
  }

  function getRemarkCache() {
    const now = Date.now();
    if (cachedRemarkMap && (now - cachedRemarkMapAt) < REMARK_CACHE_TTL_MS) {
      return cachedRemarkMap;
    }

    try {
      const raw = localStorage.getItem(REMARK_CACHE_KEY);
      cachedRemarkMap = raw ? JSON.parse(raw) : {};
      cachedRemarkMapAt = now;
      return cachedRemarkMap;
    } catch (_error) {
      cachedRemarkMap = {};
      cachedRemarkMapAt = now;
      return cachedRemarkMap;
    }
  }

  function findRemarkEntryByUserId(cache, userId) {
    for (const [key, entry] of Object.entries(cache || {})) {
      if (key === `${userId}@0`) return entry;
      if (String(entry && entry.user_id || '').trim() === userId) return entry;
    }
    return null;
  }

  function findRemarkEntryByHandle(cache, username) {
    const normalizedUsername = normalizeHandle(username);
    for (const entry of Object.values(cache || {})) {
      if (normalizeHandle(entry && entry.handle) === normalizedUsername) {
        return entry;
      }
    }
    return null;
  }

  function normalizeHandle(value) {
    return String(value || '').trim().toLowerCase().replace(/^@/, '');
  }

  function normalizeRemark(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function extractTweetId(tweetData) {
    const candidates = [
      tweetData && tweetData.id,
      tweetData && tweetData.tid,
      tweetData && tweetData.twid,
      tweetData && tweetData.tweet_id,
      tweetData && tweetData.status_id,
      tweetData && tweetData.t && tweetData.t.id,
      tweetData && tweetData.tweet && tweetData.tweet.id
    ];

    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (value) return value;
    }
    return '';
  }

  function extractTweetText(tweetData) {
    const directCandidates = [
      tweetData && tweetData.text,
      tweetData && tweetData.txt,
      tweetData && tweetData.content,
      tweetData && tweetData.desc,
      tweetData && tweetData.body,
      tweetData && tweetData.message,
      tweetData && tweetData.t && tweetData.t.text,
      tweetData && tweetData.t && tweetData.t.full_text,
      tweetData && tweetData.tweet && tweetData.tweet.text,
      tweetData && tweetData.tweet && tweetData.tweet.full_text,
      tweetData && tweetData.target_tweet && tweetData.target_tweet.text,
      tweetData && tweetData.target_tweet && tweetData.target_tweet.full_text
    ];

    for (const candidate of directCandidates) {
      const normalized = typeof candidate === 'string' ? candidate.trim() : '';
      if (normalized) return normalized;
    }

    return '';
  }

  function extractTweetUrl(tweetData) {
    const candidates = [
      tweetData && tweetData.url,
      tweetData && tweetData.link,
      tweetData && tweetData.t && tweetData.t.url,
      tweetData && tweetData.tweet && tweetData.tweet.url
    ];

    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (value) return value;
    }
    return '';
  }

  function extractTweetTimestamp(tweetData) {
    const candidates = [
      tweetData && tweetData.ts,
      tweetData && tweetData.time,
      tweetData && tweetData.created_at,
      tweetData && tweetData.t && tweetData.t.ts,
      tweetData && tweetData.tweet && tweetData.tweet.created_at
    ];

    for (const candidate of candidates) {
      const timestamp = Number(candidate);
      if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    }
    return null;
  }
})();
