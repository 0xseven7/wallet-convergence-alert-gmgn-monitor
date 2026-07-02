(function () {
  'use strict';

  if (window.__gmgnTwitterAudioContentLoaded) return;
  window.__gmgnTwitterAudioContentLoaded = true;

  const BUILTIN_AUDIO_FILES = ['default.MP3', 'preset1.MP3', 'elonmusk.MP3', 'CZ.MP3', 'heyi.MP3'];
  const GENERIC_AUDIO_FILES = new Set(['default.MP3', 'preset1.MP3']);
  const DEFAULT_TTS_VOICE = 'zh-CN-XiaoxiaoNeural';
  const DEFAULT_TTS_RATE = '+0%';
  const DEFAULT_TTS_PITCH = '+0%';
  const TTS_VOICE_OPTIONS = new Set([
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunjianNeural',
    'zh-CN-XiaoyiNeural',
    'en-US-AvaMultilingualNeural'
  ]);
  const TTS_RATE_OPTIONS = new Set(['-10%', '+0%', '+15%', '+30%']);
  const TTS_PITCH_OPTIONS = new Set(['-5%', '+0%', '+5%']);
  const DEFAULT_TTS_API = 'http://tts.macmini.lan/tts/v3-task';
  const STORAGE_KEYS = [
    'twitterAudioMappings',
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
  ];
  const AUDIO_SYNC_CHANNEL_NAME = 'gmgn_twitter_audio_sync_channel';
  const FETCH_TWITTER_TTS_AUDIO_MESSAGE = 'fetch-twitter-tts-audio';
  const DEBUG_PREFIX = '[GMGN Twitter Audio]';
  const AUDIO_PLAY_TIMEOUT_MS = 8000;
  const TTS_FETCH_TIMEOUT_MS = 10000;
  const NATIVE_TTS_TIMEOUT_MS = 10000;
  const TTS_FAILURE_COOLDOWN_MS = 60000;
  const MAX_AUDIO_VOLUME = 2;
  const DEFAULT_STATE = {
    mappings: {
      elonmusk: { id: 'elonmusk.MP3', name: 'elonmusk.MP3', remark: '' },
      cz_binance: { id: 'CZ.MP3', name: 'CZ.MP3', remark: '' },
      heyibinance: { id: 'heyi.MP3', name: 'heyi.MP3', remark: '' }
    },
    customAudios: {},
    isMasterEnabled: true,
    globalVolume: 1,
    defaultAudio: 'default.MP3',
    playDefaultUnmapped: true,
    enableTTS: true,
    ttsVoice: DEFAULT_TTS_VOICE,
    ttsRate: DEFAULT_TTS_RATE,
    ttsPitch: DEFAULT_TTS_PITCH,
    ttsApiUrl: DEFAULT_TTS_API,
    eventFilters: {
      tweet: true,
      repost: true,
      reply: true,
      quote: true,
      other: true
    }
  };

  let config = { ...DEFAULT_STATE };
  let pendingEvents = [];
  let isReady = false;
  let isLockedByOtherTab = false;
  let globalLastPlayTime = 0;
  const lastPlayTime = new Map();
  const preloadedAudios = new Map();
  const networkTtsCache = new Map();
  const audioSyncChannel = new BroadcastChannel(AUDIO_SYNC_CHANNEL_NAME);
  let mediaPlaybackCtx = null;
  let playbackQueue = Promise.resolve();
  let lastSkipReason = '';
  let lastSkipAt = 0;
  let networkTtsCooldownUntil = 0;
  let lastNetworkTtsFailure = '';

  publishTwitterAudioDebugState();
  void loadConfig();

  window.addEventListener('TWITTER_WS_MSG_RECEIVED', handleTwitterMessage);
  chrome.storage.onChanged.addListener(handleStorageChanges);
  window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') {
      logInfo('Twitter audio tab became active.');
    }
  });

  audioSyncChannel.onmessage = (event) => {
    if (event.data !== 'PLAYING_AUDIO') return;
    isLockedByOtherTab = true;
    setTimeout(() => {
      isLockedByOtherTab = false;
    }, 2200);
  };

  window.addEventListener('pagehide', () => {
    audioSyncChannel.close();
    preloadedAudios.forEach((audio) => {
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (_error) {
        return;
      }
    });
    preloadedAudios.clear();
    networkTtsCache.forEach((url) => {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    networkTtsCache.clear();
  }, { once: true });

  function isPrimaryPlaybackTab() {
    return document.visibilityState === 'visible';
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

  function maybeLogSkip(reason, detail) {
    const now = Date.now();
    if (lastSkipReason === reason && (now - lastSkipAt) < 5000) return;
    lastSkipReason = reason;
    lastSkipAt = now;
    logInfo(reason, detail);
  }

  function publishTwitterAudioDebugState() {
    window.__gmgnTwitterAudioDebug = {
      ttsApiUrl: config.ttsApiUrl,
      ttsVoice: config.ttsVoice,
      ttsRate: config.ttsRate,
      ttsPitch: config.ttsPitch,
      enableTTS: config.enableTTS,
      defaultAudio: config.defaultAudio,
      globalVolume: config.globalVolume,
      playDefaultUnmapped: config.playDefaultUnmapped,
      mappingCount: Object.keys(config.mappings || {}).length,
      customAudioCount: Object.keys(config.customAudios || {}).length,
      networkTtsCooldownUntil,
      lastNetworkTtsFailure
    };
  }

  async function loadConfig() {
    let stored = {};
    try {
      stored = await chrome.storage.local.get(STORAGE_KEYS);
    } catch (error) {
      logWarn('Failed to load twitter audio config, using defaults.', error && error.message ? error.message : error);
    }
    config = normalizeConfig(stored);
    publishTwitterAudioDebugState();
    warmupAudioCache();
    dispatchToggleState();
    isReady = true;

    if (pendingEvents.length > 0) {
      const queue = pendingEvents;
      pendingEvents = [];
      queue.forEach(processTwitterTriggers);
    }
  }

  function handleStorageChanges(changes, areaName) {
    if (areaName !== 'local') return;
    if (!STORAGE_KEYS.some((key) => key in changes)) return;
    void loadConfig();
  }

  function handleTwitterMessage(event) {
    void handleTwitterMessageAsync(event);
  }

  async function handleTwitterMessageAsync(event) {
    if (!config.isMasterEnabled) return;
    if (isLockedByOtherTab) {
      maybeLogSkip('Skipped twitter audio because another tab is already playing.');
      return;
    }
    const triggers = event.detail && Array.isArray(event.detail.triggers) ? event.detail.triggers : [];
    if (triggers.length === 0) return;
    console.warn(`[GMGN Twitter Receive] ${formatLogTimestamp()}`, {
      count: triggers.length,
      preview: triggers.slice(0, 5).map((trigger) => ({
        id: trigger.id || '',
        remark: trigger.remark || '',
        username: trigger.username || '',
        name: trigger.name || '',
        action: trigger.tw || ''
      }))
    });
    logInfo('Received twitter triggers.', {
      count: triggers.length,
      visible: isPrimaryPlaybackTab(),
      preview: triggers.slice(0, 3).map((trigger) => ({
        id: trigger.id,
        username: trigger.username || '',
        name: trigger.name || '',
        remark: trigger.remark || '',
        action: trigger.tw || ''
      }))
    });
    triggers.forEach((trigger, index) => {
      logInfo(`Trigger[${index}]`, {
        id: trigger.id || '',
        remark: trigger.remark || '',
        username: trigger.username || '',
        name: trigger.name || '',
        action: trigger.tw || ''
      });
    });

    if (!isPrimaryPlaybackTab()) {
      maybeLogSkip('Skipped twitter audio because this tab is not visible.');
      return;
    }

    if (!isReady) {
      pendingEvents.push(triggers);
      return;
    }

    processTwitterTriggers(triggers);
  }

  function processTwitterTriggers(triggers) {
    const now = Date.now();
    pruneLastPlayTime(now);
    const queuedPlaybacks = [];

    for (const trigger of triggers) {
      if (!trigger || typeof trigger.id !== 'string') continue;

      const twitterId = normalizeTwitterId(trigger.id);
      const actionType = normalizeEventType(trigger.tw);
      const filterBucket = getEventFilterBucket(actionType);
      if (!config.eventFilters[filterBucket]) continue;

      const dedupeKey = `${twitterId}|${actionType}`;
      if (lastPlayTime.has(dedupeKey) && (now - lastPlayTime.get(dedupeKey)) < 2500) {
        continue;
      }
      lastPlayTime.set(dedupeKey, now);

      const mappedRule = config.mappings[twitterId];
      if (mappedRule) {
        const mappedPlayback = buildMappedPlayback(trigger, mappedRule);
        if (mappedPlayback) {
          queuedPlaybacks.push(mappedPlayback);
        }
        continue;
      }

      if (!config.playDefaultUnmapped) {
        continue;
      }

      queuedPlaybacks.push(buildFallbackPlayback(trigger));
    }

    if (queuedPlaybacks.length === 0) {
      return;
    }

    logInfo('Queueing twitter audio playbacks.', { count: queuedPlaybacks.length });
    for (const playback of queuedPlaybacks) {
      enqueuePlayback(playback);
    }
  }

  function enqueuePlayback(playback) {
    playbackQueue = playbackQueue
      .then(async () => {
        if (!isPrimaryPlaybackTab()) {
          maybeLogSkip('Skipped queued playback because this tab is not visible anymore.');
          return;
        }

        globalLastPlayTime = Date.now();
        audioSyncChannel.postMessage('PLAYING_AUDIO');
        await executePlayback(playback);
        await sleep(120);
      })
      .catch((error) => {
        logWarn('Twitter playback queue failed.', error && error.message ? error.message : error);
      });
  }

  function buildMappedPlayback(trigger, rule) {
    const audioId = normalizeAudioId(rule.id);
    const speakerName = getSpeakerName(trigger, rule);

    if (config.customAudios[audioId]) {
      logInfo('Using custom mapped audio instead of network TTS.', {
        twitterId: trigger?.id || '',
        audioId
      });
      return {
        audioSrc: getCustomAudioSource(config.customAudios[audioId]),
        ttsText: ''
      };
    }

    if (audioId.startsWith('custom_')) {
      logInfo('Using fallback audio for missing custom mapping instead of network TTS.', {
        twitterId: trigger?.id || '',
        audioId,
        fallbackAudio: config.defaultAudio
      });
      return {
        audioSrc: getBuiltInAudioUrl(config.defaultAudio),
        ttsText: ''
      };
    }

    if (GENERIC_AUDIO_FILES.has(audioId) && config.enableTTS) {
      logInfo('Using mapped generic audio as network TTS trigger.', {
        twitterId: trigger?.id || '',
        audioId,
        ttsApiUrl: config.ttsApiUrl
      });
      return {
        audioSrc: null,
        ttsText: buildTwitterTtsText(speakerName, normalizeEventType(trigger.tw))
      };
    }

    logInfo('Using mapped MP3 instead of network TTS.', {
      twitterId: trigger?.id || '',
      audioId
    });
    return {
      audioSrc: getBuiltInAudioUrl(audioId),
      ttsText: ''
    };
  }

  function buildFallbackPlayback(trigger) {
    const speakerName = getSpeakerName(trigger, null);
    if (config.enableTTS) {
      return {
        audioSrc: null,
        ttsText: buildTwitterTtsText(speakerName, normalizeEventType(trigger.tw))
      };
    }

    return {
      audioSrc: getBuiltInAudioUrl(config.defaultAudio),
      ttsText: ''
    };
  }

  async function executePlayback(playback) {
    if (!isPrimaryPlaybackTab()) {
      maybeLogSkip('Skipped playback right before output because the tab is no longer visible.');
      return;
    }

    logInfo('Starting twitter audio playback.', {
      audioSrc: playback.audioSrc ? 'audio' : '',
      ttsText: playback.ttsText || '',
      ttsApiUrl: playback.ttsText ? normalizeTtsApiUrl(config.ttsApiUrl) : ''
    });

    if (playback.audioSrc) {
      await playAudio(playback.audioSrc, config.globalVolume);
    }

    if (playback.ttsText) {
      await playNetworkTts(playback.ttsText);
    }
  }

  async function playAudio(source, volume) {
    let player = null;
    const cachedAudio = preloadedAudios.get(source);
    if (cachedAudio && cachedAudio.readyState >= 2) {
      player = cachedAudio.cloneNode(true);
    } else {
      player = new Audio(source);
    }

    const cleanupBoost = attachAudioBoost(player, volume);
    return new Promise(async (resolve) => {
      let settled = false;
      let timeoutId = null;
      const finalize = (ok, reason, detail) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if (!ok && reason) {
          logWarn(reason, detail);
        }
        cleanupBoost();
        cleanupAudio(player);
        resolve(!!ok);
      };
      player.addEventListener('ended', () => finalize(true), { once: true });
      player.addEventListener('error', () => {
        finalize(false, 'Audio element failed during playback.', {
          source: describeAudioSource(source),
          code: player.error && player.error.code,
          message: player.error && player.error.message
        });
      }, { once: true });
      timeoutId = setTimeout(() => {
        finalize(false, 'Audio playback timed out.', describeAudioSource(source));
      }, AUDIO_PLAY_TIMEOUT_MS);

      try {
        await player.play();
      } catch (_error) {
        finalize(false, 'Audio playback failed to start.', _error && _error.message ? _error.message : _error);
      }
    });
  }

  function describeAudioSource(source) {
    const text = String(source || '');
    if (text.startsWith('blob:')) return 'blob-audio';
    if (text.startsWith('data:')) return `data-audio:${text.slice(0, 32)}`;
    if (text.startsWith('chrome-extension://')) return text.split('/').slice(-2).join('/');
    return text.slice(0, 160);
  }

  function cleanupAudio(player) {
    try {
      player.pause();
      player.removeAttribute('src');
      player.load();
    } catch (_error) {
      return;
    }
  }

  function ensureMediaPlaybackCtx() {
    if (mediaPlaybackCtx) return mediaPlaybackCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      mediaPlaybackCtx = new Ctx();
      return mediaPlaybackCtx;
    } catch (_error) {
      return null;
    }
  }

  function attachAudioBoost(player, rawVolume) {
    const volume = clampVolume(rawVolume);
    player.volume = Math.min(volume, 1);
    if (volume <= 1) {
      return () => {};
    }

    const ctx = ensureMediaPlaybackCtx();
    if (!ctx) {
      return () => {};
    }

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const sourceNode = ctx.createMediaElementSource(player);
      const gainNode = ctx.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = volume;
      return () => {
        try { sourceNode.disconnect(); } catch (_error) {}
        try { gainNode.disconnect(); } catch (_error) {}
      };
    } catch (_error) {
      return () => {};
    }
  }

  async function playNetworkTts(text) {
    const ttsApiUrl = normalizeTtsApiUrl(config.ttsApiUrl);
    const cacheKey = JSON.stringify([ttsApiUrl, text, config.ttsVoice, config.ttsRate, config.ttsPitch]);
    let timeoutId = null;
    if (Date.now() < networkTtsCooldownUntil) {
      logWarn('Skipping network TTS during failure cooldown, using native speech synthesis.', {
        ttsApiUrl,
        until: new Date(networkTtsCooldownUntil).toLocaleTimeString(),
        lastError: lastNetworkTtsFailure,
        text
      });
      await playNativeOrEmergencyTts(text, 'Network TTS is in failure cooldown.');
      return;
    }

    try {
      if (networkTtsCache.has(cacheKey)) {
        logInfo('Playing network TTS from cache.', {
          ttsApiUrl,
          text
        });
        const playedFromCache = await playAudio(networkTtsCache.get(cacheKey), Math.min(config.globalVolume * 1.25, 1));
        if (playedFromCache) {
          markNetworkTtsHealthy();
          return;
        }
        networkTtsCache.delete(cacheKey);
      }

      logInfo('Requesting network TTS.', {
        ttsApiUrl,
        voice: config.ttsVoice,
        rate: config.ttsRate,
        pitch: config.ttsPitch,
        text
      });
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);
      const ttsResponse = await fetchNetworkTtsThroughBackground(ttsApiUrl, text);
      logInfo('Network TTS response received.', {
        ttsApiUrl,
        type: ttsResponse.contentType || '',
        size: ttsResponse.size || 0,
        text
      });
      networkTtsCache.set(cacheKey, ttsResponse.dataUrl);
      const played = await playAudio(ttsResponse.dataUrl, Math.min(config.globalVolume * 1.25, 1));
      if (!played) {
        throw new Error('Network TTS audio could not be played');
      }
      markNetworkTtsHealthy();
    } catch (_error) {
      lastNetworkTtsFailure = _error && _error.message ? _error.message : String(_error);
      networkTtsCooldownUntil = Date.now() + TTS_FAILURE_COOLDOWN_MS;
      publishTwitterAudioDebugState();
      logWarn('Network TTS failed, falling back to native speech synthesis.', {
        ttsApiUrl,
        error: lastNetworkTtsFailure,
        cooldownMs: TTS_FAILURE_COOLDOWN_MS
      });
      await playNativeOrEmergencyTts(text, 'Native TTS unavailable after network TTS failure.');
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  function markNetworkTtsHealthy() {
    if (!networkTtsCooldownUntil && !lastNetworkTtsFailure) return;
    networkTtsCooldownUntil = 0;
    lastNetworkTtsFailure = '';
    publishTwitterAudioDebugState();
  }

  async function playNativeOrEmergencyTts(text, emergencyReason) {
    const nativePlayed = await fallbackNativeTts(text);
    if (!nativePlayed) {
      await playEmergencyAudioCue(emergencyReason);
    }
  }

  async function fetchNetworkTtsThroughBackground(ttsApiUrl, text) {
    const response = await chrome.runtime.sendMessage({
      type: FETCH_TWITTER_TTS_AUDIO_MESSAGE,
      payload: {
        text,
        ttsApiUrl,
        voice: config.ttsVoice,
        rate: config.ttsRate,
        pitch: config.ttsPitch
      }
    });
    if (!response || !response.ok || !response.dataUrl) {
      throw new Error(response && response.error ? response.error : 'Background TTS fetch failed.');
    }
    return response;
  }

  function fallbackNativeTts(text) {
    if (!('speechSynthesis' in window)) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        let settled = false;
        let timeoutId = null;
        let started = false;
        const finalize = (ok) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          resolve(!!ok);
        };
        utterance.lang = 'zh-CN';
        utterance.rate = speechSynthesisRateFromConfig(config.ttsRate);
        utterance.pitch = speechSynthesisPitchFromConfig(config.ttsPitch);
        utterance.volume = Math.min(config.globalVolume * 1.25, 1);
        utterance.addEventListener('start', () => {
          started = true;
          logInfo('Native speech synthesis started.', { text });
        }, { once: true });
        utterance.addEventListener('end', () => finalize(true), { once: true });
        utterance.addEventListener('error', (event) => {
          logWarn('Native speech synthesis failed.', event && event.error ? event.error : text);
          finalize(started);
        }, { once: true });
        timeoutId = setTimeout(() => {
          logWarn('Native speech synthesis timed out.', text);
          try {
            window.speechSynthesis.cancel();
          } catch (_error) {}
          finalize(started);
        }, NATIVE_TTS_TIMEOUT_MS);
        window.speechSynthesis.speak(utterance);
      } catch (_error) {
        logWarn('Native speech synthesis threw.', _error && _error.message ? _error.message : _error);
        resolve(false);
      }
    });
  }

  async function playEmergencyAudioCue(reason) {
    logWarn('Playing fallback alert audio because TTS failed.', reason);
    const source = getBuiltInAudioUrl(config.defaultAudio);
    await playAudio(source, config.globalVolume);
  }

  function warmupAudioCache() {
    preloadedAudios.forEach((audio) => {
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (_error) {
        return;
      }
    });
    preloadedAudios.clear();

    const preloadTargets = new Set();
    preloadTargets.add(getBuiltInAudioUrl(config.defaultAudio));

    Object.values(config.mappings).forEach((rule) => {
      const audioId = normalizeAudioId(rule.id);
      if (config.customAudios[audioId]) {
        preloadTargets.add(getCustomAudioSource(config.customAudios[audioId]));
        return;
      }

      if (BUILTIN_AUDIO_FILES.includes(audioId)) {
        preloadTargets.add(getBuiltInAudioUrl(audioId));
      }
    });

    Object.values(config.customAudios).forEach((audioItem) => {
      preloadTargets.add(getCustomAudioSource(audioItem));
    });

    preloadTargets.forEach((source) => {
      if (!source || preloadedAudios.has(source)) return;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = source;
      audio.load();
      preloadedAudios.set(source, audio);
    });
  }

  function dispatchToggleState() {
    window.dispatchEvent(new CustomEvent('GMGN_TWITTER_AUDIO_TOGGLE', {
      detail: {
        enabled: config.isMasterEnabled
      }
    }));
  }

  function normalizeConfig(raw) {
    const state = {
      mappings: normalizeMappings(raw.twitterAudioMappings || DEFAULT_STATE.mappings),
      customAudios: normalizeCustomAudios(raw.customAudios || {}),
      isMasterEnabled: raw.isMasterEnabled !== false,
      globalVolume: clampVolume(raw.globalVolume),
      defaultAudio: normalizeAudioId(raw.defaultAudio || DEFAULT_STATE.defaultAudio),
      playDefaultUnmapped: raw.playDefaultUnmapped !== false,
      enableTTS: raw.enableTTS !== false,
      ttsVoice: normalizeTtsVoice(raw.ttsVoice),
      ttsRate: normalizeTtsRate(raw.ttsRate),
      ttsPitch: normalizeTtsPitch(raw.ttsPitch),
      ttsApiUrl: normalizeTtsApiUrl(raw.ttsApiUrl),
      eventFilters: {
        tweet: raw.eventFilters?.tweet !== false,
        repost: raw.eventFilters?.repost !== false,
        reply: raw.eventFilters?.reply !== false,
        quote: raw.eventFilters?.quote !== false,
        other: raw.eventFilters?.other !== false
      }
    };

    if (!BUILTIN_AUDIO_FILES.includes(state.defaultAudio)) {
      state.defaultAudio = DEFAULT_STATE.defaultAudio;
    }

    return state;
  }

  function normalizeMappings(mappings) {
    const normalized = {};
    for (const [twitterId, rule] of Object.entries(mappings || {})) {
      const normalizedId = normalizeTwitterId(twitterId);
      if (!normalizedId) continue;
      if (typeof rule === 'string') {
        normalized[normalizedId] = { id: normalizeAudioId(rule), name: normalizeAudioId(rule), remark: '' };
        continue;
      }
      normalized[normalizedId] = {
        id: normalizeAudioId(rule?.id || rule?.name || DEFAULT_STATE.defaultAudio),
        name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim() : normalizeAudioId(rule?.id || DEFAULT_STATE.defaultAudio),
        remark: typeof rule?.remark === 'string' ? rule.remark.trim() : ''
      };
    }
    return normalized;
  }

  function normalizeCustomAudios(customAudios) {
    const normalized = {};
    for (const [customId, audioItem] of Object.entries(customAudios || {})) {
      if (typeof audioItem === 'string') {
        normalized[customId] = {
          name: decodeCustomAudioName(customId),
          data: audioItem
        };
        continue;
      }
      if (!audioItem || typeof audioItem.data !== 'string') continue;
      normalized[customId] = {
        name: typeof audioItem.name === 'string' && audioItem.name.trim() ? audioItem.name.trim() : decodeCustomAudioName(customId),
        data: audioItem.data
      };
    }
    return normalized;
  }

  function getCustomAudioSource(audioItem) {
    return typeof audioItem === 'string' ? audioItem : audioItem.data;
  }

  function getBuiltInAudioUrl(audioId) {
    return chrome.runtime.getURL(`sounds/${normalizeAudioId(audioId)}`);
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

  function getSpeakerName(trigger, rule) {
    const candidates = [trigger?.remark, rule?.remark, trigger?.name, trigger?.username, trigger?.id];
    for (const candidate of candidates) {
      const normalized = sanitizeSpeechName(candidate);
      if (normalized) return normalized;
    }
    return sanitizeSpeechName(trigger?.id) || '';
  }

  function buildTwitterTtsText(name, actionType) {
    if (actionType === 'repost') return `${name}，转推了`;
    if (actionType === 'reply') return `${name}，回复了`;
    if (actionType === 'quote') return `${name}，引用了推文`;
    if (actionType === 'follow') return `${name}，关注了新账号`;
    if (actionType === 'unfollow') return `${name}，取消关注了一个账号`;
    if (actionType === 'delete') return `${name}，删除了一条推文`;
    if (actionType === 'like') return `${name}，点赞了一条推文`;
    if (actionType === 'pin') return `${name}，置顶了一条推文`;
    if (actionType === 'update') return `${name}，更新了账号资料`;
    if (actionType === 'tweet') return `${name}，发推了`;
    if (actionType === 'other') return `${name}，有新的推特动态`;
    return `${name}，有新的推特动态`;
  }

  function normalizeEventType(value) {
    const actionType = String(value || '').trim().toLowerCase();
    if (!actionType) return 'other';
    if (
      actionType === 'delete'
      || actionType === 'deleted'
      || actionType === 'delete_tweet'
      || actionType === 'remove'
      || /删除了这条推文|删除推文|已删除推文|删除|删推|deleted.*tweet/.test(actionType)
    ) {
      return 'delete';
    }
    if (
      actionType === 'tweet'
      || actionType === 'post'
      || actionType === 'new_tweet'
      || actionType === 'create'
      || actionType === 'create_tweet'
      || /发推|新推文|发布推文/.test(actionType)
    ) {
      return 'tweet';
    }
    if (
      actionType === 'repost'
      || actionType === 'retweet'
      || actionType === 'retweeted'
      || /转推|转发/.test(actionType)
    ) {
      return 'repost';
    }
    if (
      actionType === 'reply'
      || actionType === 'replied'
      || /回复/.test(actionType)
    ) {
      return 'reply';
    }
    if (
      actionType === 'quote'
      || actionType === 'quoted'
      || actionType === 'quote_tweet'
      || /引用/.test(actionType)
    ) {
      return 'quote';
    }
    if (
      actionType === 'follow'
      || actionType === 'followed'
      || /关注/.test(actionType)
    ) {
      return 'follow';
    }
    if (
      actionType === 'unfollow'
      || actionType === 'unfollowed'
      || /取消关注|取关/.test(actionType)
    ) {
      return 'unfollow';
    }
    if (
      actionType === 'like'
      || actionType === 'liked'
      || /点赞/.test(actionType)
    ) {
      return 'like';
    }
    if (
      actionType === 'pin'
      || actionType === 'pinned'
      || /置顶/.test(actionType)
    ) {
      return 'pin';
    }
    if (
      actionType === 'update'
      || actionType === 'profile_update'
      || actionType === 'avatar'
      || actionType === 'bio'
      || actionType === 'username'
      || /资料|头像|简介|用户名/.test(actionType)
    ) {
      return 'update';
    }
    return 'other';
  }

  function getEventFilterBucket(actionType) {
    if (actionType === 'tweet') return 'tweet';
    if (actionType === 'delete') return 'tweet';
    if (actionType === 'repost') return 'repost';
    if (actionType === 'reply') return 'reply';
    if (actionType === 'quote') return 'quote';
    return 'other';
  }

  function normalizeTwitterId(value) {
    return String(value || '').trim().toLowerCase().replace(/^@/, '');
  }

  function normalizeAudioId(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return DEFAULT_STATE.defaultAudio;
    const fileName = rawValue.split('/').pop();
    const lowered = fileName.toLowerCase();
    if (lowered === 'cz.mp3') return 'CZ.MP3';
    const matched = BUILTIN_AUDIO_FILES.find((item) => item.toLowerCase() === lowered);
    return matched || rawValue;
  }

  function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(MAX_AUDIO_VOLUME, Math.max(0, numeric));
  }

  function normalizeTtsVoice(value) {
    return TTS_VOICE_OPTIONS.has(value) ? value : DEFAULT_TTS_VOICE;
  }

  function normalizeTtsRate(value) {
    return TTS_RATE_OPTIONS.has(value) ? value : DEFAULT_TTS_RATE;
  }

  function normalizeTtsPitch(value) {
    return TTS_PITCH_OPTIONS.has(value) ? value : DEFAULT_TTS_PITCH;
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

  function buildTtsRequest(ttsApiUrl, text, options = {}) {
    if (usesMacminiTaskTts(ttsApiUrl)) {
      const url = new URL(ttsApiUrl);
      url.searchParams.set('data', text);
      return {
        url: url.toString(),
        options: {
          method: 'GET',
          signal: options.signal
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
        signal: options.signal,
        body: JSON.stringify({
          text,
          voice: options.voice,
          rate: options.rate,
          pitch: options.pitch
        })
      }
    };
  }

  function usesMacminiTaskTts(ttsApiUrl) {
    try {
      const url = new URL(ttsApiUrl);
      return url.hostname === 'tts.macmini.lan' && url.pathname === '/tts/v3-task';
    } catch (_error) {
      return false;
    }
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

  function pruneLastPlayTime(now) {
    if (lastPlayTime.size < 1000) return;
    for (const [key, value] of lastPlayTime) {
      if ((now - value) > 10000) {
        lastPlayTime.delete(key);
      }
    }
  }

  function decodeCustomAudioName(customId) {
    if (!customId.startsWith('custom_file_')) return customId;
    return decodeURIComponent(customId.slice('custom_file_'.length));
  }

  function sleep(delayMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  function formatLogTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
})();
