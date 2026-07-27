(() => {
  'use strict';

  const STORAGE_KEY = 'fomoCollectorModeEnabledV1';
  const DEFAULT_ENABLED = true;
  const SHELL_ID = 'gcp-fomo-collector-shell';
  const MODE_CLASS = 'gcp-fomo-collector-mode';
  const MODE_EVENT = 'wallet-convergence:fomo-collector-mode';
  const WSS_STATE_EVENT = 'wallet-convergence:fomo-wss-state';
  const WSS_DATA_EVENT = 'wallet-convergence:fomo-wss-event';

  if (window.__walletConvergenceFomoCollectorModeInstalled) return;
  window.__walletConvergenceFomoCollectorModeInstalled = true;

  let enabled = DEFAULT_ENABLED;
  let shell = null;
  let stateElement = null;
  let countElement = null;
  let lastEventElement = null;
  let toggleButton = null;
  let eventCount = 0;
  let currentStatus = 'waiting_for_session';

  const statusLabels = {
    waiting_for_session: '等待 FOMO 登录',
    connecting: '正在连接',
    authenticating: '正在认证',
    ready: 'WSS 已连接',
    reconnecting: '正在重连',
    error: '连接异常'
  };

  function dispatchModeState() {
    window.dispatchEvent(new CustomEvent(MODE_EVENT, {
      detail: { enabled }
    }));
  }

  function applyMode() {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle(MODE_CLASS, enabled);
    root.dataset.gcpFomoCollectorMode = enabled ? '1' : '0';
    if (shell) {
      shell.classList.toggle('is-compact', !enabled);
      shell.setAttribute('aria-label', enabled ? 'FOMO 轻量采集正在运行' : '开启 FOMO 轻量采集');
    }
    if (toggleButton) {
      toggleButton.textContent = enabled ? '显示完整页面' : '开启轻量采集';
    }
    dispatchModeState();
  }

  function renderStatus() {
    if (stateElement) {
      stateElement.textContent = statusLabels[currentStatus] || currentStatus || '等待连接';
      stateElement.dataset.status = currentStatus;
    }
    if (countElement) countElement.textContent = String(eventCount);
  }

  function setEnabled(nextEnabled, persist = true) {
    enabled = Boolean(nextEnabled);
    applyMode();
    if (persist) {
      chrome.storage.local.set({ [STORAGE_KEY]: enabled }).catch(() => {});
    }
  }

  function createShell() {
    if (!document.body || document.getElementById(SHELL_ID)) return;
    shell = document.createElement('section');
    shell.id = SHELL_ID;
    shell.innerHTML = `
      <div class="gcp-fomo-collector-card">
        <div class="gcp-fomo-collector-mark" aria-hidden="true">F</div>
        <div class="gcp-fomo-collector-copy">
          <strong>FOMO 轻量采集</strong>
          <span class="gcp-fomo-collector-state"><i></i><b></b></span>
          <small>WSS 和提醒继续运行；重型页面绘制已暂停</small>
        </div>
        <dl class="gcp-fomo-collector-stats">
          <div><dt>本页事件</dt><dd data-role="count">0</dd></div>
          <div><dt>最后收到</dt><dd data-role="last-event">--:--:--</dd></div>
        </dl>
        <button type="button" data-role="toggle"></button>
      </div>
    `;
    document.body.appendChild(shell);
    stateElement = shell.querySelector('.gcp-fomo-collector-state b');
    countElement = shell.querySelector('[data-role="count"]');
    lastEventElement = shell.querySelector('[data-role="last-event"]');
    toggleButton = shell.querySelector('[data-role="toggle"]');
    toggleButton.addEventListener('click', () => setEnabled(!enabled));
    applyMode();
    renderStatus();
  }

  function mountWhenReady() {
    if (document.body) {
      createShell();
      return;
    }
    document.addEventListener('DOMContentLoaded', createShell, { once: true });
  }

  window.addEventListener(WSS_STATE_EVENT, (event) => {
    currentStatus = String(event.detail?.status || 'waiting_for_session');
    renderStatus();
  });

  window.addEventListener(WSS_DATA_EVENT, () => {
    eventCount += 1;
    if (lastEventElement) {
      lastEventElement.textContent = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    renderStatus();
  });

  applyMode();
  mountWhenReady();
  chrome.storage.local.get(STORAGE_KEY).then((stored) => {
    setEnabled(
      typeof stored?.[STORAGE_KEY] === 'boolean' ? stored[STORAGE_KEY] : DEFAULT_ENABLED,
      false
    );
  }).catch(() => {
    setEnabled(DEFAULT_ENABLED, false);
  });
})();
