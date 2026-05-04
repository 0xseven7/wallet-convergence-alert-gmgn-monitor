(function () {
  'use strict';
  if (window.__gcpLoaded) return;
  window.__gcpLoaded = true;

  // ===== 配置 =====
  const DEFAULT_CONFIG = {
    minWallets: 2,
    timeWindowMin: 30,   // gmgn 列表时间跨度比 xxyy 大，默认 30 分钟
    soundEnabled: true,
    collapsed: false,
    tieredAlerts: true
  };

  let config = { ...DEFAULT_CONFIG };
  let alerts = [];
  let buyRecords = [];
  let closedRecords = [];
  let seenKeys = new Set();
  let seenClosedKeys = new Set();
  let panelEl = null;
  let observer = null;
  let scanInterval = null;
  let mountCheckInterval = null;
  let injectStarsScheduled = false;

  // 特别关注的钱包名
  let starred = new Set();

  // 代币元数据：mint → { chain, symbol, logo }
  const tokenMeta = new Map();

  // 缩写合约
  function shortMint(m) {
    if (!m) return '';
    if (m.length <= 10) return m;
    return m.slice(0, 4) + '…' + m.slice(-4);
  }

  // ===== 检测代币发射平台 =====
  function detectPlatform(mint, chain, dexHint) {
    const m = (mint || '').toLowerCase();
    const c = (chain || '').toLowerCase();
    const d = (dexHint || '').toLowerCase();
    if (c === 'sol') {
      if (m.endsWith('pump')) return { tag: 'pump', label: 'pump.fun', cls: 'gcp-plat-pump' };
      if (m.endsWith('bonk')) return { tag: 'bonk', label: 'bonk.fun', cls: 'gcp-plat-bonk' };
      if (m.endsWith('boop')) return { tag: 'boop', label: 'boop.fun', cls: 'gcp-plat-boop' };
    }
    if (c === 'bsc' || c === 'bnb') {
      if (d.includes('four') || d.includes('4.meme')) return { tag: 'four', label: 'four.meme', cls: 'gcp-plat-four' };
    }
    if (d.includes('pump')) return { tag: 'pump', label: 'pump.fun', cls: 'gcp-plat-pump' };
    return null;
  }

  try {
    const saved = localStorage.getItem('gcp_config');
    if (saved) Object.assign(config, JSON.parse(saved));
    const savedStars = localStorage.getItem('gcp_starred');
    if (savedStars) starred = new Set(JSON.parse(savedStars));
  } catch (e) {}

  function saveConfig() {
    try { localStorage.setItem('gcp_config', JSON.stringify(config)); } catch (e) {}
  }
  function saveStarred() {
    try { localStorage.setItem('gcp_starred', JSON.stringify(Array.from(starred))); } catch (e) {}
  }

  function toggleStar(walletName) {
    if (!walletName) return;
    if (starred.has(walletName)) starred.delete(walletName);
    else starred.add(walletName);
    saveStarred();
    lastRenderState = '';
    renderAlerts();
    injectOrigStars();
  }

  function isAlertStarred(a) {
    return a.wallets && a.wallets.some(w => starred.has(w.name));
  }

  // ===== DOM 定位：找到追踪 tab 的虚拟列表 =====
  // gmgn 的钱包追踪面板：内含 .pi-tabs 顶部 tabs + .virtual-list-container 列表
  function findTrackingPanel() {
    // 找包含 "钱包 N" tab 的容器
    const tabBtns = document.querySelectorAll('.pi-tabs-tab-btn');
    for (const t of tabBtns) {
      if (/^钱包\s*\d+$/.test(t.textContent.trim())) {
        return t.closest('.flex.flex-col.size-full') || t.closest('.flex-col.gap-12px') || t.closest('.pi-tabs')?.parentElement;
      }
    }
    return null;
  }

  function findVirtualList() {
    const panel = findTrackingPanel();
    if (!panel) return null;
    return panel.querySelector('.virtual-list-container');
  }

  // 检查当前是否在 追踪 tab
  function isOnTrackingTab() {
    const panel = findTrackingPanel();
    if (!panel) return false;
    const tabs = panel.querySelectorAll('.pi-tabs-tab-btn');
    for (const t of tabs) {
      if (t.classList.contains('pi-tabs-tab-btn-active') || t.parentElement?.classList.contains('pi-tabs-tab-active')) {
        return /追踪/.test(t.textContent.trim());
      }
    }
    return true;  // 找不到激活态就假定在追踪
  }

  // ===== 解析单条 trade =====
  function parseTradeRow(row) {
    if (!row || !row.querySelector) return null;
    const a = row.querySelector('a');
    if (!a) return null;

    const href = a.getAttribute('href') || '';
    const m = href.match(/\/(sol|eth|bsc|base|tron|blast)\/token\/([1-9A-HJ-NP-Za-km-z]{32,}|0x[a-fA-F0-9]{40})/i);
    const chain = m ? m[1].toLowerCase() : '';
    const mint = m ? m[2] : '';

    // 钱包名：第一个 .text-yellow-100 的 AutoTruncateText
    const walletEl = a.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
      || a.querySelector('[data-sentry-component="AutoTruncateText"]');
    const wallet = walletEl ? walletEl.textContent.trim() : '';
    if (!wallet) return null;

    // 第一行：动作 + 涨跌 + 时间
    const line1 = a.children[0];
    const line2 = a.children[1];
    if (!line1 || !line2) return null;

    // 动作：含 清仓/加仓/建仓/减仓/买入/卖出
    let action = '';
    let isBuy = false;
    line1.querySelectorAll('.whitespace-nowrap').forEach(el => {
      const t = el.textContent.trim();
      if (!action && /(清仓|加仓|建仓|减仓|买入|卖出)/.test(t)) action = t;
    });
    if (/(加仓|建仓|买入)/.test(action)) isBuy = true;

    // 时间："2h" / "5m" / "3d"
    const timeEls = line1.querySelectorAll('.text-text-300.inline');
    let timeAgo = '';
    timeEls.forEach(el => {
      const t = el.textContent.trim();
      if (/^\d+[smhd]$/.test(t.replace(/\s/g, ''))) timeAgo = t.replace(/\s/g, '');
    });
    if (!timeAgo) {
      // 兜底：line1 里找 \d+[smhd] 模式
      const txt = line1.textContent.replace(/\s+/g, ' ');
      const tm = txt.match(/(\d+)\s*([smhd])\b/);
      if (tm) timeAgo = tm[1] + tm[2];
    }

    // line2: <amount><tokenSymbol><tradeAge> MC:$<mcap>
    const line2Text = line2.textContent.replace(/\s+/g, ' ').trim();
    // 拆 MC:
    const mcMatch = line2Text.match(/MC[:\s]*[\$￥]?([\d.]+[KMBkmb]?)/);
    const mcap = mcMatch ? '$' + mcMatch[1] : '';
    let headPart = mcMatch ? line2Text.substring(0, line2Text.indexOf(mcMatch[0])).trim() : line2Text;
    // **先剥掉末尾的时间** (\d+[smhd]) — 否则会被当成 token 名的一部分
    let tradeAge = '';
    const tmTail = headPart.match(/(\d+[smhd])\s*$/);
    if (tmTail) {
      tradeAge = tmTail[1];
      headPart = headPart.substring(0, headPart.length - tmTail[0].length).trim();
    }
    // headPart 现在只剩 "<amount><tokenSymbol>"
    let amount = '', tokenSymbol = '';
    const am = headPart.match(/^([\d.,]+)/);
    if (am) {
      amount = am[1];
      tokenSymbol = headPart.substring(am[1].length).trim();
    } else {
      tokenSymbol = headPart;
    }

    // 把时间 "2h" 转成毫秒（相对 now）
    let timeMs = Date.now();
    const tm = timeAgo.match(/^(\d+)([smhd])$/);
    if (tm) {
      const n = parseInt(tm[1]);
      const unit = tm[2];
      const ms = n * (unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000);
      timeMs = Date.now() - ms;
    }

    // 钱包头像 = line 1 里第一个 <img>
    const walletAvatar = line1.querySelector('img')?.src || '';
    // 代币 logo = line 2 里非 native 链图标的图片（链图标 src 含 'icons/icon_'）
    let tokenLogo = '';
    line2.querySelectorAll('img').forEach(img => {
      const src = img.src || '';
      if (!tokenLogo && !src.includes('/icons/icon_')) tokenLogo = src;
    });

    // 累积 token meta
    if (mint) {
      const existing = tokenMeta.get(mint) || {};
      tokenMeta.set(mint, {
        chain: chain || existing.chain,
        symbol: tokenSymbol || existing.symbol,
        logo: tokenLogo || existing.logo
      });
    }

    // gmgn 没有显式的 dex 字段，靠 mint 后缀检测平台（BSC 的 four.meme 暂时识别不到）
    const platform = detectPlatform(mint, chain, '');

    return {
      wallet,
      walletAvatar,
      action,
      isBuy,
      token: tokenSymbol,
      mint,
      chain,
      amount,
      mcap,
      timeAgo,
      tradeAge,
      timeMs,
      tokenLogo,
      href,
      platform
    };
  }

  // ===== 扫描列表 =====
  function scanTrades() {
    const list = findVirtualList();
    if (!list) return;
    if (!isOnTrackingTab()) return;
    const rowsRoot = list.children[0]?.children[0];
    if (!rowsRoot) return;
    const rows = rowsRoot.children;

    let added = 0;
    for (const row of rows) {
      const trade = parseTradeRow(row);
      if (!trade) continue;
      if (trade.isBuy) {
        // 用 mint+wallet+timeAgo 组合做去重 key（gmgn 没有 signature）
        const key = `${trade.mint || trade.token}|${trade.wallet}|${trade.timeAgo}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        buyRecords.push(trade);
        added++;
      } else if (trade.action && trade.action.includes('清仓')) {
        // 清仓事件：用同样的 key 模式去重，存入 closedRecords
        const ck = `C|${trade.mint || trade.token}|${trade.wallet}|${trade.timeAgo}`;
        if (seenClosedKeys.has(ck)) continue;
        seenClosedKeys.add(ck);
        closedRecords.push(trade);
        added++;
      }
    }

    if (added > 0) {
      cleanOldRecords();
      checkConvergence();
    }

    if (seenKeys.size > 5000) {
      seenKeys = new Set(Array.from(seenKeys).slice(-2500));
    }

    // 持续注入星标
    scheduleInjectStars();
  }

  function cleanOldRecords() {
    const now = Date.now();
    const cutoff = config.timeWindowMin * 60 * 1000;
    buyRecords = buyRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff);
    closedRecords = closedRecords.filter(r => r.timeMs && (now - r.timeMs) < cutoff * 2);
    if (seenKeys.size > 5000) seenKeys = new Set(Array.from(seenKeys).slice(-2500));
    if (seenClosedKeys.size > 5000) seenClosedKeys = new Set(Array.from(seenClosedKeys).slice(-2500));
  }

  // ===== 聚合检测 =====
  function checkConvergence() {
    const now = Date.now();
    const windowMs = config.timeWindowMin * 60 * 1000;
    const groups = {};

    for (const r of buyRecords) {
      if (!r.timeMs || (now - r.timeMs) > windowMs) continue;
      // 严格按 mint 聚合，没 mint 不参与
      if (!r.mint) continue;
      const key = r.mint;
      if (!groups[key]) groups[key] = { wallets: {}, mcap: r.mcap, mint: r.mint, chain: r.chain, token: r.token, tokenLogo: r.tokenLogo, platform: r.platform || null };
      const g = groups[key];
      if (!g.wallets[r.wallet]) g.wallets[r.wallet] = { amount: r.amount, timeAgo: r.timeAgo, timeMs: r.timeMs, avatar: r.walletAvatar };
      if (r.mcap) g.mcap = r.mcap;
      if (r.token) g.token = r.token;
      if (r.tokenLogo && !g.tokenLogo) g.tokenLogo = r.tokenLogo;
      if (r.platform && !g.platform) g.platform = r.platform;
    }

    let triggered = false, updated = false;
    let highestTierFired = 0;

    for (const [groupKey, group] of Object.entries(groups)) {
      const walletNames = Object.keys(group.wallets);
      if (walletNames.length < config.minWallets) continue;

      const walletDetails = walletNames.map(w => {
        const wd = group.wallets[w];
        const closeMatch = closedRecords.find(c =>
          c.wallet === w &&
          ((group.mint && c.mint === group.mint) ||
           (!group.mint && !c.mint && c.token === group.token)) &&
          c.timeMs > wd.timeMs
        );
        return {
          name: w,
          amount: wd.amount,
          timeAgo: wd.timeAgo,
          timeMs: wd.timeMs,
          avatar: wd.avatar,
          closed: !!closeMatch,
          closedAt: closeMatch ? closeMatch.timeMs : null
        };
      });
      const closedCount = walletDetails.filter(w => w.closed).length;
      const effectiveCount = walletNames.length - closedCount;

      const newTier = calcTier(effectiveCount);

      // 严格按 mint 匹配（group.mint 一定存在）
      const existing = alerts.find(a => a.mint && a.mint === group.mint);

      if (existing) {
        const sameCount = existing.walletCount === walletNames.length;
        const sameClose = (existing.closedCount || 0) === closedCount;
        if (sameCount && sameClose) continue;
        const prevTier = existing.tier || calcTier(existing.effectiveCount || existing.walletCount);
        existing.walletCount = walletNames.length;
        existing.effectiveCount = effectiveCount;
        existing.closedCount = closedCount;
        existing.wallets = walletDetails;
        existing.mcap = group.mcap || existing.mcap;
        existing.token = group.token || existing.token;
        existing.mint = group.mint || existing.mint;
        existing.chain = group.chain || existing.chain;
        existing.tokenLogo = group.tokenLogo || existing.tokenLogo;
        existing.platform = group.platform || existing.platform;
        existing.tier = newTier;
        existing.isNew = true;
        updated = true;
        if (newTier > prevTier && newTier > highestTierFired) highestTierFired = newTier;
        setTimeout(() => { existing.isNew = false; renderAlerts(); }, 1500);
      } else {
        const alert = {
          token: group.token,
          mint: group.mint,
          chain: group.chain,
          tokenLogo: group.tokenLogo,
          platform: group.platform,
          walletCount: walletNames.length,
          effectiveCount,
          closedCount,
          wallets: walletDetails,
          mcap: group.mcap,
          tier: newTier,
          triggeredAt: Date.now(),
          isNew: true
        };
        alerts.unshift(alert);
        if (alerts.length > 30) alerts = alerts.slice(0, 30);
        triggered = true;
        if (newTier > highestTierFired) highestTierFired = newTier;
        setTimeout(() => { alert.isNew = false; renderAlerts(); }, 1500);
      }
    }

    if (triggered || updated) {
      renderAlerts();
      if (triggered || highestTierFired > 0) { playSound(highestTierFired || 1); flashBadge(); }
    }
  }

  // ===== 声音 =====
  let _audioCtx = null, _audioReady = false;
  function ensureAudioCtx() {
    if (_audioReady) return _audioCtx;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _audioReady = true;
      return _audioCtx;
    } catch (e) { return null; }
  }
  document.addEventListener('click', () => { if (!_audioReady) ensureAudioCtx(); }, { once: true, capture: true });

  function calcTier(walletCount) {
    if (!config.tieredAlerts) return 1;
    return Math.min(4, Math.max(1, walletCount - config.minWallets + 1));
  }

  function playBeepSeq(ctx, seq, baseGain) {
    for (const s of seq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = s.f;
      gain.gain.value = baseGain;
      osc.start(ctx.currentTime + s.t);
      osc.stop(ctx.currentTime + s.t + s.d);
    }
  }

  function playSound(tier) {
    if (!config.soundEnabled) return;
    const ctx = ensureAudioCtx();
    if (!ctx || ctx.state === 'suspended') return;
    tier = tier || 1;
    try {
      if (tier === 1) {
        playBeepSeq(ctx, [{ f: 880, t: 0, d: 0.1 }, { f: 880, t: 0.15, d: 0.1 }], 0.25);
      } else if (tier === 2) {
        playBeepSeq(ctx, [
          { f: 1000, t: 0, d: 0.08 },
          { f: 1000, t: 0.10, d: 0.08 },
          { f: 1000, t: 0.20, d: 0.08 }
        ], 0.27);
      } else if (tier === 3) {
        const seq = [];
        for (let i = 0; i < 5; i++) {
          seq.push({ f: 1100, t: i * 0.07, d: 0.06 });
          seq.push({ f: 1320, t: i * 0.07, d: 0.06 });
        }
        playBeepSeq(ctx, seq, 0.20);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.30, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        gain2.gain.setValueAtTime(0.10, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  }

  function flashBadge() {
    const badge = panelEl?.querySelector('.gcp-badge');
    if (!badge) return;
    badge.classList.add('is-active');
    setTimeout(() => badge.classList.remove('is-active'), 3000);
  }

  // ===== 面板 =====
  function createPanel() {
    const el = document.createElement('div');
    el.className = 'gcp-inline' + (config.collapsed ? ' collapsed' : '');
    el.id = 'gcp-inline-panel';
    el.innerHTML = `
      <div class="gcp-header">
        <div class="gcp-header-left">
          <span class="gcp-toggle-arrow">▼</span>
          <span>🔥 聚合买入提醒</span>
          <span class="gcp-badge">0</span>
        </div>
        <div class="gcp-header-right">
          <button class="gcp-icon-btn gcp-tier-btn" title="${config.tieredAlerts ? '分级提醒：开（点击关闭）' : '分级提醒：关（点击开启）'}">${config.tieredAlerts ? '🔥' : '🌫️'}</button>
          <button class="gcp-icon-btn gcp-sound-btn" title="声音开关">🔔</button>
        </div>
      </div>
      <div class="gcp-settings">
        <label>≥ <input type="number" class="gcp-min-wallets" min="2" max="20" value="${config.minWallets}"> 钱包</label>
        <label>内 <input type="number" class="gcp-time-window" min="1" max="1440" value="${config.timeWindowMin}"> 分钟</label>
        <span class="gcp-status" title="数据状态">⚪</span>
      </div>
      <div class="gcp-alerts"><div class="gcp-empty">监听中…等待信号</div></div>
      <button class="gcp-clear-btn">清空提醒</button>
    `;
    return el;
  }

  function bindPanelEvents() {
    if (!panelEl) return;
    panelEl.querySelector('.gcp-header').addEventListener('click', (e) => {
      if (e.target.closest('.gcp-icon-btn')) return;
      panelEl.classList.toggle('collapsed');
      config.collapsed = panelEl.classList.contains('collapsed');
      saveConfig();
    });

    const soundBtn = panelEl.querySelector('.gcp-sound-btn');
    soundBtn.textContent = config.soundEnabled ? '🔔' : '🔕';
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      config.soundEnabled = !config.soundEnabled;
      soundBtn.textContent = config.soundEnabled ? '🔔' : '🔕';
      saveConfig();
    });

    const tierBtn = panelEl.querySelector('.gcp-tier-btn');
    if (tierBtn) {
      tierBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        config.tieredAlerts = !config.tieredAlerts;
        tierBtn.textContent = config.tieredAlerts ? '🔥' : '🌫️';
        tierBtn.title = config.tieredAlerts ? '分级提醒：开（点击关闭）' : '分级提醒：关（点击开启）';
        saveConfig();
        // 重算所有现有 alert 的 tier
        for (const a of alerts) a.tier = calcTier(a.walletCount);
        lastRenderState = '';
        renderAlerts();
      });
    }

    const minW = panelEl.querySelector('.gcp-min-wallets');
    minW.addEventListener('change', (e) => {
      config.minWallets = Math.max(2, parseInt(e.target.value) || 2);
      e.target.value = config.minWallets;
      saveConfig(); resetAndRescan();
    });
    minW.addEventListener('click', e => e.stopPropagation());

    const tw = panelEl.querySelector('.gcp-time-window');
    tw.addEventListener('change', (e) => {
      config.timeWindowMin = Math.max(1, parseInt(e.target.value) || 30);
      e.target.value = config.timeWindowMin;
      saveConfig(); resetAndRescan();
    });
    tw.addEventListener('click', e => e.stopPropagation());

    panelEl.querySelector('.gcp-settings').addEventListener('click', e => e.stopPropagation());
    panelEl.querySelector('.gcp-alerts').addEventListener('click', e => e.stopPropagation());
    panelEl.querySelector('.gcp-clear-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      alerts = []; renderAlerts();
    });
  }

  function resetAndRescan() {
    alerts = []; seenKeys.clear(); buyRecords = [];
    scanTrades(); renderAlerts();
  }

  let lastRenderState = '';
  function renderAlerts() {
    if (!panelEl) return;
    const container = panelEl.querySelector('.gcp-alerts');
    const badge = panelEl.querySelector('.gcp-badge');
    if (!container || !badge) return;
    badge.textContent = alerts.length;

    let html;
    if (alerts.length === 0) {
      html = '<div class="gcp-empty">监听中…等待信号</div>';
    } else {
      html = alerts.map(a => {
        const hasStar = isAlertStarred(a);
        const closedCount = a.closedCount || 0;
        const effective = (a.effectiveCount != null) ? a.effectiveCount : a.walletCount;
        const tier = a.tier || calcTier(effective);
        const tierIcon = tier >= 4 ? ' 🚨' : tier >= 3 ? ' 🔥' : tier >= 2 ? ' ⚡' : '';
        const logoImg = a.tokenLogo
          ? `<img class="gcp-token-logo" src="${escHtml(a.tokenLogo)}" loading="lazy" referrerpolicy="no-referrer" />`
          : '';
        const isFaded = effective < config.minWallets;
        return `
        <div class="gcp-alert-item gcp-tier-${tier} ${a.isNew ? 'is-new' : ''} ${hasStar ? 'is-starred' : ''} ${isFaded ? 'is-faded' : ''}" data-token="${escHtml(a.token)}">
          <div class="gcp-alert-token">
            <span class="gcp-alert-token-name gcp-token-link" data-mint="${escHtml(a.mint || '')}" data-chain="${escHtml(a.chain || '')}" data-token="${escHtml(a.token)}" title="跳转到 ${escHtml(a.token)}">${logoImg}${escHtml(a.token)} ↗</span>${a.mint ? `<span class="gcp-mint-tag" title="合约：${escHtml(a.mint)}（点击复制）" data-mint="${escHtml(a.mint)}">${escHtml(shortMint(a.mint))}</span>` : ''}${a.platform ? `<span class="gcp-plat-badge ${escHtml(a.platform.cls)}" title="${escHtml(a.platform.label)}">${escHtml(a.platform.tag)}</span>` : ''}
            <span class="gcp-alert-count">${effective} 个钱包${closedCount > 0 ? ` <span class="gcp-closed-tag">−${closedCount} 清仓</span>` : ''}${tierIcon}</span>
          </div>
          <div class="gcp-alert-time">${a.mcap ? '市值 ' + escHtml(a.mcap) : ''}${a.chain ? ' · ' + escHtml(a.chain.toUpperCase()) : ''}</div>
          <div class="gcp-alert-wallets">
            ${a.wallets.map(w => {
              const star = starred.has(w.name);
              const av = w.avatar
                ? `<img class="gcp-wallet-avatar" src="${escHtml(w.avatar)}" loading="lazy" referrerpolicy="no-referrer" />`
                : '';
              return `
              <span class="gcp-alert-wallet-tag ${star ? 'is-starred' : ''} ${w.closed ? 'is-closed' : ''}" title="${w.closed ? '已清仓' : ''}">
                <span class="gcp-star-toggle ${star ? 'on' : ''}" data-wallet="${escHtml(w.name)}" title="${star ? '取消特别关注' : '加入特别关注'}">${star ? '★' : '☆'}</span>
                ${av}${escHtml(w.name)}
                <span class="gcp-wallet-amount">${escHtml(w.amount)}</span>
                ${w.timeAgo ? '<span style="color:#666">' + escHtml(w.timeAgo) + '前</span>' : ''}
              </span>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
    }

    if (html === lastRenderState) return;
    lastRenderState = html;
    container.innerHTML = html;

    container.querySelectorAll('.gcp-token-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToToken(el.dataset.token, el.dataset.mint, el.dataset.chain);
      });
    });
    container.querySelectorAll('.gcp-mint-tag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const fullMint = el.dataset.mint || '';
        try {
          navigator.clipboard.writeText(fullMint);
          const oldText = el.textContent;
          el.textContent = '已复制';
          setTimeout(() => { el.textContent = oldText; }, 1000);
        } catch (e2) {}
      });
    });
    container.querySelectorAll('.gcp-star-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(el.dataset.wallet);
      });
    });
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ===== 跳转（页面内 SPA）=====
  function spaNavigate(url) {
    try {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      return true;
    } catch (e) { return false; }
  }

  function jumpToToken(token, mint, chain) {
    // 策略 1（优先）：用 mint+chain 直接 SPA pushState，精准到 CA
    let useMint = mint, useChain = chain;
    if (!useMint || !useChain) {
      // 反查 tokenMeta（按 symbol，可能不准）
      for (const [k, v] of tokenMeta.entries()) {
        if (v.symbol === token) { useMint = useMint || k; useChain = useChain || v.chain; break; }
      }
    }
    if (useMint && useChain) {
      const url = `/${useChain}/token/${useMint}`;
      if (spaNavigate(url)) return;
      window.location.href = location.origin + url;
      return;
    }

    // 策略 2（兜底）：没 mint 时找列表里 href 含同名的 <a>（很难精准，先试 mint match）
    const list = findVirtualList();
    if (list && mint) {
      const links = list.querySelectorAll('a');
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (href.includes(mint)) { a.click(); return; }
      }
    }
    alert('找不到 ' + token + ' 的跳转入口');
  }

  // ===== 注入星标按钮到原列表 =====
  function scheduleInjectStars() {
    if (injectStarsScheduled) return;
    injectStarsScheduled = true;
    setTimeout(() => {
      injectStarsScheduled = false;
      injectOrigStars();
    }, 250);
  }

  function injectOrigStars() {
    const list = findVirtualList();
    if (!list) return;
    const rowsRoot = list.children[0]?.children[0];
    if (!rowsRoot) return;
    for (const row of rowsRoot.children) {
      const walletEl = row.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]')
        || row.querySelector('[data-sentry-component="AutoTruncateText"]');
      if (!walletEl) continue;
      const wallet = walletEl.textContent.trim();
      const isStar = starred.has(wallet);

      row.classList.toggle('gcp-orig-starred', isStar);

      let starBtn = row.querySelector('.gcp-orig-star');
      if (!starBtn) {
        starBtn = document.createElement('span');
        starBtn.className = 'gcp-orig-star';
        starBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const w = (row.querySelector('.text-yellow-100[data-sentry-component="AutoTruncateText"]') || row.querySelector('[data-sentry-component="AutoTruncateText"]'))?.textContent.trim();
          if (w) toggleStar(w);
        });
        // 往上找最近的横向 flex 容器（避免插到 flex-col 父级导致换行撑高）
        let anchor = walletEl.parentElement;
        while (anchor && anchor !== row) {
          const cs = getComputedStyle(anchor);
          if (cs.display === 'flex' && cs.flexDirection !== 'column') break;
          anchor = anchor.parentElement;
        }
        if (!anchor || anchor === row) anchor = walletEl.parentElement;
        if (anchor) anchor.insertBefore(starBtn, anchor.firstChild);
      }
      starBtn.textContent = isStar ? '★' : '☆';
      starBtn.classList.toggle('on', isStar);
      starBtn.title = isStar ? '取消特别关注' : '加入特别关注';
    }
  }

  // ===== 挂载面板 =====
  function mountPanel() {
    if (document.getElementById('gcp-inline-panel')) return true;
    panelEl = createPanel();
    panelEl.classList.add('gcp-floating');
    // 恢复保存的位置
    try {
      const pos = JSON.parse(localStorage.getItem('gcp_pos') || '{}');
      if (pos.right != null) panelEl.style.right = pos.right + 'px';
      if (pos.top != null) panelEl.style.top = pos.top + 'px';
    } catch (e) {}
    document.body.appendChild(panelEl);
    bindPanelEvents();
    enableDrag();
    return true;
  }

  // 拖拽
  function enableDrag() {
    if (!panelEl) return;
    const header = panelEl.querySelector('.gcp-header');
    if (!header) return;
    let dragging = false, sx = 0, sy = 0, startRight = 0, startTop = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.gcp-icon-btn')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = panelEl.getBoundingClientRect();
      startRight = window.innerWidth - r.right;
      startTop = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const newRight = Math.max(0, Math.min(window.innerWidth - 100, startRight - dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 40, startTop + dy));
      panelEl.style.right = newRight + 'px';
      panelEl.style.top = newTop + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = panelEl.getBoundingClientRect();
      try {
        localStorage.setItem('gcp_pos', JSON.stringify({
          right: Math.round(window.innerWidth - r.right),
          top: Math.round(r.top)
        }));
      } catch (e) {}
    });
  }

  // ===== Observer =====
  function startObserver() {
    const list = findVirtualList();
    if (!list) return false;
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      scanTrades();
    });
    observer.observe(list, { childList: true, subtree: true });
    if (scanInterval) clearInterval(scanInterval);
    scanInterval = setInterval(scanTrades, 5000);
    return true;
  }

  function startMountWatcher() {
    if (mountCheckInterval) clearInterval(mountCheckInterval);
    mountCheckInterval = setInterval(() => {
      // 浮窗独立存在：只要不在 DOM 里就重新挂
      if (!document.getElementById('gcp-inline-panel')) {
        if (mountPanel()) renderAlerts();
      }
      // 追踪列表存在才需要 observer
      const list = findVirtualList();
      if (list && !observer) {
        startObserver();
      } else if (!list && observer) {
        observer.disconnect();
        observer = null;
      }
    }, 2000);
  }

  // ===== 检查新版本 =====
  const REPO = '0xuezhang985/wallet-convergence-alert';
  function cmpVer(a, b) {
    const pa = a.split('.').map(n => parseInt(n) || 0);
    const pb = b.split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  async function checkForUpdate() {
    try {
      const cacheRaw = localStorage.getItem('gcp_update_cache');
      const cache = cacheRaw ? JSON.parse(cacheRaw) : null;
      const now = Date.now();
      let latest = null;
      if (cache && cache.fetchedAt && (now - cache.fetchedAt) < 6 * 3600 * 1000) {
        latest = cache.tag;
      } else {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        if (!r.ok) return;
        const j = await r.json();
        latest = (j.tag_name || '').replace(/^v/, '');
        localStorage.setItem('gcp_update_cache', JSON.stringify({ tag: latest, fetchedAt: now }));
      }
      const cur = chrome.runtime.getManifest().version;
      if (latest && cmpVer(latest, cur) > 0) {
        showUpdateBanner(latest);
      }
    } catch (e) {}
  }

  function showUpdateBanner(latest) {
    if (!panelEl) return;
    if (panelEl.querySelector('.gcp-update-banner')) return;
    const b = document.createElement('div');
    b.className = 'gcp-update-banner';
    b.innerHTML = `🎉 新版 v${escHtml(latest)} 可用 — <a href="https://github.com/${REPO}/releases/latest" target="_blank" rel="noopener">点击下载</a> <span class="gcp-update-close" title="忽略本次提醒">×</span>`;
    panelEl.insertBefore(b, panelEl.firstChild);
    b.querySelector('.gcp-update-close').addEventListener('click', (e) => {
      e.stopPropagation();
      b.remove();
    });
  }

  // ===== 初始化 =====
  function init() {
    const tryInit = () => {
      if (mountPanel()) {
        renderAlerts();
        startObserver();
        scanTrades();
        startMountWatcher();
        checkForUpdate();
        return true;
      }
      return false;
    };
    if (tryInit()) return;
    const w = setInterval(() => { if (tryInit()) clearInterval(w); }, 1500);
    setTimeout(() => clearInterval(w), 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 调试
  window.__gcp = {
    config, alerts, buyRecords, tokenMeta, starred,
    rerender: () => { lastRenderState = ''; renderAlerts(); },
    rescan: () => scanTrades()
  };
})();
