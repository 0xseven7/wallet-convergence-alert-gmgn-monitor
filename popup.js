const GET_MAIN_WINDOW_MESSAGE = 'get-main-window';
const SET_MAIN_WINDOW_MESSAGE = 'set-main-window';
const CLEAR_MAIN_WINDOW_MESSAGE = 'clear-main-window';

const GMGN_AUDIO_SETTINGS_KEY = 'gmgnAudioSettings';
const GMGN_SPEECH_WATCHLIST_KEY = 'gmgnSpeechWatchlist';
const BUILTIN_AUDIO_FILES = ['default.MP3', 'preset1.MP3', 'elonmusk.MP3', 'CZ.MP3', 'heyi.MP3'];
const TTS_API = 'https://cloudflare-edge-tts.tech-melon.workers.dev/tts';
const DEFAULT_TTS_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_TTS_RATE = '+0%';
const DEFAULT_TTS_PITCH = '+0%';
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
  eventFilters: {
    tweet: true,
    repost: true,
    reply: true,
    quote: true,
    other: true
  }
};
const DEFAULT_GMGN_SPEECH_WATCHLIST = {};

const els = {
  currentWindow: document.getElementById('current-window'),
  currentWindowRole: document.getElementById('current-window-role'),
  mainWindow: document.getElementById('main-window'),
  mainWindowMeta: document.getElementById('main-window-meta'),
  status: document.getElementById('status'),
  setMainWindow: document.getElementById('set-main-window'),
  clearMainWindow: document.getElementById('clear-main-window'),
  toast: document.getElementById('toast'),
  gmgnAudioEnabled: document.getElementById('gmgn-audio-enabled'),
  gmgnAudioTts: document.getElementById('gmgn-audio-tts'),
  gmgnAudioPreset: document.getElementById('gmgn-audio-preset'),
  gmgnAudioVolume: document.getElementById('gmgn-audio-volume'),
  gmgnAudioVolumeValue: document.getElementById('gmgn-audio-volume-value'),
  masterToggle: document.getElementById('masterToggle'),
  playDefaultToggle: document.getElementById('playDefaultToggle'),
  enableTTSToggle: document.getElementById('enableTTSToggle'),
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  ttsRateSelect: document.getElementById('ttsRateSelect'),
  ttsPitchSelect: document.getElementById('ttsPitchSelect'),
  ttsTestBtn: document.getElementById('ttsTestBtn'),
  fallbackPreset: document.getElementById('fallbackPreset'),
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
  twitterIdInput: document.getElementById('twitterId'),
  twitterRemarkInput: document.getElementById('twitterRemark'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  uploadBtn: document.getElementById('uploadBtn'),
  exportAudioZipBtn: document.getElementById('exportAudioZipBtn'),
  customAudioFile: document.getElementById('customAudioFile'),
  customAudioUrl: document.getElementById('custom-audio-url'),
  customAudioName: document.getElementById('custom-audio-name'),
  addAudioUrlBtn: document.getElementById('addAudioUrlBtn'),
  customAudioList: document.getElementById('customAudioList'),
  exportRulesBtn: document.getElementById('exportRulesBtn'),
  importRulesBtn: document.getElementById('importRulesBtn'),
  importRulesFile: document.getElementById('importRulesFile'),
  searchInput: document.getElementById('searchInput'),
  rulesList: document.getElementById('rulesList'),
  editModal: document.getElementById('editModal'),
  editTwitterId: document.getElementById('editTwitterId'),
  editTwitterRemark: document.getElementById('editTwitterRemark'),
  saveEditBtn: document.getElementById('saveEditBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn')
};
const hasGmgnAudioControls = Boolean(
  els.gmgnAudioEnabled
  && els.gmgnAudioTts
  && els.gmgnAudioPreset
  && els.gmgnAudioVolume
  && els.gmgnAudioVolumeValue
);

let currentWindowId = null;
let selectedMainWindowId = null;
let twitterState = { ...DEFAULT_TWITTER_AUDIO_STATE };
let gmgnSpeechWatchlist = { ...DEFAULT_GMGN_SPEECH_WATCHLIST };

initialize().catch((error) => {
  renderStatus(error.message || '初始化失败');
});

async function initialize() {
  if (hasGmgnAudioControls) {
    populateBuiltInSelect(els.gmgnAudioPreset);
  }
  populateChoiceSelect(els.ttsVoiceSelect, TTS_VOICE_CHOICES);
  populateChoiceSelect(els.ttsRateSelect, TTS_RATE_CHOICES);
  populateChoiceSelect(els.ttsPitchSelect, TTS_PITCH_CHOICES);
  populateBuiltInSelect(els.fallbackPreset);
  setupCustomDropdown('addSelectTrigger', 'addSelectMenu', 'addSelectSearch', 'addSelectList', 'addAudioValue', 'addAudioName');
  setupCustomDropdown('editSelectTrigger', 'editSelectMenu', 'editSelectSearch', 'editSelectList', 'editAudioValue', 'editAudioName');
  bindEvents();

  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  currentWindowId = currentWindow.id || null;
  els.currentWindow.textContent = formatWindowTitle(currentWindow, currentWindowId);

  const tasks = [
    loadMainWindowState(),
    loadTwitterAudioSettings(),
    loadGmgnSpeechWatchlist()
  ];
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
}

function bindEvents() {
  els.setMainWindow.addEventListener('click', handleSetMainWindow);
  els.clearMainWindow.addEventListener('click', handleClearMainWindow);

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
  els.playDefaultToggle.addEventListener('change', () => {
    void persistTwitterAudioState({ playDefaultUnmapped: els.playDefaultToggle.checked }, '已更新默认提示音设置');
  });
  els.enableTTSToggle.addEventListener('change', () => {
    void persistTwitterAudioState({ enableTTS: els.enableTTSToggle.checked }, '已更新语音播报设置');
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
  els.ttsTestBtn.addEventListener('click', () => {
    void playConfiguredTts('技术瓜发推啦');
  });
  els.fallbackPreset.addEventListener('change', () => {
    void persistTwitterAudioState({ defaultAudio: normalizeAudioId(els.fallbackPreset.value) }, '已更新默认提示音');
  });
  els.globalVolume.addEventListener('input', () => {
    renderTwitterVolumeValue(Number(els.globalVolume.value));
  });
  els.globalVolume.addEventListener('change', () => {
    void persistTwitterAudioState({ globalVolume: clampVolume(Number(els.globalVolume.value)) }, '已更新推特提示音量');
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
  els.addRuleBtn.addEventListener('click', addMappingRule);
  els.uploadBtn.addEventListener('click', importCustomAudioFiles);
  els.addAudioUrlBtn.addEventListener('click', addCustomAudioUrl);
  els.exportAudioZipBtn.addEventListener('click', exportCustomAudioZip);
  els.exportRulesBtn.addEventListener('click', exportRules);
  els.importRulesBtn.addEventListener('click', () => els.importRulesFile.click());
  els.importRulesFile.addEventListener('change', importRules);
  els.searchInput.addEventListener('input', filterRulesList);
  els.saveEditBtn.addEventListener('click', saveEditedRule);
  els.cancelEditBtn.addEventListener('click', () => {
    els.editModal.style.display = 'none';
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown-menu').forEach((menu) => menu.classList.remove('show'));
  });
}

async function handleSetMainWindow() {
  if (!currentWindowId) {
    renderStatus('当前窗口不可用');
    return;
  }

  const result = await chrome.runtime.sendMessage({
    type: SET_MAIN_WINDOW_MESSAGE,
    windowId: currentWindowId
  });

  if (!result || !result.ok) {
    renderStatus(result && result.error ? result.error : '设置主窗口失败');
    return;
  }

  selectedMainWindowId = result.windowId;
  renderMainWindow(result.title, result.windowId, false);
  renderCurrentWindowRole();
  renderButtons();
  renderStatus('已把当前窗口设为主窗口');
}

async function handleClearMainWindow() {
  const result = await chrome.runtime.sendMessage({ type: CLEAR_MAIN_WINDOW_MESSAGE });

  if (!result || !result.ok) {
    renderStatus(result && result.error ? result.error : '清除主窗口失败');
    return;
  }

  selectedMainWindowId = null;
  renderMainWindow(null, null, false);
  renderCurrentWindowRole();
  renderButtons();
  renderStatus('已清除主窗口选择');
}

async function loadMainWindowState() {
  const result = await chrome.runtime.sendMessage({ type: GET_MAIN_WINDOW_MESSAGE });
  if (!result || !result.ok || !result.windowId) {
    selectedMainWindowId = null;
    renderMainWindow(null, null, false);
    renderCurrentWindowRole();
    renderButtons();
    return;
  }

  selectedMainWindowId = result.windowId;
  renderMainWindow(result.title, result.windowId, Boolean(result.resolvedFromSnapshot));
  renderCurrentWindowRole();
  renderButtons();
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
  renderStatus('已更新聚合告警音频设置');
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
    'ttsPitch'
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
    ttsPitch: partialState.ttsPitch ?? twitterState.ttsPitch
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
    ttsPitch: twitterState.ttsPitch
  });

  showToast(message);
}

function renderTwitterAudioSettings() {
  els.masterToggle.checked = twitterState.isMasterEnabled;
  els.playDefaultToggle.checked = twitterState.playDefaultUnmapped;
  els.enableTTSToggle.checked = twitterState.enableTTS;
  els.ttsVoiceSelect.value = twitterState.ttsVoice;
  els.ttsRateSelect.value = twitterState.ttsRate;
  els.ttsPitchSelect.value = twitterState.ttsPitch;
  els.fallbackPreset.value = twitterState.defaultAudio;
  els.globalVolume.value = String(twitterState.globalVolume);
  renderTwitterVolumeValue(twitterState.globalVolume);
  els.filterTweet.checked = twitterState.eventFilters.tweet;
  els.filterRepost.checked = twitterState.eventFilters.repost;
  els.filterReply.checked = twitterState.eventFilters.reply;
  els.filterQuote.checked = twitterState.eventFilters.quote;
  els.filterOther.checked = twitterState.eventFilters.other;
  renderTwitterTtsControls();

  renderAudioDropdownOptions();
  renderCustomAudioList();
  renderRulesList();
  filterRulesList();
}

async function loadGmgnSpeechWatchlist() {
  const stored = await chrome.storage.local.get(GMGN_SPEECH_WATCHLIST_KEY);
  gmgnSpeechWatchlist = normalizeGmgnSpeechWatchlist(stored[GMGN_SPEECH_WATCHLIST_KEY]);
  renderGmgnSpeechWatchlist();
}

async function persistGmgnSpeechWatchlist(nextWatchlist, message) {
  gmgnSpeechWatchlist = normalizeGmgnSpeechWatchlist(nextWatchlist);
  renderGmgnSpeechWatchlist();
  await chrome.storage.local.set({ [GMGN_SPEECH_WATCHLIST_KEY]: gmgnSpeechWatchlist });
  showToast(message);
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

    row.querySelector('.del').addEventListener('click', async () => {
      const nextWatchlist = { ...gmgnSpeechWatchlist };
      delete nextWatchlist[walletName];
      await persistGmgnSpeechWatchlist(nextWatchlist, `已删除语音关注：${walletName}`);
    });

    els.speechWatchList.appendChild(row);
  }
}

function renderAudioDropdownOptions() {
  const options = buildAudioOptions(twitterState.customAudios);
  renderDropdownList(document.getElementById('addSelectList'), options);
  renderDropdownList(document.getElementById('editSelectList'), options);

  resetDropdownSelection('add', document.getElementById('addAudioValue').value || 'default.MP3');

  if (els.editModal.style.display === 'flex') {
    resetDropdownSelection('edit', document.getElementById('editAudioValue').value || 'default.MP3');
  }
}

function renderCustomAudioList() {
  const entries = Object.entries(twitterState.customAudios);
  els.customAudioList.innerHTML = '';

  if (entries.length === 0) {
    els.customAudioList.innerHTML = '<div class="empty-state">暂无自定义音源</div>';
    return;
  }

  for (const [customId, audioItem] of entries) {
    const audioName = getCustomAudioName(audioItem, customId);
    const sourceLabel = isRemoteAudioSource(audioItem)
      ? '链接音源'
      : '本地音源';
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">${escapeHtml(audioName)}</span>
        <span class="item-sub">${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon play" type="button">试听</button>
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    row.querySelector('.play').addEventListener('click', async () => {
      await previewAudio(customId, audioName);
    });

    row.querySelector('.del').addEventListener('click', async () => {
      const nextCustomAudios = { ...twitterState.customAudios };
      delete nextCustomAudios[customId];
      await persistTwitterAudioState({ customAudios: nextCustomAudios }, `已删除音源：${audioName}`);
    });

    els.customAudioList.appendChild(row);
  }
}

function renderRulesList() {
  els.rulesList.innerHTML = '';

  const mappings = Object.entries(twitterState.mappings).sort((left, right) => left[0].localeCompare(right[0]));
  if (mappings.length === 0) {
    els.rulesList.innerHTML = '<div class="empty-state">暂无映射规则</div>';
    return;
  }

  for (const [twitterId, rule] of mappings) {
    const audioId = normalizeAudioId(rule.id);
    const audioLabel = getAudioLabel(audioId, twitterState.customAudios);
    const remark = typeof rule.remark === 'string' ? rule.remark.trim() : '';
    const isMissingCustom = audioId.startsWith('custom_') && !twitterState.customAudios[audioId];
    const subLabel = isMissingCustom ? `${audioLabel}（原音源已丢失，将回退到默认提示音）` : audioLabel;

    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">@${escapeHtml(twitterId)}${remark ? ` <span class="item-sub">(${escapeHtml(remark)})</span>` : ''}</span>
        <span class="item-sub">${escapeHtml(subLabel)}</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon play" type="button">试听</button>
        <button class="btn-icon" type="button">编辑</button>
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    const buttons = row.querySelectorAll('button');
    buttons[0].addEventListener('click', async () => {
      await previewAudio(audioId, remark || twitterId);
    });
    buttons[1].addEventListener('click', () => {
      openEditModal(twitterId, rule);
    });
    buttons[2].addEventListener('click', async () => {
      const nextMappings = { ...twitterState.mappings };
      delete nextMappings[twitterId];
      await persistTwitterAudioState({ mappings: nextMappings }, `已删除映射：@${twitterId}`);
    });

    els.rulesList.appendChild(row);
  }
}

function filterRulesList() {
  const searchTerm = els.searchInput.value.trim().toLowerCase();
  els.rulesList.querySelectorAll('.list-item').forEach((item) => {
    item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? 'flex' : 'none';
  });
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
      alias
    }
  };

  await persistGmgnSpeechWatchlist(
    nextWatchlist,
    existed ? `已更新语音关注：${walletName}` : `已添加语音关注：${walletName}`
  );
  els.speechWatchWalletInput.value = '';
  els.speechWatchAliasInput.value = '';
}

async function addMappingRule() {
  const twitterId = normalizeTwitterId(els.twitterIdInput.value);
  const remark = els.twitterRemarkInput.value.trim();
  const audioId = normalizeAudioId(document.getElementById('addAudioValue').value);

  if (!twitterId) {
    showToast('请先输入推特 ID 或钱包标签');
    return;
  }

  if (twitterState.mappings[twitterId]) {
    showToast(`@${twitterId} 已存在，请直接编辑`);
    return;
  }

  const nextMappings = {
    ...twitterState.mappings,
    [twitterId]: {
      id: audioId,
      name: getAudioLabel(audioId, twitterState.customAudios),
      remark
    }
  };

  await persistTwitterAudioState({ mappings: nextMappings }, `已添加映射：@${twitterId}`);
  els.twitterIdInput.value = '';
  els.twitterRemarkInput.value = '';
  resetDropdownSelection('add', 'default.MP3');
}

function openEditModal(twitterId, rule) {
  els.editTwitterId.value = twitterId;
  els.editTwitterRemark.value = typeof rule.remark === 'string' ? rule.remark : '';
  resetDropdownSelection('edit', normalizeAudioId(rule.id));
  els.editModal.style.display = 'flex';
}

async function saveEditedRule() {
  const twitterId = normalizeTwitterId(els.editTwitterId.value);
  if (!twitterId) return;

  const audioId = normalizeAudioId(document.getElementById('editAudioValue').value);
  const nextMappings = {
    ...twitterState.mappings,
    [twitterId]: {
      id: audioId,
      name: getAudioLabel(audioId, twitterState.customAudios),
      remark: els.editTwitterRemark.value.trim()
    }
  };

  await persistTwitterAudioState({ mappings: nextMappings }, `已保存映射：@${twitterId}`);
  els.editModal.style.display = 'none';
}

async function importCustomAudioFiles() {
  const files = Array.from(els.customAudioFile.files || []);
  if (files.length === 0) {
    showToast('请先选择音频文件或 ZIP 包');
    return;
  }

  const allowedExtensions = new Set(['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac']);
  const nextCustomAudios = { ...twitterState.customAudios };
  let imported = 0;
  let skipped = 0;

  els.uploadBtn.disabled = true;
  const previousLabel = els.uploadBtn.textContent;
  els.uploadBtn.textContent = '导入中...';

  try {
    for (const file of files) {
      const fileExt = getFileExtension(file.name);

      if (fileExt === 'zip') {
        const zip = await JSZip.loadAsync(file);
        const entryPromises = [];

        zip.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) return;
          const entryExt = getFileExtension(relativePath);
          if (!allowedExtensions.has(entryExt)) return;
          entryPromises.push(
            zipEntry.async('base64').then((base64) => ({
              name: relativePath.split('/').pop(),
              mimeType: getAudioMimeType(entryExt),
              base64
            }))
          );
        });

        const entries = await Promise.all(entryPromises);
        for (const entry of entries) {
          const customId = buildCustomAudioId(entry.name);
          if (nextCustomAudios[customId]) {
            skipped += 1;
            continue;
          }

          nextCustomAudios[customId] = {
            name: entry.name,
            data: `data:${entry.mimeType};base64,${entry.base64}`,
            sourceType: 'local'
          };
          imported += 1;
        }
        continue;
      }

      if (!allowedExtensions.has(fileExt)) {
        skipped += 1;
        continue;
      }

      const customId = buildCustomAudioId(file.name);
      if (nextCustomAudios[customId]) {
        skipped += 1;
        continue;
      }

      nextCustomAudios[customId] = {
        name: file.name,
        data: await readFileAsDataUrl(file),
        sourceType: 'local'
      };
      imported += 1;
    }

    await persistTwitterAudioState(
      { customAudios: nextCustomAudios },
      `已导入 ${imported} 个音源${skipped ? `，跳过 ${skipped} 个重复或无效文件` : ''}`
    );
    els.customAudioFile.value = '';
  } finally {
    els.uploadBtn.disabled = false;
    els.uploadBtn.textContent = previousLabel;
  }
}

async function addCustomAudioUrl() {
  const rawUrl = els.customAudioUrl.value.trim();
  const customName = els.customAudioName.value.trim();

  if (!rawUrl) {
    showToast('请先输入音频链接');
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (_error) {
    showToast('音频链接格式不正确');
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    showToast('音频链接只支持 http 或 https');
    return;
  }

  const customId = buildCustomAudioUrlId(parsedUrl.href);
  if (twitterState.customAudios[customId]) {
    showToast('这个音频链接已经存在');
    return;
  }

  const nextCustomAudios = {
    ...twitterState.customAudios,
    [customId]: {
      name: customName || deriveAudioNameFromUrl(parsedUrl),
      data: parsedUrl.href,
      sourceType: 'remote'
    }
  };

  await persistTwitterAudioState({ customAudios: nextCustomAudios }, '已添加链接音源');
  els.customAudioUrl.value = '';
  els.customAudioName.value = '';
}

async function exportCustomAudioZip() {
  const entries = Object.entries(twitterState.customAudios);
  if (entries.length === 0) {
    showToast('没有可导出的自定义音源');
    return;
  }

  els.exportAudioZipBtn.disabled = true;
  const previousLabel = els.exportAudioZipBtn.textContent;
  els.exportAudioZipBtn.textContent = '打包中...';

  try {
    const zip = new JSZip();
    const folder = zip.folder('gmgn-twitter-audio-backup');
    const remoteLinks = [];

    for (const [customId, audioItem] of entries) {
      const audioName = getCustomAudioName(audioItem, customId);
      const source = typeof audioItem === 'string' ? audioItem : audioItem.data;

      if (isRemoteAudioSource(audioItem)) {
        remoteLinks.push({
          id: customId,
          name: audioName,
          url: source
        });
        continue;
      }

      const base64 = String(source).split(',')[1];
      if (!base64) continue;
      folder.file(audioName, base64, { base64: true });
    }

    if (remoteLinks.length > 0) {
      folder.file('remote-audio-links.json', JSON.stringify(remoteLinks, null, 2));
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    downloadBlob(zipBlob, `gmgn-twitter-audio-backup-${getDateStamp()}.zip`);
    showToast('已导出音源备份');
  } finally {
    els.exportAudioZipBtn.disabled = false;
    els.exportAudioZipBtn.textContent = previousLabel;
  }
}

async function exportRules() {
  const rulesBlob = new Blob([JSON.stringify(twitterState.mappings, null, 2)], {
    type: 'application/json'
  });
  downloadBlob(rulesBlob, `gmgn-twitter-rules-${getDateStamp()}.json`);
  showToast('已导出映射规则');
}

async function importRules(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const nextMappings = { ...twitterState.mappings };
    let imported = 0;
    let skipped = 0;

    for (const [rawId, rawRule] of Object.entries(parsed || {})) {
      const twitterId = normalizeTwitterId(rawId);
      if (!twitterId || nextMappings[twitterId]) {
        skipped += 1;
        continue;
      }
      const normalizedRule = normalizeRule(rawRule);
      nextMappings[twitterId] = normalizedRule;
      imported += 1;
    }

    await persistTwitterAudioState(
      { mappings: nextMappings },
      `已导入 ${imported} 条规则${skipped ? `，跳过 ${skipped} 条重复或无效规则` : ''}`
    );
  } catch (_error) {
    showToast('规则文件不是有效的 JSON');
  } finally {
    els.importRulesFile.value = '';
  }
}

async function previewAudio(audioId, ttsText) {
  const resolvedAudioId = normalizeAudioId(audioId);
  const customAudio = twitterState.customAudios[resolvedAudioId];

  if (customAudio) {
    const source = typeof customAudio === 'string' ? customAudio : customAudio.data;
    await playAudioSource(source, twitterState.globalVolume);
    return;
  }

  if ((resolvedAudioId === 'default.MP3' || resolvedAudioId === 'preset1.MP3') && twitterState.enableTTS) {
    await playConfiguredTts(`${ttsText} 的推特提示`);
    return;
  }

  await playAudioSource(chrome.runtime.getURL(`sounds/${resolvedAudioId}`), twitterState.globalVolume);
}

function speakPreviewText(text) {
  if (!('speechSynthesis' in window)) {
    showToast('当前浏览器不支持语音播报');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = speechSynthesisRateFromConfig(twitterState.ttsRate);
  utterance.pitch = speechSynthesisPitchFromConfig(twitterState.ttsPitch);
  utterance.volume = Math.min(twitterState.globalVolume * 1.25, 1);
  window.speechSynthesis.speak(utterance);
}

async function playConfiguredTts(text) {
  if (!text) return;

  try {
    const response = await fetch(TTS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: twitterState.ttsVoice,
        rate: twitterState.ttsRate,
        pitch: twitterState.ttsPitch
      })
    });

    if (!response.ok) {
      throw new Error(`TTS request failed with ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.volume = Math.min(twitterState.globalVolume * 1.25, 1);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute('src');
      audio.load();
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    await audio.play();
  } catch (_error) {
    speakPreviewText(text);
  }
}

async function playAudioSource(source, volume) {
  const audio = new Audio(source);
  audio.volume = clampVolume(volume);
  try {
    await audio.play();
  } catch (_error) {
    showToast('试听失败，请检查音源链接或文件是否可访问');
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
    playDefaultUnmapped: raw.playDefaultUnmapped !== false,
    enableTTS: raw.enableTTS !== false,
    ttsVoice: normalizeTtsVoice(raw.ttsVoice),
    ttsRate: normalizeTtsRate(raw.ttsRate),
    ttsPitch: normalizeTtsPitch(raw.ttsPitch),
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

function setupCustomDropdown(triggerId, menuId, searchId, listId, valueId, nameId) {
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  const search = document.getElementById(searchId);
  const list = document.getElementById(listId);
  const valueInput = document.getElementById(valueId);
  const nameInput = document.getElementById(nameId);

  menu.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = menu.classList.contains('show');
    document.querySelectorAll('.custom-dropdown-menu').forEach((dropdown) => dropdown.classList.remove('show'));
    if (isOpen) return;
    menu.classList.add('show');
    search.value = '';
    search.focus();
    Array.from(list.children).forEach((child) => {
      child.style.display = 'block';
    });
  });

  list.addEventListener('click', (event) => {
    const item = event.target.closest('.custom-dropdown-item');
    if (!item) return;
    valueInput.value = item.dataset.value || 'default.MP3';
    nameInput.value = item.dataset.name || item.dataset.value || 'default.MP3';
    trigger.querySelector('span').textContent = nameInput.value;
    menu.classList.remove('show');
  });

  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase();
    Array.from(list.children).forEach((child) => {
      const name = (child.dataset.name || '').toLowerCase();
      child.style.display = name.includes(term) ? 'block' : 'none';
    });
  });
}

function renderDropdownList(container, options) {
  container.innerHTML = options.map((option) => `
    <div class="custom-dropdown-item" data-value="${escapeHtml(option.id)}" data-name="${escapeHtml(option.name)}">${escapeHtml(option.name)}</div>
  `).join('');
}

function resetDropdownSelection(prefix, audioId) {
  const resolvedAudioId = normalizeAudioId(audioId);
  const valueInput = document.getElementById(`${prefix}AudioValue`);
  const nameInput = document.getElementById(`${prefix}AudioName`);
  const trigger = document.getElementById(`${prefix}SelectTrigger`);
  const label = getAudioLabel(resolvedAudioId, twitterState.customAudios);

  valueInput.value = resolvedAudioId;
  nameInput.value = label;
  trigger.querySelector('span').textContent = label;
}

function buildAudioOptions(customAudios) {
  const builtIns = BUILTIN_AUDIO_FILES.map((fileName) => ({
    id: fileName,
    name: fileName
  }));
  const customs = Object.entries(customAudios).map(([customId, audioItem]) => ({
    id: customId,
    name: getCustomAudioName(audioItem, customId)
  }));
  return [...builtIns, ...customs];
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

function isRemoteAudioSource(audioItem) {
  if (!audioItem) return false;
  const sourceType = typeof audioItem === 'object' ? audioItem.sourceType : '';
  if (sourceType === 'remote') return true;
  const source = typeof audioItem === 'string' ? audioItem : audioItem.data;
  return typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'));
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

function buildCustomAudioId(fileName) {
  return `custom_file_${encodeURIComponent(fileName)}`;
}

function buildCustomAudioUrlId(url) {
  return `custom_url_${encodeURIComponent(url)}`;
}

function deriveAudioNameFromUrl(url) {
  const fileName = url.pathname.split('/').pop();
  return fileName || url.hostname || url.href;
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
      alias: normalizeSpeechWatchAlias(meta && meta.alias)
    };
  }
  return next;
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(1, Math.max(0, numeric));
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
  const enabled = els.enableTTSToggle.checked;
  [els.ttsVoiceSelect, els.ttsRateSelect, els.ttsPitchSelect, els.ttsTestBtn].forEach((element) => {
    element.disabled = !enabled;
  });
}

function renderMainWindow(title, windowId, resolvedFromSnapshot) {
  if (!windowId) {
    els.mainWindow.textContent = '未设置';
    els.mainWindowMeta.textContent = '请在目标 Chrome 窗口里点击“设为主窗口”。';
    return;
  }

  els.mainWindow.textContent = `${title} (ID: ${windowId})`;
  els.mainWindowMeta.textContent = resolvedFromSnapshot
    ? '已根据最近一次保存的窗口快照自动恢复。'
    : '后续从 GMGN follow 打开的外部链接会优先落到这个窗口。';
}

function renderCurrentWindowRole() {
  const isCurrentWindowMain = Boolean(currentWindowId && selectedMainWindowId && currentWindowId === selectedMainWindowId);
  els.currentWindowRole.textContent = isCurrentWindowMain ? '当前窗口就是主窗口' : '当前窗口不是主窗口';
  els.currentWindowRole.dataset.role = isCurrentWindowMain ? 'main' : 'normal';
}

function renderButtons() {
  const isCurrentWindowMain = Boolean(currentWindowId && selectedMainWindowId && currentWindowId === selectedMainWindowId);
  els.setMainWindow.disabled = !currentWindowId || isCurrentWindowMain;
  els.clearMainWindow.disabled = !selectedMainWindowId;
}

function formatWindowTitle(windowInfo, windowId) {
  return `${getWindowTitle(windowInfo)} (ID: ${windowId ?? 'unknown'})`;
}

function getWindowTitle(windowInfo) {
  if (!windowInfo.tabs || windowInfo.tabs.length === 0) {
    return '未命名窗口';
  }

  const activeTab = windowInfo.tabs.find((tab) => tab.active) || windowInfo.tabs[0];
  return activeTab.title || activeTab.url || '未命名窗口';
}

function showToast(message, duration = 2200) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, duration);
}

function renderStatus(message) {
  els.status.textContent = message;
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

function getAudioMimeType(extension) {
  const ext = extension.toLowerCase();
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  return `audio/${ext}`;
}

function getFileExtension(fileName) {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function buildDefaultTwitterMappings() {
  return {
    elonmusk: { id: 'elonmusk.MP3', name: 'elonmusk.MP3', remark: '' },
    cz_binance: { id: 'CZ.MP3', name: 'CZ.MP3', remark: '' },
    heyibinance: { id: 'heyi.MP3', name: 'heyi.MP3', remark: '' }
  };
}
