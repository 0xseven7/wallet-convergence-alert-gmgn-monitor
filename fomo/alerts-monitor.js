(() => {
  'use strict';
  const MESSAGE_TYPE = 'fomo-aggregate-alert';
  const SEEN_STORAGE_KEY = 'fomoAggregateAlertSeenV1';
  const seen = new Set();
  let primed = false;
  let scanTimer = null;

  function compactText(value) { return String(value || '').replace(/\s+/g, '').trim(); }
  function parseAmount(value) {
    const match = String(value || '').replace(/,/g, '').match(/^\$?(\d+(?:\.\d+)?)([KMB])?$/i);
    if (!match) return null;
    return Number(match[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1);
  }
  function parseAlert(anchor) {
    const href = String(anchor?.getAttribute('href') || '').trim();
    const route = href.match(/^\/tokens\/([^/]+)\/([^/?#]+)/i);
    if (!route) return null;
    const match = compactText(anchor.textContent).match(/^(\d+)traders(Buy|Sell)(\$[\d,.]+[KMB]?)(\d+[smhd])(?:\?)?(.+?)at(\$[\d,.]+[KMB]?)MC$/i);
    if (!match) return null;
    const chain = decodeURIComponent(route[1]).toLowerCase();
    const tokenAddress = decodeURIComponent(route[2]);
    const traderCount = Number(match[1]);
    const side = match[2].toLowerCase();
    const amountText = match[3];
    const displayTime = match[4];
    const symbol = match[5].trim();
    const marketCapText = match[6];
    return {
      stableKey: [chain, tokenAddress.toLowerCase(), side, traderCount, amountText, marketCapText].join('|'),
      chain, tokenAddress, symbol, side, traderCount, amountText,
      amountUsd: parseAmount(amountText), marketCapText, marketCapUsd: parseAmount(marketCapText),
      displayTime, url: new URL(href, location.origin).href, observedAt: Date.now()
    };
  }
  function scan() {
    scanTimer = null;
    const alerts = Array.from(document.querySelectorAll('a[href^="/tokens/"]')).map(parseAlert).filter(Boolean);
    for (const alert of alerts) {
      if (seen.has(alert.stableKey)) continue;
      seen.add(alert.stableKey);
      if (primed && alert.side === 'buy') chrome.runtime.sendMessage({ type: MESSAGE_TYPE, payload: alert }).catch(() => {});
    }
    primed = true;
    if (seen.size > 2000) {
      const keep = Array.from(seen).slice(-1000); seen.clear(); keep.forEach((key) => seen.add(key));
    }
    chrome.storage.local.set({
      [SEEN_STORAGE_KEY]: { initialized: true, keys: Array.from(seen).slice(-1000) }
    }).catch(() => {});
  }
  function scheduleScan() { if (!scanTimer) scanTimer = setTimeout(scan, 120); }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { compactText, parseAmount, parseAlert }; return; }
  chrome.storage.local.get(SEEN_STORAGE_KEY).then((stored) => {
    const state = stored?.[SEEN_STORAGE_KEY];
    if (Array.isArray(state?.keys)) state.keys.forEach((key) => seen.add(String(key)));
    primed = state?.initialized === true;
    scan();
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  }).catch(() => {
    scan();
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  });
})();
