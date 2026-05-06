const currentWindowElement = document.getElementById('current-window');
const currentWindowRoleElement = document.getElementById('current-window-role');
const mainWindowElement = document.getElementById('main-window');
const mainWindowMetaElement = document.getElementById('main-window-meta');
const statusElement = document.getElementById('status');
const setMainWindowButton = document.getElementById('set-main-window');
const clearMainWindowButton = document.getElementById('clear-main-window');

const GET_MAIN_WINDOW_MESSAGE = 'get-main-window';
const SET_MAIN_WINDOW_MESSAGE = 'set-main-window';
const CLEAR_MAIN_WINDOW_MESSAGE = 'clear-main-window';

let currentWindowId = null;
let selectedMainWindowId = null;

initialize().catch((error) => {
  renderStatus(error.message || '初始化失败');
});

setMainWindowButton.addEventListener('click', async () => {
  if (!currentWindowId) {
    renderStatus('当前窗口不可用');
    return;
  }

  const result = await chrome.runtime.sendMessage({
    type: SET_MAIN_WINDOW_MESSAGE,
    windowId: currentWindowId
  });

  if (!result || !result.ok) {
    renderStatus(result && result.error ? result.error : '设置失败');
    return;
  }

  selectedMainWindowId = result.windowId;
  renderMainWindow(result.title, result.windowId, false);
  renderCurrentWindowRole();
  renderButtons();
  renderStatus('已将当前窗口设为主窗口');
});

clearMainWindowButton.addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: CLEAR_MAIN_WINDOW_MESSAGE });

  if (!result || !result.ok) {
    renderStatus(result && result.error ? result.error : '清除失败');
    return;
  }

  selectedMainWindowId = null;
  renderMainWindow(null, null, false);
  renderCurrentWindowRole();
  renderButtons();
  renderStatus('已清除主窗口设置');
});

async function initialize() {
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  currentWindowId = currentWindow.id || null;
  currentWindowElement.textContent = formatWindowTitle(currentWindow, currentWindowId);

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

function renderMainWindow(title, windowId, resolvedFromSnapshot) {
  if (!windowId) {
    mainWindowElement.textContent = '未设置';
    mainWindowMetaElement.textContent = '请在目标 Chrome 窗口里点击“设为主窗口”。';
    return;
  }

  mainWindowElement.textContent = `${title} (ID: ${windowId})`;
  mainWindowMetaElement.textContent = resolvedFromSnapshot
    ? '已根据最近窗口快照自动恢复主窗口。'
    : '后续从 GMGN follow 打开的链接会优先落到这个窗口。';
}

function renderCurrentWindowRole() {
  const isCurrentWindowMain = Boolean(currentWindowId && selectedMainWindowId && currentWindowId === selectedMainWindowId);

  currentWindowRoleElement.textContent = isCurrentWindowMain
    ? '当前窗口就是主窗口'
    : '当前窗口不是主窗口';
  currentWindowRoleElement.dataset.role = isCurrentWindowMain ? 'main' : 'normal';
}

function renderButtons() {
  const isCurrentWindowMain = Boolean(currentWindowId && selectedMainWindowId && currentWindowId === selectedMainWindowId);

  setMainWindowButton.disabled = !currentWindowId || isCurrentWindowMain;
  clearMainWindowButton.disabled = !selectedMainWindowId;
}

function formatWindowTitle(windowInfo, windowId) {
  return `${getWindowTitle(windowInfo)} (ID: ${windowId ?? 'unknown'})`;
}

function getWindowTitle(windowInfo) {
  if (!windowInfo.tabs || windowInfo.tabs.length === 0) {
    return 'Untitled window';
  }

  const activeTab = windowInfo.tabs.find((tab) => tab.active) || windowInfo.tabs[0];
  return activeTab.title || activeTab.url || 'Untitled window';
}

function renderStatus(message) {
  statusElement.textContent = message;
}
