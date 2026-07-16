const GMGN_AUDIO_SETTINGS_KEY = 'gmgnAudioSettings';
const GMGN_SPEECH_WATCHLIST_KEY = 'gmgnSpeechWatchlist';
const GMGN_BLACKLIST_WALLETS_KEY = 'gmgnBlacklistWallets';
const GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
const GMGN_TWITTER_TRIGGER_RULES_KEY = 'gmgnTwitterTriggerRules';
const BUILTIN_AUDIO_FILES = ['default.MP3', 'preset1.MP3', 'elonmusk.MP3', 'CZ.MP3', 'heyi.MP3'];
const DEFAULT_TTS_API = 'http://tts.macmini.lan/tts/v3-task';
const CLOUDFLARE_TTS_API = 'https://cloudflare-edge-tts.tech-melon.workers.dev/tts';
const DEFAULT_MARKET_WATCH_DESK_BASE_URL = 'http://127.0.0.1:17387';
const DEFAULT_MAIN_SCREEN_RELAY_BASE_URL = 'http://127.0.0.1:17390';
const DEFAULT_TTS_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_TTS_RATE = '+0%';
const DEFAULT_TTS_PITCH = '+0%';
const TTS_API_PRESET_CUSTOM = '__custom__';
const TTS_API_PRESET_CHOICES = [
  { value: DEFAULT_TTS_API, label: 'Mac mini 豆包' },
  { value: CLOUDFLARE_TTS_API, label: 'Cloudflare Worker' },
  { value: TTS_API_PRESET_CUSTOM, label: '自定义地址' }
];
const TTS_VOICE_CHOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓（甜美女声）' },
  { value: 'zh-CN-YunjianNeural', label: '云健（阳光男声）' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊（职业干练）' },
  { value: 'en-US-AvaMultilingualNeural', label: 'Ava（多语种默认）' }
];
const TTS_RATE_CHOICES = [
  { value: '-10%', label: '语速：稍慢' },
  { value: '+0%', label: '语速：正常' },
  { value: '+15%', label: '语速：较快' },
  { value: '+30%', label: '语速：极速' }
];
const TTS_PITCH_CHOICES = [
  { value: '-5%', label: '音调：偏低' },
  { value: '+0%', label: '音调：正常' },
  { value: '+5%', label: '音调：偏高' }
];
const TTS_VOICE_OPTIONS = new Set(TTS_VOICE_CHOICES.map((option) => option.value));
const TTS_RATE_OPTIONS = new Set(TTS_RATE_CHOICES.map((option) => option.value));
const TTS_PITCH_OPTIONS = new Set(TTS_PITCH_CHOICES.map((option) => option.value));
const DEFAULT_GMGN_AUDIO_SETTINGS = {
  enabled: true,
  preset: 'default.MP3',
  ttsEnabled: true,
  volume: 1
};
const DEFAULT_TWITTER_AUDIO_STATE = {
  mappings: {},
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
const DEFAULT_GMGN_SPEECH_WATCHLIST = {};
const DEFAULT_GMGN_BLACKLIST_WALLETS = {};
const GMGN_TWITTER_TRIGGER_EVENT_CHOICES = [
  { value: 'any', label: '任意动作' },
  { value: 'tweet', label: '发推' },
  { value: 'reply', label: '回复' },
  { value: 'repost', label: '转推' },
  { value: 'quote', label: '引用' },
  { value: 'delete', label: '删除推文' },
  { value: 'follow', label: '关注' },
  { value: 'unfollow', label: '取消关注' },
  { value: 'like', label: '点赞' },
  { value: 'pin', label: '置顶' },
  { value: 'update', label: '资料更新' },
  { value: 'other', label: '其他' }
];
const GMGN_TWITTER_TRIGGER_CHAIN_CHOICES = [
  { value: 'bsc', label: 'BSC' },
  { value: 'eth', label: 'ETH' },
  { value: 'base', label: 'BASE' },
  { value: 'sol', label: 'SOL' }
];
const DEFAULT_GMGN_TWITTER_TRIGGER_HOOK_SETTINGS = {
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
const DEFAULT_GMGN_TWITTER_TRIGGER_RULES = [];
const MAX_AUDIO_VOLUME = 2;

const els = {
  toast: document.getElementById('toast'),
  gmgnAudioEnabled: document.getElementById('gmgn-audio-enabled'),
  gmgnAudioTts: document.getElementById('gmgn-audio-tts'),
  gmgnAudioPreset: document.getElementById('gmgn-audio-preset'),
  gmgnAudioVolume: document.getElementById('gmgn-audio-volume'),
  gmgnAudioVolumeValue: document.getElementById('gmgn-audio-volume-value'),
  masterToggle: document.getElementById('masterToggle'),
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  ttsRateSelect: document.getElementById('ttsRateSelect'),
  ttsPitchSelect: document.getElementById('ttsPitchSelect'),
  ttsApiPresetSelect: document.getElementById('ttsApiPresetSelect'),
  ttsApiUrlInput: document.getElementById('ttsApiUrlInput'),
  ttsTestBtn: document.getElementById('ttsTestBtn'),
  globalVolume: document.getElementById('globalVolume'),
  volumePercent: document.getElementById('volumePercent'),
  filterTweet: document.getElementById('filterTweet'),
  filterRepost: document.getElementById('filterRepost'),
  filterReply: document.getElementById('filterReply'),
  filterQuote: document.getElementById('filterQuote'),
  filterOther: document.getElementById('filterOther'),
  speechWatchWalletInput: document.getElementById('speechWatchWallet'),
  speechWatchAliasInput: document.getElementById('speechWatchAlias'),
  addSpeechWatchBtn: document.getElementById('addSpeechWatchBtn'),
  speechWatchList: document.getElementById('speechWatchList'),
  blacklistWalletInput: document.getElementById('blacklistWallet'),
  addBlacklistBtn: document.getElementById('addBlacklistBtn'),
  blacklistList: document.getElementById('blacklistList'),
  gmgnHookEnabled: document.getElementById('gmgnHookEnabled'),
  gmgnHookUrl: document.getElementById('gmgnHookUrl'),
  gmgnHookSecret: document.getElementById('gmgnHookSecret'),
  gmgnHookTimeout: document.getElementById('gmgnHookTimeout'),
  gmgnEventApiEnabled: document.getElementById('gmgnEventApiEnabled'),
  gmgnEventApiUrl: document.getElementById('gmgnEventApiUrl'),
  gmgnEventApiToken: document.getElementById('gmgnEventApiToken'),
  gmgnEventSendWalletTrades: document.getElementById('gmgnEventSendWalletTrades'),
  gmgnEventSendConvergenceAlerts: document.getElementById('gmgnEventSendConvergenceAlerts'),
  gmgnFocusBuysEnabled: document.getElementById('gmgnFocusBuysEnabled'),
  gmgnMarketWatchDeskBaseUrl: document.getElementById('gmgnMarketWatchDeskBaseUrl'),
  gmgnMainScreenRelayBaseUrl: document.getElementById('gmgnMainScreenRelayBaseUrl'),
  saveGmgnRoutingBtn: document.getElementById('saveGmgnRoutingBtn'),
  gmgnDirectCaEnabled: document.getElementById('gmgnDirectCaEnabled'),
  gmgnDirectCaChain: document.getElementById('gmgnDirectCaChain'),
  gmgnDirectCaBuyAmount: document.getElementById('gmgnDirectCaBuyAmount'),
  gmgnDirectCaTwitterIds: document.getElementById('gmgnDirectCaTwitterIds'),
  saveGmgnHookBtn: document.getElementById('saveGmgnHookBtn'),
  gmgnTriggerTwitterId: document.getElementById('gmgnTriggerTwitterId'),
  gmgnTriggerEventType: document.getElementById('gmgnTriggerEventType'),
  gmgnTriggerKeywords: document.getElementById('gmgnTriggerKeywords'),
  gmgnTriggerChain: document.getElementById('gmgnTriggerChain'),
  gmgnTriggerCa: document.getElementById('gmgnTriggerCa'),
  gmgnTriggerTokenSymbol: document.getElementById('gmgnTriggerTokenSymbol'),
  gmgnTriggerBuyAmount: document.getElementById('gmgnTriggerBuyAmount'),
  gmgnTriggerNote: document.getElementById('gmgnTriggerNote'),
  saveGmgnTriggerRuleBtn: document.getElementById('saveGmgnTriggerRuleBtn'),
  cancelGmgnTriggerRuleBtn: document.getElementById('cancelGmgnTriggerRuleBtn'),
  gmgnTriggerRulesList: document.getElementById('gmgnTriggerRulesList')
};
const hasGmgnAudioControls = Boolean(
  els.gmgnAudioEnabled
  && els.gmgnAudioTts
  && els.gmgnAudioPreset
  && els.gmgnAudioVolume
  && els.gmgnAudioVolumeValue
);
const hasGmgnTwitterTriggerHookControls = Boolean(
  els.gmgnHookEnabled
  && els.gmgnHookUrl
  && els.gmgnHookSecret
  && els.gmgnHookTimeout
  && els.gmgnEventApiEnabled
  && els.gmgnEventApiUrl
  && els.gmgnEventApiToken
  && els.gmgnEventSendWalletTrades
  && els.gmgnEventSendConvergenceAlerts
  && els.gmgnFocusBuysEnabled
  && els.gmgnMarketWatchDeskBaseUrl
  && els.gmgnMainScreenRelayBaseUrl
  && els.gmgnDirectCaEnabled
  && els.gmgnDirectCaChain
  && els.gmgnDirectCaBuyAmount
  && els.gmgnDirectCaTwitterIds
  && els.saveGmgnHookBtn
  && els.gmgnTriggerTwitterId
  && els.gmgnTriggerEventType
  && els.gmgnTriggerKeywords
  && els.gmgnTriggerChain
  && els.gmgnTriggerCa
  && els.gmgnTriggerTokenSymbol
  && els.gmgnTriggerBuyAmount
  && els.gmgnTriggerNote
  && els.saveGmgnTriggerRuleBtn
  && els.cancelGmgnTriggerRuleBtn
  && els.gmgnTriggerRulesList
);

let twitterState = { ...DEFAULT_TWITTER_AUDIO_STATE };
let gmgnSpeechWatchlist = { ...DEFAULT_GMGN_SPEECH_WATCHLIST };
let gmgnBlacklistWallets = { ...DEFAULT_GMGN_BLACKLIST_WALLETS };
let gmgnTwitterTriggerHookSettings = { ...DEFAULT_GMGN_TWITTER_TRIGGER_HOOK_SETTINGS };
let gmgnTwitterTriggerRules = [...DEFAULT_GMGN_TWITTER_TRIGGER_RULES];
let editingGmgnTriggerRuleId = null;
let previewAudioCtx = null;

initialize().catch((error) => {
  showToast(error.message || '初始化失败', 4200);
});

async function initialize() {
  if (hasGmgnAudioControls) {
    populateBuiltInSelect(els.gmgnAudioPreset);
  }
  populateChoiceSelect(els.ttsVoiceSelect, TTS_VOICE_CHOICES);
  populateChoiceSelect(els.ttsRateSelect, TTS_RATE_CHOICES);
  populateChoiceSelect(els.ttsPitchSelect, TTS_PITCH_CHOICES);
  populateChoiceSelect(els.ttsApiPresetSelect, TTS_API_PRESET_CHOICES);
  if (hasGmgnTwitterTriggerHookControls) {
    populateChoiceSelect(els.gmgnTriggerEventType, GMGN_TWITTER_TRIGGER_EVENT_CHOICES);
    populateChoiceSelect(els.gmgnTriggerChain, GMGN_TWITTER_TRIGGER_CHAIN_CHOICES);
    populateChoiceSelect(els.gmgnDirectCaChain, GMGN_TWITTER_TRIGGER_CHAIN_CHOICES);
  }
  bindEvents();
  if (hasGmgnTwitterTriggerHookControls) {
    resetGmgnTwitterTriggerRuleForm();
  }

  const tasks = [
    loadTwitterAudioSettings(),
    loadGmgnSpeechWatchlist(),
    loadGmgnBlacklistWallets()
  ];
  if (hasGmgnTwitterTriggerHookControls) {
    tasks.push(loadGmgnTwitterTriggerHookSettings(), loadGmgnTwitterTriggerRules());
  }
  if (hasGmgnAudioControls) {
    tasks.push(loadGmgnAudioSettings());
  }
  await Promise.all(tasks);
  chrome.storage.onChanged.addListener(handleStorageChanges);
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== 'local') return;
  if (changes[GMGN_SPEECH_WATCHLIST_KEY]) {
    gmgnSpeechWatchlist = normalizeGmgnSpeechWatchlist(changes[GMGN_SPEECH_WATCHLIST_KEY].newValue);
    renderGmgnSpeechWatchlist();
  }
  if (changes[GMGN_BLACKLIST_WALLETS_KEY]) {
    gmgnBlacklistWallets = normalizeGmgnBlacklistWallets(changes[GMGN_BLACKLIST_WALLETS_KEY].newValue);
    renderGmgnBlacklistWallets();
  }
  if (hasGmgnTwitterTriggerHookControls && changes[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]) {
    gmgnTwitterTriggerHookSettings = normalizeGmgnTwitterTriggerHookSettings(changes[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY].newValue);
    renderGmgnTwitterTriggerHookSettings();
  }
  if (hasGmgnTwitterTriggerHookControls && changes[GMGN_TWITTER_TRIGGER_RULES_KEY]) {
    gmgnTwitterTriggerRules = normalizeGmgnTwitterTriggerRules(changes[GMGN_TWITTER_TRIGGER_RULES_KEY].newValue);
    renderGmgnTwitterTriggerRules();
  }
}

function bindEvents() {
  if (hasGmgnAudioControls) {
    els.gmgnAudioEnabled.addEventListener('change', persistGmgnAudioSettings);
    els.gmgnAudioTts.addEventListener('change', persistGmgnAudioSettings);
    els.gmgnAudioPreset.addEventListener('change', persistGmgnAudioSettings);
    els.gmgnAudioVolume.addEventListener('input', () => {
      renderGmgnVolumeValue(Number(els.gmgnAudioVolume.value));
    });
    els.gmgnAudioVolume.addEventListener('change', persistGmgnAudioSettings);
  }

  els.masterToggle.addEventListener('change', () => {
    void persistTwitterAudioState({ isMasterEnabled: els.masterToggle.checked }, '已更新推特语音总开关');
  });
  els.ttsVoiceSelect.addEventListener('change', () => {
    void persistTwitterAudioState({ ttsVoice: normalizeTtsVoice(els.ttsVoiceSelect.value) }, '已更新 TTS 音色');
  });
  els.ttsRateSelect.addEventListener('change', () => {
    void persistTwitterAudioState({ ttsRate: normalizeTtsRate(els.ttsRateSelect.value) }, '已更新 TTS 语速');
  });
  els.ttsPitchSelect.addEventListener('change', () => {
    void persistTwitterAudioState({ ttsPitch: normalizeTtsPitch(els.ttsPitchSelect.value) }, '已更新 TTS 音调');
  });
  els.ttsApiPresetSelect.addEventListener('change', () => {
    const presetUrl = els.ttsApiPresetSelect.value;
    if (presetUrl === TTS_API_PRESET_CUSTOM) {
      els.ttsApiUrlInput.focus();
      return;
    }
    void persistTwitterAudioState({ ttsApiUrl: normalizeTtsApiUrl(presetUrl) }, '已更新 TTS 代理线路');
  });
  els.ttsApiUrlInput.addEventListener('change', () => {
    void persistTwitterAudioState({ ttsApiUrl: normalizeTtsApiUrl(els.ttsApiUrlInput.value) }, '已更新 TTS 代理地址');
  });
  els.ttsTestBtn.addEventListener('click', () => {
    void playConfiguredTts('技术瓜发推啦');
  });
  els.globalVolume.addEventListener('input', () => {
    renderTwitterVolumeValue(Number(els.globalVolume.value));
  });
  els.globalVolume.addEventListener('change', () => {
    void persistUnifiedVolumeSetting(Number(els.globalVolume.value));
  });

  [els.filterTweet, els.filterRepost, els.filterReply, els.filterQuote, els.filterOther].forEach((input) => {
    input.addEventListener('change', () => {
      void persistTwitterAudioState({
        eventFilters: {
          tweet: els.filterTweet.checked,
          repost: els.filterRepost.checked,
          reply: els.filterReply.checked,
          quote: els.filterQuote.checked,
          other: els.filterOther.checked
        }
      }, '已更新事件筛选');
    });
  });

  els.addSpeechWatchBtn.addEventListener('click', addSpeechWatchWallet);
  els.addBlacklistBtn.addEventListener('click', addBlacklistWallet);
  if (hasGmgnTwitterTriggerHookControls) {
    els.saveGmgnHookBtn.addEventListener('click', saveGmgnTwitterTriggerHookSettings);
    els.saveGmgnRoutingBtn?.addEventListener('click', saveGmgnTwitterTriggerHookSettings);
    els.gmgnFocusBuysEnabled.addEventListener('change', saveGmgnTwitterTriggerHookSettings);
    els.gmgnMarketWatchDeskBaseUrl.addEventListener('change', saveGmgnTwitterTriggerHookSettings);
    els.gmgnMainScreenRelayBaseUrl.addEventListener('change', saveGmgnTwitterTriggerHookSettings);
    els.saveGmgnTriggerRuleBtn.addEventListener('click', saveGmgnTwitterTriggerRule);
    els.cancelGmgnTriggerRuleBtn.addEventListener('click', resetGmgnTwitterTriggerRuleForm);
  }
}

async function loadGmgnAudioSettings() {
  if (!hasGmgnAudioControls) return;
  const stored = await chrome.storage.local.get(GMGN_AUDIO_SETTINGS_KEY);
  const settings = normalizeGmgnAudioSettings(stored[GMGN_AUDIO_SETTINGS_KEY]);
  els.gmgnAudioEnabled.checked = settings.enabled;
  els.gmgnAudioTts.checked = settings.ttsEnabled;
  els.gmgnAudioPreset.value = settings.preset;
  els.gmgnAudioVolume.value = String(settings.volume);
  renderGmgnVolumeValue(settings.volume);
  renderGmgnAudioControls();
}

async function persistGmgnAudioSettings() {
  if (!hasGmgnAudioControls) return;
  const settings = normalizeGmgnAudioSettings({
    enabled: els.gmgnAudioEnabled.checked,
    preset: els.gmgnAudioPreset.value,
    ttsEnabled: els.gmgnAudioTts.checked,
    volume: Number(els.gmgnAudioVolume.value)
  });

  els.gmgnAudioEnabled.checked = settings.enabled;
  els.gmgnAudioTts.checked = settings.ttsEnabled;
  els.gmgnAudioPreset.value = settings.preset;
  els.gmgnAudioVolume.value = String(settings.volume);
  renderGmgnVolumeValue(settings.volume);
  renderGmgnAudioControls();

  await chrome.storage.local.set({ [GMGN_AUDIO_SETTINGS_KEY]: settings });
  showToast('已更新聚合告警音频设置');
}

async function loadTwitterAudioSettings() {
  const stored = await chrome.storage.local.get([
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
  ]);

  twitterState = normalizeTwitterAudioState(stored);
  renderTwitterAudioSettings();
}

async function persistTwitterAudioState(partialState, message) {
  twitterState = normalizeTwitterAudioState({
    twitterAudioMappings: partialState.mappings ?? twitterState.mappings,
    customAudios: partialState.customAudios ?? twitterState.customAudios,
    isMasterEnabled: partialState.isMasterEnabled ?? twitterState.isMasterEnabled,
    globalVolume: partialState.globalVolume ?? twitterState.globalVolume,
    defaultAudio: partialState.defaultAudio ?? twitterState.defaultAudio,
    eventFilters: partialState.eventFilters ?? twitterState.eventFilters,
    playDefaultUnmapped: partialState.playDefaultUnmapped ?? twitterState.playDefaultUnmapped,
    enableTTS: partialState.enableTTS ?? twitterState.enableTTS,
    ttsVoice: partialState.ttsVoice ?? twitterState.ttsVoice,
    ttsRate: partialState.ttsRate ?? twitterState.ttsRate,
    ttsPitch: partialState.ttsPitch ?? twitterState.ttsPitch,
    ttsApiUrl: partialState.ttsApiUrl ?? twitterState.ttsApiUrl
  });

  renderTwitterAudioSettings();

  await chrome.storage.local.set({
    twitterAudioMappings: twitterState.mappings,
    customAudios: twitterState.customAudios,
    isMasterEnabled: twitterState.isMasterEnabled,
    globalVolume: twitterState.globalVolume,
    defaultAudio: twitterState.defaultAudio,
    eventFilters: twitterState.eventFilters,
    playDefaultUnmapped: twitterState.playDefaultUnmapped,
    enableTTS: twitterState.enableTTS,
    ttsVoice: twitterState.ttsVoice,
    ttsRate: twitterState.ttsRate,
    ttsPitch: twitterState.ttsPitch,
    ttsApiUrl: twitterState.ttsApiUrl
  });

  if (message) {
    showToast(message);
  }
}

async function persistUnifiedVolumeSetting(rawVolume) {
  const volume = clampVolume(rawVolume);
  await persistTwitterAudioState({ globalVolume: volume }, '');
  const stored = await chrome.storage.local.get(GMGN_AUDIO_SETTINGS_KEY);
  const gmgnSettings = normalizeGmgnAudioSettings({
    ...(stored[GMGN_AUDIO_SETTINGS_KEY] || {}),
    volume
  });
  await chrome.storage.local.set({ [GMGN_AUDIO_SETTINGS_KEY]: gmgnSettings });
  showToast('已更新提示音量');
}

function renderTwitterAudioSettings() {
  els.masterToggle.checked = twitterState.isMasterEnabled;
  els.ttsVoiceSelect.value = twitterState.ttsVoice;
  els.ttsRateSelect.value = twitterState.ttsRate;
  els.ttsPitchSelect.value = twitterState.ttsPitch;
  els.ttsApiPresetSelect.value = resolveTtsApiPresetValue(twitterState.ttsApiUrl);
  els.ttsApiUrlInput.value = twitterState.ttsApiUrl;
  els.globalVolume.value = String(twitterState.globalVolume);
  renderTwitterVolumeValue(twitterState.globalVolume);
  els.filterTweet.checked = twitterState.eventFilters.tweet;
  els.filterRepost.checked = twitterState.eventFilters.repost;
  els.filterReply.checked = twitterState.eventFilters.reply;
  els.filterQuote.checked = twitterState.eventFilters.quote;
  els.filterOther.checked = twitterState.eventFilters.other;
  renderTwitterTtsControls();
}

async function loadGmgnSpeechWatchlist() {
  const stored = await chrome.storage.local.get(GMGN_SPEECH_WATCHLIST_KEY);
  gmgnSpeechWatchlist = normalizeGmgnSpeechWatchlist(stored[GMGN_SPEECH_WATCHLIST_KEY]);
  renderGmgnSpeechWatchlist();
}

async function loadGmgnBlacklistWallets() {
  const stored = await chrome.storage.local.get(GMGN_BLACKLIST_WALLETS_KEY);
  gmgnBlacklistWallets = normalizeGmgnBlacklistWallets(stored[GMGN_BLACKLIST_WALLETS_KEY]);
  renderGmgnBlacklistWallets();
}

async function loadGmgnTwitterTriggerHookSettings() {
  if (!hasGmgnTwitterTriggerHookControls) return;
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY);
  gmgnTwitterTriggerHookSettings = normalizeGmgnTwitterTriggerHookSettings(stored[GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]);
  renderGmgnTwitterTriggerHookSettings();
}

async function loadGmgnTwitterTriggerRules() {
  if (!hasGmgnTwitterTriggerHookControls) return;
  const stored = await chrome.storage.local.get(GMGN_TWITTER_TRIGGER_RULES_KEY);
  gmgnTwitterTriggerRules = normalizeGmgnTwitterTriggerRules(stored[GMGN_TWITTER_TRIGGER_RULES_KEY]);
  renderGmgnTwitterTriggerRules();
}

async function persistGmgnSpeechWatchlist(nextWatchlist, message) {
  gmgnSpeechWatchlist = normalizeGmgnSpeechWatchlist(nextWatchlist);
  renderGmgnSpeechWatchlist();
  await chrome.storage.local.set({ [GMGN_SPEECH_WATCHLIST_KEY]: gmgnSpeechWatchlist });
  showToast(message);
}

async function persistGmgnBlacklistWallets(nextBlacklistWallets, message) {
  gmgnBlacklistWallets = normalizeGmgnBlacklistWallets(nextBlacklistWallets);
  renderGmgnBlacklistWallets();
  await chrome.storage.local.set({ [GMGN_BLACKLIST_WALLETS_KEY]: gmgnBlacklistWallets });
  showToast(message);
}

async function persistGmgnTwitterTriggerHookSettings(nextSettings, message) {
  if (!hasGmgnTwitterTriggerHookControls) return;
  gmgnTwitterTriggerHookSettings = normalizeGmgnTwitterTriggerHookSettings(nextSettings);
  renderGmgnTwitterTriggerHookSettings();
  await chrome.storage.local.set({
    [GMGN_TWITTER_TRIGGER_HOOK_SETTINGS_KEY]: gmgnTwitterTriggerHookSettings
  });
  if (message) {
    showToast(message);
  }
}

async function persistGmgnTwitterTriggerRules(nextRules, message) {
  if (!hasGmgnTwitterTriggerHookControls) return;
  gmgnTwitterTriggerRules = normalizeGmgnTwitterTriggerRules(nextRules);
  renderGmgnTwitterTriggerRules();
  await chrome.storage.local.set({
    [GMGN_TWITTER_TRIGGER_RULES_KEY]: gmgnTwitterTriggerRules
  });
  if (message) {
    showToast(message);
  }
}

function renderGmgnTwitterTriggerHookSettings() {
  if (!hasGmgnTwitterTriggerHookControls) return;
  els.gmgnHookEnabled.checked = gmgnTwitterTriggerHookSettings.enabled;
  els.gmgnHookUrl.value = gmgnTwitterTriggerHookSettings.webhookUrl;
  els.gmgnHookSecret.value = gmgnTwitterTriggerHookSettings.secret;
  els.gmgnHookTimeout.value = String(gmgnTwitterTriggerHookSettings.timeoutMs);
  els.gmgnEventApiEnabled.checked = gmgnTwitterTriggerHookSettings.eventApiEnabled;
  els.gmgnEventApiUrl.value = gmgnTwitterTriggerHookSettings.eventApiUrl;
  els.gmgnEventApiToken.value = gmgnTwitterTriggerHookSettings.eventApiToken;
  els.gmgnEventSendWalletTrades.checked = gmgnTwitterTriggerHookSettings.eventSendWalletTrades;
  els.gmgnEventSendConvergenceAlerts.checked = gmgnTwitterTriggerHookSettings.eventSendConvergenceAlerts;
  els.gmgnFocusBuysEnabled.checked = gmgnTwitterTriggerHookSettings.focusBuysEnabled;
  els.gmgnMarketWatchDeskBaseUrl.value = gmgnTwitterTriggerHookSettings.marketWatchDeskBaseUrl;
  els.gmgnMainScreenRelayBaseUrl.value = gmgnTwitterTriggerHookSettings.mainScreenRelayBaseUrl;
  els.gmgnDirectCaEnabled.checked = gmgnTwitterTriggerHookSettings.directCaEnabled;
  els.gmgnDirectCaChain.value = gmgnTwitterTriggerHookSettings.directCaChain;
  els.gmgnDirectCaBuyAmount.value = gmgnTwitterTriggerHookSettings.directCaBuyAmount;
  els.gmgnDirectCaTwitterIds.value = gmgnTwitterTriggerHookSettings.directCaTwitterIds;
}

function renderGmgnTwitterTriggerRules() {
  if (!hasGmgnTwitterTriggerHookControls) return;
  els.gmgnTriggerRulesList.innerHTML = '';

  if (gmgnTwitterTriggerRules.length === 0) {
    els.gmgnTriggerRulesList.innerHTML = '<div class="empty-state">暂无 GMGN 买入触发规则</div>';
    return;
  }

  const sortedRules = [...gmgnTwitterTriggerRules].sort((left, right) => {
    return left.twitterId.localeCompare(right.twitterId) || left.id.localeCompare(right.id);
  });

  for (const rule of sortedRules) {
    const keywordsLabel = rule.keywords.length > 0 ? rule.keywords.join(' / ') : '无关键词限制';
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">@${escapeHtml(rule.twitterId)} · ${escapeHtml(getTriggerEventLabel(rule.eventType))} · ${escapeHtml(rule.chain.toUpperCase())}</span>
        <span class="item-sub">${escapeHtml(rule.ca)}${rule.tokenSymbol ? ` · ${escapeHtml(rule.tokenSymbol)}` : ''}${rule.buyAmount ? ` · 买入 ${escapeHtml(rule.buyAmount)}` : ''}</span>
        <span class="item-sub">${escapeHtml(keywordsLabel)}${rule.note ? ` · ${escapeHtml(rule.note)}` : ''}</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon toggle" type="button">${rule.enabled ? '停用' : '启用'}</button>
        <button class="btn-icon" type="button">编辑</button>
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    const buttons = row.querySelectorAll('button');
    buttons[0].addEventListener('click', async () => {
      const nextRules = gmgnTwitterTriggerRules.map((item) => (
        item.id === rule.id ? { ...item, enabled: !item.enabled } : item
      ));
      await persistGmgnTwitterTriggerRules(nextRules, `${rule.enabled ? '已停用' : '已启用'}规则：@${rule.twitterId}`);
    });
    buttons[1].addEventListener('click', () => {
      openGmgnTwitterTriggerRuleEditor(rule.id);
    });
    buttons[2].addEventListener('click', async () => {
      const nextRules = gmgnTwitterTriggerRules.filter((item) => item.id !== rule.id);
      if (editingGmgnTriggerRuleId === rule.id) {
        resetGmgnTwitterTriggerRuleForm();
      }
      await persistGmgnTwitterTriggerRules(nextRules, `已删除规则：@${rule.twitterId}`);
    });

    els.gmgnTriggerRulesList.appendChild(row);
  }
}

function renderGmgnSpeechWatchlist() {
  els.speechWatchList.innerHTML = '';
  const entries = Object.entries(gmgnSpeechWatchlist).sort((left, right) => left[0].localeCompare(right[0]));

  if (entries.length === 0) {
    els.speechWatchList.innerHTML = '<div class="empty-state">暂无语音特别关注钱包</div>';
    return;
  }

  for (const [walletName, meta] of entries) {
    const alias = typeof meta.alias === 'string' ? meta.alias.trim() : '';
    const focusPushEnabled = meta.focusPushEnabled !== false;
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">${escapeHtml(walletName)}</span>
        <span class="item-sub">${escapeHtml(alias || '未设置播报名，默认直接念钱包名')}</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    const focusPushButton = document.createElement('button');
    focusPushButton.className = `btn-icon focus-push ${focusPushEnabled ? 'enabled' : 'disabled'}`;
    focusPushButton.type = 'button';
    focusPushButton.title = focusPushEnabled ? '关闭 Focus 推送' : '开启 Focus 推送';
    focusPushButton.setAttribute('aria-label', focusPushButton.title);
    focusPushButton.textContent = focusPushEnabled ? '🔔' : '🔕';
    row.querySelector('.action-btns').prepend(focusPushButton);

    focusPushButton.addEventListener('click', async () => {
      const nextWatchlist = { ...gmgnSpeechWatchlist };
      nextWatchlist[walletName] = {
        ...(nextWatchlist[walletName] || {}),
        focusPushEnabled: !focusPushEnabled
      };
      await persistGmgnSpeechWatchlist(
        nextWatchlist,
        !focusPushEnabled ? `已开启 Focus 推送：${walletName}` : `已关闭 Focus 推送：${walletName}`
      );
    });

    row.querySelector('.del').addEventListener('click', async () => {
      const nextWatchlist = { ...gmgnSpeechWatchlist };
      delete nextWatchlist[walletName];
      await persistGmgnSpeechWatchlist(nextWatchlist, `已删除语音关注：${walletName}`);
    });

    els.speechWatchList.appendChild(row);
  }
}

function renderGmgnBlacklistWallets() {
  els.blacklistList.innerHTML = '';
  const entries = Object.keys(gmgnBlacklistWallets).sort((left, right) => left.localeCompare(right));

  if (entries.length === 0) {
    els.blacklistList.innerHTML = '<div class="empty-state">暂无黑名单钱包</div>';
    return;
  }

  for (const walletName of entries) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">${escapeHtml(walletName)}</span>
        <span class="item-sub">页面中会显示 ! 标记，不改变原有聚合和提醒逻辑</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    row.querySelector('.del').addEventListener('click', async () => {
      const nextBlacklistWallets = { ...gmgnBlacklistWallets };
      delete nextBlacklistWallets[walletName];
      await persistGmgnBlacklistWallets(nextBlacklistWallets, `已删除黑名单钱包：${walletName}`);
    });

    els.blacklistList.appendChild(row);
  }
}

async function addSpeechWatchWallet() {
  const walletName = normalizeSpeechWatchWallet(els.speechWatchWalletInput.value);
  const alias = normalizeSpeechWatchAlias(els.speechWatchAliasInput.value);

  if (!walletName) {
    showToast('请先输入 GMGN follow 里显示的钱包名');
    return;
  }

  const existed = Boolean(gmgnSpeechWatchlist[walletName]);
  const nextWatchlist = {
    ...gmgnSpeechWatchlist,
    [walletName]: {
      alias,
      focusPushEnabled: gmgnSpeechWatchlist[walletName]?.focusPushEnabled !== false
    }
  };

  await persistGmgnSpeechWatchlist(
    nextWatchlist,
    existed ? `已更新语音关注：${walletName}` : `已添加语音关注：${walletName}`
  );
  els.speechWatchWalletInput.value = '';
  els.speechWatchAliasInput.value = '';
}

async function addBlacklistWallet() {
  const walletName = normalizeSpeechWatchWallet(els.blacklistWalletInput.value);
  if (!walletName) {
    showToast('请先输入要标记的黑名单钱包名');
    return;
  }

  const existed = Boolean(gmgnBlacklistWallets[walletName]);
  const nextBlacklistWallets = {
    ...gmgnBlacklistWallets,
    [walletName]: true
  };

  await persistGmgnBlacklistWallets(
    nextBlacklistWallets,
    existed ? `已更新黑名单钱包：${walletName}` : `已添加黑名单钱包：${walletName}`
  );
  els.blacklistWalletInput.value = '';
}

async function saveGmgnTwitterTriggerHookSettings() {
  await persistGmgnTwitterTriggerHookSettings({
    enabled: els.gmgnHookEnabled.checked,
    webhookUrl: els.gmgnHookUrl.value,
    secret: els.gmgnHookSecret.value,
    timeoutMs: els.gmgnHookTimeout.value,
    eventApiEnabled: els.gmgnEventApiEnabled.checked,
    eventApiUrl: els.gmgnEventApiUrl.value,
    eventApiToken: els.gmgnEventApiToken.value,
    eventSendWalletTrades: els.gmgnEventSendWalletTrades.checked,
    eventSendConvergenceAlerts: els.gmgnEventSendConvergenceAlerts.checked,
    focusBuysEnabled: els.gmgnFocusBuysEnabled.checked,
    marketWatchDeskBaseUrl: els.gmgnMarketWatchDeskBaseUrl.value,
    mainScreenRelayBaseUrl: els.gmgnMainScreenRelayBaseUrl.value,
    directCaEnabled: els.gmgnDirectCaEnabled.checked,
    directCaChain: els.gmgnDirectCaChain.value,
    directCaBuyAmount: els.gmgnDirectCaBuyAmount.value,
    directCaTwitterIds: els.gmgnDirectCaTwitterIds.value
  }, '已保存 GMGN 外部 Hook 设置');
}

async function saveGmgnTwitterTriggerRule() {
  const nextRule = collectGmgnTwitterTriggerRuleFromForm();
  if (!nextRule) return;

  const nextRules = [...gmgnTwitterTriggerRules];
  const existingIndex = nextRules.findIndex((rule) => rule.id === nextRule.id);

  if (existingIndex >= 0) {
    nextRules[existingIndex] = nextRule;
  } else {
    nextRules.push(nextRule);
  }

  await persistGmgnTwitterTriggerRules(
    nextRules,
    `${existingIndex >= 0 ? '已更新' : '已添加'}规则：@${nextRule.twitterId}`
  );
  resetGmgnTwitterTriggerRuleForm();
}

function collectGmgnTwitterTriggerRuleFromForm() {
  const twitterId = normalizeTwitterId(els.gmgnTriggerTwitterId.value);
  const ca = String(els.gmgnTriggerCa.value || '').trim();
  const existingRule = editingGmgnTriggerRuleId
    ? gmgnTwitterTriggerRules.find((rule) => rule.id === editingGmgnTriggerRuleId)
    : null;

  if (!twitterId) {
    showToast('请先输入推特 ID');
    return null;
  }

  if (!ca) {
    showToast('请先输入固定 CA');
    return null;
  }

  return normalizeGmgnTwitterTriggerRule({
    id: editingGmgnTriggerRuleId || buildGmgnTwitterTriggerRuleId(),
    enabled: existingRule ? existingRule.enabled : true,
    twitterId,
    eventType: els.gmgnTriggerEventType.value,
    keywords: els.gmgnTriggerKeywords.value,
    chain: els.gmgnTriggerChain.value,
    ca,
    tokenSymbol: els.gmgnTriggerTokenSymbol.value,
    buyAmount: els.gmgnTriggerBuyAmount.value,
    note: els.gmgnTriggerNote.value
  }, gmgnTwitterTriggerRules.length);
}

function openGmgnTwitterTriggerRuleEditor(ruleId) {
  const rule = gmgnTwitterTriggerRules.find((item) => item.id === ruleId);
  if (!rule) return;

  editingGmgnTriggerRuleId = rule.id;
  els.gmgnTriggerTwitterId.value = rule.twitterId;
  els.gmgnTriggerEventType.value = rule.eventType;
  els.gmgnTriggerKeywords.value = rule.keywords.join('\n');
  els.gmgnTriggerChain.value = rule.chain;
  els.gmgnTriggerCa.value = rule.ca;
  els.gmgnTriggerTokenSymbol.value = rule.tokenSymbol;
  els.gmgnTriggerBuyAmount.value = rule.buyAmount;
  els.gmgnTriggerNote.value = rule.note;
  els.saveGmgnTriggerRuleBtn.textContent = '保存修改';
}

function resetGmgnTwitterTriggerRuleForm() {
  if (!hasGmgnTwitterTriggerHookControls) return;
  editingGmgnTriggerRuleId = null;
  els.gmgnTriggerTwitterId.value = '';
  els.gmgnTriggerEventType.value = 'any';
  els.gmgnTriggerKeywords.value = '';
  els.gmgnTriggerChain.value = 'bsc';
  els.gmgnTriggerCa.value = '';
  els.gmgnTriggerTokenSymbol.value = '';
  els.gmgnTriggerBuyAmount.value = '';
  els.gmgnTriggerNote.value = '';
  els.saveGmgnTriggerRuleBtn.textContent = '保存触发规则';
}

function speakPreviewText(text) {
  if (!('speechSynthesis' in window)) {
    showToast('当前浏览器不支持语音播报');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getNativeTtsLang(twitterState.ttsVoice);
  const nativeVoice = selectNativeTtsVoice(twitterState.ttsVoice);
  if (nativeVoice) {
    utterance.voice = nativeVoice;
  }
  utterance.rate = speechSynthesisRateFromConfig(twitterState.ttsRate);
  utterance.pitch = speechSynthesisPitchFromConfig(twitterState.ttsPitch);
  utterance.volume = Math.min(twitterState.globalVolume * 1.25, 1);
  window.speechSynthesis.speak(utterance);
}

async function playConfiguredTts(text) {
  if (!text) return;

  try {
    const ttsRequest = buildTtsRequest(twitterState.ttsApiUrl, text, {
      voice: twitterState.ttsVoice,
      rate: twitterState.ttsRate,
      pitch: twitterState.ttsPitch
    });
    const response = await fetch(ttsRequest.url, ttsRequest.options);

    if (!response.ok) {
      throw new Error(`TTS request failed with ${response.status}${await readShortResponseText(response)}`);
    }

    const blob = await response.blob();
    console.info('[GMGN Twitter Audio Settings] TTS preview response received.', {
      url: ttsRequest.url,
      type: blob.type || '',
      size: blob.size || 0,
      volume: twitterState.globalVolume
    });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    const cleanupBoost = attachAudioBoost(audio, twitterState.globalVolume * 1.25);
    const cleanup = () => {
      cleanupBoost();
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute('src');
      audio.load();
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    try {
      await audio.play();
    } catch (_error) {
      cleanup();
      throw _error;
    }
  } catch (_error) {
    console.warn('[GMGN Twitter Audio Settings] TTS preview failed, falling back to browser speech synthesis.', {
      error: _error && _error.message ? _error.message : String(_error),
      ttsApiUrl: twitterState.ttsApiUrl,
      volume: twitterState.globalVolume
    });
    showToast(`TTS 试听失败：${_error && _error.message ? _error.message : '未知错误'}`, 4200);
    speakPreviewText(text);
  }
}

async function readShortResponseText(response) {
  try {
    const text = await response.text();
    return text ? `: ${text.slice(0, 180)}` : '';
  } catch (_error) {
    return '';
  }
}

async function playAudioSource(source, volume) {
  const audio = new Audio(source);
  const cleanupBoost = attachAudioBoost(audio, volume);
  try {
    await audio.play();
    await new Promise((resolve) => {
      audio.addEventListener('ended', resolve, { once: true });
      audio.addEventListener('error', resolve, { once: true });
    });
  } catch (_error) {
    showToast('试听失败，请检查音源链接或文件是否可访问');
  } finally {
    cleanupBoost();
  }
}

function normalizeGmgnAudioSettings(raw) {
  const settings = {
    ...DEFAULT_GMGN_AUDIO_SETTINGS,
    ...(raw || {})
  };
  settings.enabled = typeof settings.enabled === 'boolean' ? settings.enabled : DEFAULT_GMGN_AUDIO_SETTINGS.enabled;
  settings.ttsEnabled = typeof settings.ttsEnabled === 'boolean' ? settings.ttsEnabled : DEFAULT_GMGN_AUDIO_SETTINGS.ttsEnabled;
  settings.preset = BUILTIN_AUDIO_FILES.includes(normalizeAudioId(settings.preset)) ? normalizeAudioId(settings.preset) : DEFAULT_GMGN_AUDIO_SETTINGS.preset;
  settings.volume = clampVolume(settings.volume);
  return settings;
}

function normalizeTwitterAudioState(raw) {
  const defaultMappings = buildDefaultTwitterMappings();
  const mappings = normalizeMappings(raw.twitterAudioMappings || raw.mappings || defaultMappings);
  const customAudios = normalizeCustomAudios(raw.customAudios || {});
  const defaultAudio = normalizeAudioId(raw.defaultAudio || DEFAULT_TWITTER_AUDIO_STATE.defaultAudio);
  const eventFilters = {
    tweet: raw.eventFilters?.tweet !== false,
    repost: raw.eventFilters?.repost !== false,
    reply: raw.eventFilters?.reply !== false,
    quote: raw.eventFilters?.quote !== false,
    other: raw.eventFilters?.other !== false
  };

  return {
    mappings,
    customAudios,
    isMasterEnabled: raw.isMasterEnabled !== false,
    globalVolume: clampVolume(raw.globalVolume),
    defaultAudio: BUILTIN_AUDIO_FILES.includes(defaultAudio) ? defaultAudio : DEFAULT_TWITTER_AUDIO_STATE.defaultAudio,
    playDefaultUnmapped: true,
    enableTTS: true,
    ttsVoice: normalizeTtsVoice(raw.ttsVoice),
    ttsRate: normalizeTtsRate(raw.ttsRate),
    ttsPitch: normalizeTtsPitch(raw.ttsPitch),
    ttsApiUrl: normalizeTtsApiUrl(raw.ttsApiUrl),
    eventFilters
  };
}

function normalizeMappings(mappings) {
  const normalized = {};
  for (const [twitterId, rule] of Object.entries(mappings || {})) {
    const normalizedId = normalizeTwitterId(twitterId);
    if (!normalizedId) continue;
    normalized[normalizedId] = normalizeRule(rule);
  }
  return normalized;
}

function normalizeRule(rule) {
  if (typeof rule === 'string') {
    const audioId = normalizeAudioId(rule);
    return {
      id: audioId,
      name: getAudioLabel(audioId, {}),
      remark: ''
    };
  }

  const audioId = normalizeAudioId(rule?.id || rule?.name || DEFAULT_TWITTER_AUDIO_STATE.defaultAudio);
  return {
    id: audioId,
    name: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim() : getAudioLabel(audioId, {}),
    remark: typeof rule?.remark === 'string' ? rule.remark.trim() : ''
  };
}

function normalizeCustomAudios(customAudios) {
  const normalized = {};
  for (const [customId, audioItem] of Object.entries(customAudios || {})) {
    if (typeof audioItem === 'string') {
      normalized[customId] = {
        name: decodeCustomAudioName(customId),
        data: audioItem,
        sourceType: audioItem.startsWith('http://') || audioItem.startsWith('https://') ? 'remote' : 'local'
      };
      continue;
    }

    if (!audioItem || typeof audioItem !== 'object' || typeof audioItem.data !== 'string') continue;
    normalized[customId] = {
      name: getCustomAudioName(audioItem, customId),
      data: audioItem.data,
      sourceType: audioItem.sourceType || (audioItem.data.startsWith('http://') || audioItem.data.startsWith('https://') ? 'remote' : 'local')
    };
  }
  return normalized;
}

function getAudioLabel(audioId, customAudios) {
  const resolvedAudioId = normalizeAudioId(audioId);
  if (customAudios[resolvedAudioId]) {
    return getCustomAudioName(customAudios[resolvedAudioId], resolvedAudioId);
  }
  return resolvedAudioId;
}

function getCustomAudioName(audioItem, fallbackId) {
  if (audioItem && typeof audioItem === 'object' && typeof audioItem.name === 'string' && audioItem.name.trim()) {
    return audioItem.name.trim();
  }
  return decodeCustomAudioName(fallbackId);
}

function decodeCustomAudioName(customId) {
  if (customId.startsWith('custom_file_')) {
    return decodeURIComponent(customId.slice('custom_file_'.length));
  }
  if (customId.startsWith('custom_url_')) {
    return decodeURIComponent(customId.slice('custom_url_'.length));
  }
  return customId;
}

function normalizeAudioId(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return 'default.MP3';
  const fileName = rawValue.split('/').pop();
  const lowered = fileName.toLowerCase();
  if (lowered === 'cz.mp3') return 'CZ.MP3';
  const matched = BUILTIN_AUDIO_FILES.find((item) => item.toLowerCase() === lowered);
  return matched || rawValue;
}

function normalizeTwitterId(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

function normalizeSpeechWatchWallet(value) {
  return String(value || '').trim();
}

function normalizeSpeechWatchAlias(value) {
  return String(value || '').trim();
}

function normalizeGmgnSpeechWatchlist(raw) {
  const next = {};
  for (const [walletName, meta] of Object.entries(raw || {})) {
    const normalizedWallet = normalizeSpeechWatchWallet(walletName);
    if (!normalizedWallet) continue;
    next[normalizedWallet] = {
      alias: normalizeSpeechWatchAlias(meta && meta.alias),
      focusPushEnabled: meta && typeof meta.focusPushEnabled === 'boolean'
        ? meta.focusPushEnabled
        : true
    };
  }
  return next;
}

function normalizeGmgnBlacklistWallets(raw) {
  const next = {};
  if (Array.isArray(raw)) {
    for (const walletName of raw) {
      const normalizedWallet = normalizeSpeechWatchWallet(walletName);
      if (!normalizedWallet) continue;
      next[normalizedWallet] = true;
    }
    return next;
  }

  for (const [walletName, enabled] of Object.entries(raw || {})) {
    const normalizedWallet = normalizeSpeechWatchWallet(walletName);
    if (!normalizedWallet || enabled === false) continue;
    next[normalizedWallet] = true;
  }
  return next;
}

function normalizeGmgnTwitterTriggerHookSettings(raw) {
  const settings = {
    ...DEFAULT_GMGN_TWITTER_TRIGGER_HOOK_SETTINGS,
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
    : DEFAULT_GMGN_TWITTER_TRIGGER_HOOK_SETTINGS.focusBuysEnabled;
  settings.marketWatchDeskBaseUrl = normalizeMarketWatchDeskBaseUrl(settings.marketWatchDeskBaseUrl);
  settings.mainScreenRelayBaseUrl = normalizeMainScreenRelayBaseUrl(settings.mainScreenRelayBaseUrl);
  settings.directCaEnabled = settings.directCaEnabled === true;
  settings.directCaChain = normalizeGmgnTriggerChain(settings.directCaChain);
  settings.directCaBuyAmount = typeof settings.directCaBuyAmount === 'string'
    ? settings.directCaBuyAmount.trim()
    : String(settings.directCaBuyAmount || '').trim();
  settings.directCaTwitterIds = normalizeGmgnTriggerTwitterIds(settings.directCaTwitterIds).join('\n');
  return settings;
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
  return normalizeHttpBaseUrl(value, DEFAULT_MAIN_SCREEN_RELAY_BASE_URL);
}

function normalizeGmgnTwitterTriggerRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rule, index) => normalizeGmgnTwitterTriggerRule(rule, index))
    .filter((rule) => rule && rule.twitterId && rule.ca);
}

function normalizeGmgnTwitterTriggerRule(rule, index) {
  if (!rule || typeof rule !== 'object') return null;

  return {
    id: typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : `gmgn-trigger-${index + 1}`,
    enabled: rule.enabled !== false,
    twitterId: normalizeTwitterId(rule.twitterId),
    eventType: normalizeGmgnTriggerEventType(rule.eventType),
    keywords: normalizeGmgnTriggerKeywords(rule.keywords),
    chain: normalizeGmgnTriggerChain(rule.chain),
    ca: typeof rule.ca === 'string' ? rule.ca.trim() : '',
    tokenSymbol: typeof rule.tokenSymbol === 'string' ? rule.tokenSymbol.trim() : '',
    buyAmount: typeof rule.buyAmount === 'string' ? rule.buyAmount.trim() : String(rule.buyAmount || '').trim(),
    note: typeof rule.note === 'string' ? rule.note.trim() : ''
  };
}

function normalizeGmgnTriggerKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[\r\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGmgnTriggerTwitterIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTwitterId(item)).filter(Boolean);
  }
  return String(value || '')
    .split(/[\s,，]+/)
    .map((item) => normalizeTwitterId(item))
    .filter(Boolean);
}

function normalizeGmgnTriggerEventType(value) {
  const eventType = String(value || '').trim().toLowerCase();
  if (GMGN_TWITTER_TRIGGER_EVENT_CHOICES.some((option) => option.value === eventType)) {
    return eventType;
  }
  return 'any';
}

function normalizeGmgnTriggerChain(value) {
  const chain = String(value || '').trim().toLowerCase();
  if (GMGN_TWITTER_TRIGGER_CHAIN_CHOICES.some((option) => option.value === chain)) {
    return chain;
  }
  return 'bsc';
}

function buildGmgnTwitterTriggerRuleId() {
  return `gmgn-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampHookTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) return DEFAULT_GMGN_TWITTER_TRIGGER_HOOK_SETTINGS.timeoutMs;
  return Math.max(500, Math.min(15000, Math.round(timeout)));
}

function getTriggerEventLabel(value) {
  return (GMGN_TWITTER_TRIGGER_EVENT_CHOICES.find((option) => option.value === value) || { label: value }).label;
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(MAX_AUDIO_VOLUME, Math.max(0, numeric));
}

function ensurePreviewAudioCtx() {
  if (previewAudioCtx) return previewAudioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    previewAudioCtx = new Ctx();
    return previewAudioCtx;
  } catch (_error) {
    return null;
  }
}

function attachAudioBoost(audio, rawVolume) {
  const volume = clampVolume(rawVolume);
  audio.volume = Math.min(volume, 1);
  if (volume <= 1) {
    return () => {};
  }

  const ctx = ensurePreviewAudioCtx();
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
    gainNode.gain.value = volume;
    return () => {
      try { sourceNode.disconnect(); } catch (_error) {}
      try { gainNode.disconnect(); } catch (_error) {}
    };
  } catch (_error) {
    return () => {};
  }
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

function resolveTtsApiPresetValue(ttsApiUrl) {
  const normalizedUrl = normalizeTtsApiUrl(ttsApiUrl);
  const preset = TTS_API_PRESET_CHOICES.find((option) => option.value === normalizedUrl);
  return preset ? preset.value : TTS_API_PRESET_CUSTOM;
}

function buildTtsRequest(ttsApiUrl, text, options = {}) {
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

function usesMacminiTaskTts(ttsApiUrl) {
  try {
    const url = new URL(ttsApiUrl);
    return url.hostname === 'tts.macmini.lan' && url.pathname.replace(/\/+$/, '') === '/tts/v3-task';
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

function getNativeTtsLang(voiceId) {
  const value = String(voiceId || '').trim();
  const match = /^([a-z]{2}-[A-Z]{2})/.exec(value);
  return match ? match[1] : 'zh-CN';
}

function selectNativeTtsVoice(voiceId) {
  if (!('speechSynthesis' in window) || typeof window.speechSynthesis.getVoices !== 'function') {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const lang = getNativeTtsLang(voiceId).toLowerCase();
  const voiceText = String(voiceId || '').toLowerCase();
  return voices.find((voice) => String(voice.name || '').toLowerCase().includes(voiceText))
    || voices.find((voice) => String(voice.lang || '').toLowerCase() === lang)
    || voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(lang.split('-')[0]))
    || null;
}

function populateBuiltInSelect(selectElement) {
  selectElement.innerHTML = BUILTIN_AUDIO_FILES.map((fileName) => `
    <option value="${fileName}">${fileName}</option>
  `).join('');
}

function populateChoiceSelect(selectElement, options) {
  selectElement.innerHTML = options.map((option) => `
    <option value="${option.value}">${option.label}</option>
  `).join('');
}

function renderGmgnAudioControls() {
  if (!hasGmgnAudioControls) return;
  const enabled = els.gmgnAudioEnabled.checked;
  els.gmgnAudioTts.disabled = !enabled;
  els.gmgnAudioPreset.disabled = !enabled;
  els.gmgnAudioVolume.disabled = !enabled;
}

function renderGmgnVolumeValue(volume) {
  if (!hasGmgnAudioControls) return;
  els.gmgnAudioVolumeValue.textContent = `${Math.round(clampVolume(volume) * 100)}%`;
}

function renderTwitterVolumeValue(volume) {
  els.volumePercent.textContent = `${Math.round(clampVolume(volume) * 100)}%`;
}

function renderTwitterTtsControls() {
  [els.ttsVoiceSelect, els.ttsRateSelect, els.ttsPitchSelect, els.ttsApiPresetSelect, els.ttsApiUrlInput, els.ttsTestBtn].forEach((element) => {
    element.disabled = false;
  });
}

function showToast(message, duration = 2200) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, duration);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function buildDefaultTwitterMappings() {
  return {
    elonmusk: { id: 'elonmusk.MP3', name: 'elonmusk.MP3', remark: '' },
    cz_binance: { id: 'CZ.MP3', name: 'CZ.MP3', remark: '' },
    heyibinance: { id: 'heyi.MP3', name: 'heyi.MP3', remark: '' }
  };
}
