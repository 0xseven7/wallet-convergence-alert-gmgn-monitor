const HOOK_SETTINGS_KEY = 'gmgnTwitterTriggerHookSettings';
const TRADE_PROFILES_KEY = 'gmgnTwitterTradeProfiles';

const EVENT_CHOICES = [
  { value: 'tweet', label: '发推' },
  { value: 'reply', label: '回复' },
  { value: 'repost', label: '转推' },
  { value: 'quote', label: '引用' },
  { value: 'other', label: '其他' }
];
const CHAIN_CHOICES = [
  { value: 'bsc', label: 'BSC' },
  { value: 'eth', label: 'ETH' },
  { value: 'base', label: 'BASE' },
  { value: 'sol', label: 'SOL' }
];
const DEFAULT_HOOK_SETTINGS = {
  enabled: false,
  webhookUrl: '',
  secret: '',
  timeoutMs: 3000,
  directCaEnabled: false,
  directCaChain: 'bsc',
  directCaBuyAmount: '',
  directCaTwitterIds: ''
};

const els = {
  toast: document.getElementById('toast'),
  hookEnabled: document.getElementById('hookEnabled'),
  hookUrl: document.getElementById('hookUrl'),
  hookSecret: document.getElementById('hookSecret'),
  hookTimeout: document.getElementById('hookTimeout'),
  saveHookBtn: document.getElementById('saveHookBtn'),
  profileEnabled: document.getElementById('profileEnabled'),
  profileTwitterId: document.getElementById('profileTwitterId'),
  profileEventTypes: document.getElementById('profileEventTypes'),
  profileChain: document.getElementById('profileChain'),
  profileBuyAmount: document.getElementById('profileBuyAmount'),
  profileAutoSlippage: document.getElementById('profileAutoSlippage'),
  profileSlippage: document.getElementById('profileSlippage'),
  profileGasPriceGwei: document.getElementById('profileGasPriceGwei'),
  profileTipFeeBnb: document.getElementById('profileTipFeeBnb'),
  profileAntiMev: document.getElementById('profileAntiMev'),
  profileKeywords: document.getElementById('profileKeywords'),
  profileExcludeKeywords: document.getElementById('profileExcludeKeywords'),
  profileMarketCapMin: document.getElementById('profileMarketCapMin'),
  profileMarketCapMax: document.getElementById('profileMarketCapMax'),
  profileMaxAgeSeconds: document.getElementById('profileMaxAgeSeconds'),
  profileProfitScale: document.getElementById('profileProfitScale'),
  profileProfitSellRatio: document.getElementById('profileProfitSellRatio'),
  profileNote: document.getElementById('profileNote'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  cancelProfileBtn: document.getElementById('cancelProfileBtn'),
  profilesList: document.getElementById('profilesList')
};

let hookSettings = { ...DEFAULT_HOOK_SETTINGS };
let profiles = [];
let editingProfileId = null;

initialize().catch((error) => {
  showToast(error.message || '初始化失败');
});

async function initialize() {
  populateSelect(els.profileEventTypes, EVENT_CHOICES);
  populateSelect(els.profileChain, CHAIN_CHOICES);
  bindEvents();
  await Promise.all([loadHookSettings(), loadProfiles()]);
  resetProfileForm();
}

function bindEvents() {
  els.saveHookBtn.addEventListener('click', saveHookSettings);
  els.saveProfileBtn.addEventListener('click', saveProfile);
  els.cancelProfileBtn.addEventListener('click', resetProfileForm);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[HOOK_SETTINGS_KEY]) {
      hookSettings = normalizeHookSettings(changes[HOOK_SETTINGS_KEY].newValue);
      renderHookSettings();
    }
    if (changes[TRADE_PROFILES_KEY]) {
      profiles = normalizeProfiles(changes[TRADE_PROFILES_KEY].newValue);
      renderProfiles();
    }
  });
}

async function loadHookSettings() {
  const stored = await chrome.storage.local.get(HOOK_SETTINGS_KEY);
  hookSettings = normalizeHookSettings(stored[HOOK_SETTINGS_KEY]);
  renderHookSettings();
}

async function loadProfiles() {
  const stored = await chrome.storage.local.get(TRADE_PROFILES_KEY);
  profiles = normalizeProfiles(stored[TRADE_PROFILES_KEY]);
  renderProfiles();
}

async function saveHookSettings() {
  hookSettings = normalizeHookSettings({
    enabled: els.hookEnabled.checked,
    webhookUrl: els.hookUrl.value,
    secret: els.hookSecret.value,
    timeoutMs: els.hookTimeout.value
  });
  renderHookSettings();
  await chrome.storage.local.set({ [HOOK_SETTINGS_KEY]: hookSettings });
  showToast('已保存 Hook 设置');
}

async function saveProfile() {
  const profile = collectProfile();
  if (!profile) return;

  const nextProfiles = [...profiles];
  const existingIndex = nextProfiles.findIndex((item) => item.id === profile.id);
  if (existingIndex >= 0) {
    nextProfiles[existingIndex] = profile;
  } else {
    nextProfiles.push(profile);
  }

  profiles = normalizeProfiles(nextProfiles);
  await chrome.storage.local.set({ [TRADE_PROFILES_KEY]: profiles });
  renderProfiles();
  resetProfileForm();
  showToast(`${existingIndex >= 0 ? '已更新' : '已新增'}策略：@${profile.twitterId}`);
}

function collectProfile() {
  const twitterId = normalizeTwitterId(els.profileTwitterId.value);
  const buyAmount = String(els.profileBuyAmount.value || '').trim();
  const eventTypes = getSelectedValues(els.profileEventTypes);
  const profitScale = normalizeOptionalNumber(els.profileProfitScale.value);
  const profitSellRatio = normalizeOptionalNumber(els.profileProfitSellRatio.value);

  if (!twitterId) {
    showToast('请先输入推特 ID');
    return null;
  }
  if (!buyAmount || Number(buyAmount) <= 0) {
    showToast('请填写有效买入数量');
    return null;
  }
  if (eventTypes.length === 0) {
    showToast('至少选择一个事件类型');
    return null;
  }
  if ((profitScale && !profitSellRatio) || (!profitScale && profitSellRatio)) {
    showToast('止盈涨幅和卖出比例需要同时填写');
    return null;
  }

  const conditionOrders = profitScale && profitSellRatio
    ? [{
        order_type: 'profit_stop',
        side: 'sell',
        price_scale: String(profitScale),
        sell_ratio: String(profitSellRatio)
      }]
    : [];

  return normalizeProfile({
    id: editingProfileId || buildProfileId(),
    enabled: els.profileEnabled.checked,
    twitterId,
    eventTypes,
    keywords: splitLines(els.profileKeywords.value),
    excludeKeywords: splitLines(els.profileExcludeKeywords.value),
    chain: els.profileChain.value,
    mode: 'tweet-ca',
    buyAmount,
    filters: {
      marketCapMinUsd: normalizeOptionalNumber(els.profileMarketCapMin.value),
      marketCapMaxUsd: normalizeOptionalNumber(els.profileMarketCapMax.value),
      maxTokenAgeSeconds: normalizeOptionalNumber(els.profileMaxAgeSeconds.value)
    },
    execution: {
      autoSlippage: els.profileAutoSlippage.checked,
      slippage: normalizeOptionalNumber(els.profileSlippage.value),
      gasPriceGwei: normalizeOptionalNumber(els.profileGasPriceGwei.value),
      tipFeeBnb: normalizeOptionalNumber(els.profileTipFeeBnb.value),
      antiMev: els.profileAntiMev.checked
    },
    conditionOrders,
    note: els.profileNote.value
  }, profiles.length);
}

function renderHookSettings() {
  els.hookEnabled.checked = hookSettings.enabled;
  els.hookUrl.value = hookSettings.webhookUrl;
  els.hookSecret.value = hookSettings.secret;
  els.hookTimeout.value = String(hookSettings.timeoutMs);
}

function renderProfiles() {
  els.profilesList.innerHTML = '';
  if (profiles.length === 0) {
    els.profilesList.innerHTML = '<div class="empty-state">暂无交易策略</div>';
    return;
  }

  const sortedProfiles = [...profiles].sort((left, right) => left.twitterId.localeCompare(right.twitterId));
  for (const profile of sortedProfiles) {
    const row = document.createElement('div');
    row.className = 'list-item trade-profile-item';
    const filters = buildFilterLabel(profile);
    const execution = buildExecutionLabel(profile);
    const orders = profile.conditionOrders.length > 0
      ? profile.conditionOrders.map((order) => `+${order.price_scale}% 卖 ${order.sell_ratio}%`).join(' / ')
      : '无止盈挂单';
    row.innerHTML = `
      <div class="item-info">
        <span class="item-title">@${escapeHtml(profile.twitterId)} · ${escapeHtml(profile.chain.toUpperCase())} · 买入 ${escapeHtml(profile.buyAmount)}</span>
        <span class="item-sub">${escapeHtml(profile.eventTypes.join(' / '))}${profile.keywords.length ? ` · ${escapeHtml(profile.keywords.join(' / '))}` : ''}</span>
        <span class="item-sub">${escapeHtml(filters)} · ${escapeHtml(execution)} · ${escapeHtml(orders)}${profile.note ? ` · ${escapeHtml(profile.note)}` : ''}</span>
      </div>
      <div class="action-btns">
        <button class="btn-icon toggle" type="button">${profile.enabled ? '停用' : '启用'}</button>
        <button class="btn-icon" type="button">编辑</button>
        <button class="btn-icon del" type="button">删除</button>
      </div>
    `;

    const buttons = row.querySelectorAll('button');
    buttons[0].addEventListener('click', () => toggleProfile(profile.id));
    buttons[1].addEventListener('click', () => editProfile(profile.id));
    buttons[2].addEventListener('click', () => deleteProfile(profile.id));
    els.profilesList.appendChild(row);
  }
}

async function toggleProfile(profileId) {
  const nextProfiles = profiles.map((profile) => (
    profile.id === profileId ? { ...profile, enabled: !profile.enabled } : profile
  ));
  profiles = normalizeProfiles(nextProfiles);
  await chrome.storage.local.set({ [TRADE_PROFILES_KEY]: profiles });
  renderProfiles();
}

function editProfile(profileId) {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) return;

  editingProfileId = profile.id;
  els.profileEnabled.checked = profile.enabled;
  els.profileTwitterId.value = profile.twitterId;
  setSelectedValues(els.profileEventTypes, profile.eventTypes);
  els.profileChain.value = profile.chain;
  els.profileBuyAmount.value = profile.buyAmount;
  els.profileAutoSlippage.checked = profile.execution.autoSlippage;
  els.profileSlippage.value = profile.execution.slippage || '';
  els.profileGasPriceGwei.value = profile.execution.gasPriceGwei || '';
  els.profileTipFeeBnb.value = profile.execution.tipFeeBnb || '';
  els.profileAntiMev.checked = profile.execution.antiMev;
  els.profileKeywords.value = profile.keywords.join('\n');
  els.profileExcludeKeywords.value = profile.excludeKeywords.join('\n');
  els.profileMarketCapMin.value = profile.filters.marketCapMinUsd || '';
  els.profileMarketCapMax.value = profile.filters.marketCapMaxUsd || '';
  els.profileMaxAgeSeconds.value = profile.filters.maxTokenAgeSeconds || '';
  const profitOrder = profile.conditionOrders.find((order) => order.order_type === 'profit_stop');
  els.profileProfitScale.value = profitOrder ? profitOrder.price_scale : '';
  els.profileProfitSellRatio.value = profitOrder ? profitOrder.sell_ratio : '';
  els.profileNote.value = profile.note;
  els.saveProfileBtn.textContent = '保存修改';
}

async function deleteProfile(profileId) {
  profiles = profiles.filter((profile) => profile.id !== profileId);
  if (editingProfileId === profileId) {
    resetProfileForm();
  }
  await chrome.storage.local.set({ [TRADE_PROFILES_KEY]: profiles });
  renderProfiles();
}

function resetProfileForm() {
  editingProfileId = null;
  els.profileEnabled.checked = true;
  els.profileTwitterId.value = '';
  setSelectedValues(els.profileEventTypes, ['tweet', 'reply']);
  els.profileChain.value = 'bsc';
  els.profileBuyAmount.value = '';
  els.profileAutoSlippage.checked = true;
  els.profileSlippage.value = '';
  els.profileGasPriceGwei.value = '';
  els.profileTipFeeBnb.value = '';
  els.profileAntiMev.checked = true;
  els.profileKeywords.value = '';
  els.profileExcludeKeywords.value = '';
  els.profileMarketCapMin.value = '';
  els.profileMarketCapMax.value = '';
  els.profileMaxAgeSeconds.value = '';
  els.profileProfitScale.value = '';
  els.profileProfitSellRatio.value = '';
  els.profileNote.value = '';
  els.saveProfileBtn.textContent = '保存策略';
}

function normalizeHookSettings(raw) {
  const settings = {
    ...DEFAULT_HOOK_SETTINGS,
    ...(raw || {})
  };
  settings.enabled = settings.enabled === true;
  settings.webhookUrl = String(settings.webhookUrl || '').trim();
  settings.secret = String(settings.secret || '').trim();
  settings.timeoutMs = clampInteger(settings.timeoutMs, DEFAULT_HOOK_SETTINGS.timeoutMs, 500, 15000);
  return settings;
}

function normalizeProfiles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((profile, index) => normalizeProfile(profile, index)).filter(Boolean);
}

function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== 'object') return null;
  const twitterId = normalizeTwitterId(profile.twitterId);
  const chain = normalizeChain(profile.chain);
  const buyAmount = String(profile.buyAmount || '').trim();
  if (!twitterId || !buyAmount) return null;

  return {
    id: String(profile.id || '').trim() || `twitter-trade-${index + 1}`,
    enabled: profile.enabled !== false,
    twitterId,
    eventTypes: normalizeEventTypes(profile.eventTypes),
    keywords: normalizeStringList(profile.keywords),
    excludeKeywords: normalizeStringList(profile.excludeKeywords),
    chain,
    mode: 'tweet-ca',
    buyAmount,
    filters: normalizeFilters(profile.filters),
    execution: normalizeExecution(profile.execution),
    conditionOrders: normalizeConditionOrders(profile.conditionOrders),
    note: String(profile.note || '').trim()
  };
}

function normalizeFilters(filters) {
  const raw = filters && typeof filters === 'object' ? filters : {};
  return {
    marketCapMinUsd: normalizeOptionalNumber(raw.marketCapMinUsd),
    marketCapMaxUsd: normalizeOptionalNumber(raw.marketCapMaxUsd),
    maxTokenAgeSeconds: normalizeOptionalNumber(raw.maxTokenAgeSeconds)
  };
}

function normalizeExecution(value) {
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

function normalizeEventTypes(value) {
  const allowed = new Set(EVENT_CHOICES.map((option) => option.value));
  const items = normalizeStringList(value).filter((item) => allowed.has(item));
  return items.length > 0 ? items : ['tweet'];
}

function normalizeChain(value) {
  const chain = String(value || '').trim().toLowerCase();
  return CHAIN_CHOICES.some((option) => option.value === chain) ? chain : 'bsc';
}

function splitLines(value) {
  return String(value || '').split(/[\r\n,，]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  }
  return splitLines(value).map((item) => item.toLowerCase());
}

function normalizeTwitterId(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

function normalizeOptionalNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildProfileId() {
  return `twitter-trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildFilterLabel(profile) {
  const parts = [];
  if (profile.filters.marketCapMinUsd) parts.push(`MC > ${profile.filters.marketCapMinUsd}`);
  if (profile.filters.marketCapMaxUsd) parts.push(`MC < ${profile.filters.marketCapMaxUsd}`);
  if (profile.filters.maxTokenAgeSeconds) parts.push(`创建 < ${profile.filters.maxTokenAgeSeconds}s`);
  return parts.length > 0 ? parts.join(' / ') : '无过滤';
}

function buildExecutionLabel(profile) {
  const execution = normalizeExecution(profile.execution);
  const parts = [];
  parts.push(execution.autoSlippage ? '自动滑点' : `滑点 ${execution.slippage || '0.01'}%`);
  if (execution.gasPriceGwei) parts.push(`Gas ${execution.gasPriceGwei} Gwei`);
  if (execution.tipFeeBnb) parts.push(`Tip ${execution.tipFeeBnb} BNB`);
  parts.push(execution.antiMev ? '防夹开' : '防夹关');
  return parts.join(' / ');
}

function populateSelect(select, options) {
  select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
}

function getSelectedValues(select) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function setSelectedValues(select, values) {
  const selected = new Set(values);
  Array.from(select.options).forEach((option) => {
    option.selected = selected.has(option.value);
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
