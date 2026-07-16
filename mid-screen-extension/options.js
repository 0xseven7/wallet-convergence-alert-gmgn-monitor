const els = {
  enabled: document.getElementById('enabled'),
  relayBaseUrl: document.getElementById('relayBaseUrl'),
  marketWatchDeskBaseUrl: document.getElementById('marketWatchDeskBaseUrl'),
  openMode: document.getElementById('openMode'),
  hideGmgnHeaderActions: document.getElementById('hideGmgnHeaderActions'),
  save: document.getElementById('save'),
  checkRelay: document.getElementById('checkRelay'),
  testOpenGmgn: document.getElementById('testOpenGmgn'),
  status: document.getElementById('status')
};

async function send(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadSettings() {
  const response = await send({ type: 'gmgn-main-screen-get-settings' });
  if (!response?.ok) {
    throw new Error(response?.error || 'Load settings failed.');
  }
  const settings = response.settings;
  els.enabled.checked = settings.enabled;
  els.relayBaseUrl.value = settings.relayBaseUrl;
  els.marketWatchDeskBaseUrl.value = settings.marketWatchDeskBaseUrl;
  els.openMode.value = settings.openMode;
  els.hideGmgnHeaderActions.checked = settings.hideGmgnHeaderActions;
}

async function saveSettings() {
  const settings = {
    enabled: els.enabled.checked,
    relayBaseUrl: els.relayBaseUrl.value,
    marketWatchDeskBaseUrl: els.marketWatchDeskBaseUrl.value,
    openMode: els.openMode.value,
    hideGmgnHeaderActions: els.hideGmgnHeaderActions.checked
  };
  const response = await send({ type: 'gmgn-main-screen-save-settings', settings });
  if (!response?.ok) {
    throw new Error(response?.error || 'Save settings failed.');
  }
  setStatus('已保存');
}

async function checkRelay() {
  const response = await send({ type: 'gmgn-main-screen-check-relay' });
  if (!response?.ok) {
    throw new Error(response?.error || 'Relay check failed.');
  }
  setStatus(`Relay 正常，事件数 ${response.health.events || 0}`);
}

async function testOpenGmgn() {
  const response = await send({ type: 'gmgn-main-screen-open-url', url: 'https://gmgn.ai/' });
  if (!response?.ok) {
    throw new Error(response?.error || 'Open GMGN failed.');
  }
  setStatus('已在主屏 profile 打开 GMGN');
}

function setStatus(message) {
  els.status.textContent = message;
}

els.save.addEventListener('click', () => {
  saveSettings().catch((error) => setStatus(error.message));
});

els.checkRelay.addEventListener('click', () => {
  checkRelay().catch((error) => setStatus(error.message));
});

els.testOpenGmgn.addEventListener('click', () => {
  testOpenGmgn().catch((error) => setStatus(error.message));
});

loadSettings().catch((error) => setStatus(error.message));
