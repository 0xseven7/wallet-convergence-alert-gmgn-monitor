(() => {
  'use strict';
  const MESSAGE_TYPE = 'fomo-aggregate-alert';
  const THESIS_MESSAGE_TYPE = 'fomo-thesis-event';
  const HEARTBEAT_MESSAGE_TYPE = 'fomo-monitor-heartbeat';
  const PING_MESSAGE_TYPE = 'fomo-monitor-ping';
  const FOMO_WSS_EVENT = 'wallet-convergence:fomo-wss-event';
  const FOMO_WSS_STATE = 'wallet-convergence:fomo-wss-state';
  const FOMO_WSS_READY = 'wallet-convergence:fomo-wss-ready';
  const SEEN_STORAGE_KEY = 'fomoAlertSeenV2';
  const seen = new Set();
  let primed = false;
  let persistSeenTimer = null;
  let lastScanAt = 0;
  let lastMutationAt = 0;
  let lastWsEventAt = 0;
  let wsEventCount = 0;
  let wsStatus = 'waiting_for_session';
  let wsStatusAt = Date.now();
  let wsReadyAt = 0;
  let wsUnhealthySince = wsStatusAt;
  let latestStableKey = '';
  const pageStartedAt = Date.now();
  const FOLLOWED_TRADERS = new Map([
    ['user', ['user1941','G6hs15YatNqTK6MdXo2V32kHp2ukrpvARMZkv52V6ix3','0x10d4111e2d9443dde96da86bd5a2a1b82dab6e12']],
    ['helixyy', ['helixyy','7DZtFjFgcDbMSWzbyrCBSGV45weudKwQxEn1Cfm1akuZ','0x3cd9c07b9d204c2a2e681e2be2db2aeee0d7175c']],
    ['kreez', ['Kreez0X','Fx285LZ18w8BwaukqvEu6NJ5dRysT67hChDt8Nszvbss','0x2d9273289d28c0215cc70ecd17fdd3e82d857dab']],
    ['vajra17', ['Vajra17','BS4XUTDhcPDeeY1nvRVwh2ipd5pGo9ZpSjg6SJBU8KKf','0x82b090523ce4bfb7053b46178f39f5917eb3e861']],
    ['binkieee', ['Binkieee','5PVeHkHCodbNyF4M194zoWtMWbkCLKyNKWvG19ouMt3H','0x0137c178aa38535e8893a7583d8778f87bf0df29']],
    ['fibs', ['fibs','GJcMxxQf27cYv2KLA26H6VTZdPfrneZ2HmvCdvMxxZfi','0x6e160b74952ac0ab63167ff2fd665a08409339fb']],
    ['binkbinkbink', ['BinkBinkBink','F9Tv9FpKcaDwx7Ns6PvCJrc3SCeksw1qQdBVHpUbz6to','0x52b5f58bca3abb66ab4e22c7437a7b0f57092793']],
    ['pika xbt', ['XbtPika','3TcghmR9p4RiwTiRDU1h2Twtk9TaFEXraAYRxKGYTmij','0x91d515ec338f8fe856ed3e1f2e5324a89592a2d2']],
    ['leviathan_39', ['Leviathan_39','DafFX5ctwzkfB7Qw8tWzSorYaFL3GQDBitpSpjsqDN1C','0x30bb5a3ba51b2a579ee482cd875c92632f2384ea']],
    ['đoc', ['doc','YYjoVni3Yj9s7D5oakQxQx8LsrXnDAmXmiwBgfF8gua','0x7517caff9ec1c71b608ca03d2c1f9f7af0a107d5']],
    ['_oht_', ['_OHT_','7woZL2FuPfZVmCGbfeGtdKyMBZx7nwxewvJKBtwcVZnB','0x11d08e4f84a1b65b4892dd15755cdf6f689896de']],
    ['stablecoin sean', ['seanlippel','34dHUbWtVqEwUKCBXcLiNY3apQYexESEYVnHm8S3uVpF','0x8314ecfeb6f64f90609791aa05c6bc0e687ccfb1']],
    ['marcell', ['MarcellxMarcell','4Nc1sDwVdZrCLXdLy2CYiAswUJnhVUJU2r2QBaFMVGNb','0x68d3db1a9bd454b8ed687d4575c8024112615585']],
    ['hushedlonelybaboon', ['HushedLonelyBaboon','PREv4CPxnJXnv3SWVq1pnjxGqhxySD8NPzwgzxSxVrn','0xcb1bbca24c29d697dc82240f06c8d6d97fcf6d7e']],
    ['hotlneblng', ['hotlneblng','61urmYCKco3dTAcp4dhgbmY6ZXyAdUB9X3FintHFc3Sr','0x814a2feec3777704aafe63a0d3795e4d0e92d425']],
    ['believer', ['believer12137','DKo82UFLfbT7B2g9dqrZifMiRrVYrM9KS83hkmpwLhKo','0xc03781ea6f23af3b96647a4e2f84cb62ab8215a4']],
    ['jg', ['jotagezin','BSM7obo97xfVUPSPEuU6kURoPvTYUNVspQSKJm5jpPUq','0xf6cf3ea770bfbdce8f22a047e8fb06c9c81e8ecb']],
    ['wrld', ['wrld_sol','L1ZbujFMUoWLnA6zLzsRy2gdaNw4JEZMda4epGBBBVt','0x723a9b04073cf5e78edc1bf982a3e257cab7b406']],
    ['game', ['game_for_one','DATMkmVrFbZt7isGoxyDSpAuF9vJycpkDKwhbf978eUw','0x490b0e93fe28989e70cddbcbfcc635d383baf322']],
    ['arron🐱', ['Arron_finance','FCWfD1saiHrTwJWitxD9c2kQ1YhYbB8mTTE91QfQZvbf','0x98f937d350f636ec464238e080dbd1a122418e00']],
    ['remus 🐂🀄️', ['remusofmars','4WhFtDKcJGLoLAYbQm7iByw5h2sNQTTZF99v4y21T28L','0xd08e06a9bedaf3058aec2df174326c1f36ddf62b']],
    ['zinc', ['zinceth','DR6V3mCnnVYkJb5FdWt8YW2rChQf85hVvo5rTNLQ53Sz','0xd46b330a5fe5b6d97ccc1931a2573ddfdd8502b6']],
    ['logjam', ['_logjam','ExxadAeGwmrfS3NnHxEqWX3qmVTFNXhk7DmSScUpp1t3','0xbf7741d22ddc76c6bd162aa77e564c544c32cfe9']],
    ['collectible', ['collectible','3YECsvhnPBRJtWcPZgTQkczufpXdcAuHgZEDmH8vyRyS','0x8bd37ef6930d561a70edde42751083ddee3e8f47']]
  ]);
  for (const [alias, source] of [
    ['user1941','user'], ['kreez0x','kreez'], ['xbtpika','pika xbt'], ['doc','đoc'],
    ['oht','_oht_'], ['seanlippel','stablecoin sean'], ['marcellxmarcell','marcell'],
    ['believer12137','believer'], ['jotagezin','jg'], ['wrld_sol','wrld'],
    ['game_for_one','game'], ['arron_finance','arron🐱'], ['remusofmars','remus 🐂🀄️'],
    ['zinceth','zinc'], ['_logjam','logjam']
  ]) FOLLOWED_TRADERS.set(alias, FOLLOWED_TRADERS.get(source));

  function compactText(value) { return String(value || '').replace(/\s+/g, '').trim(); }
  function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function boundedText(value, maxLength) {
    const text = String(value || '').trim();
    return text.length <= maxLength ? text : '';
  }
  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  function isValidChainAddress(chain, address) {
    const text = String(address || '').trim();
    if (chain === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);
    return /^0x[0-9a-f]{40}$/i.test(text);
  }
  function safeFomoTokenUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:'
        || (url.hostname !== 'fomo.family' && !url.hostname.endsWith('.fomo.family'))
        || !url.pathname.startsWith('/tokens/')) return '';
      return url.href;
    } catch (_error) {
      return '';
    }
  }
  function sanitizeWssAlert(raw) {
    try {
      if (!raw || typeof raw !== 'object') return null;
      const alertKind = boundedText(raw.alertKind, 16);
      const stableKey = boundedText(raw.stableKey, 512);
      const chain = boundedText(raw.chain, 16).toLowerCase();
      const tokenAddress = boundedText(raw.tokenAddress, 160);
      const symbol = boundedText(raw.symbol, 80);
      if (!['trader', 'aggregate', 'thesis'].includes(alertKind)
        || !['ethereum', 'bnb', 'base', 'robinhood', 'solana'].includes(chain)
        || !stableKey
        || !tokenAddress
        || !symbol
        || !isValidChainAddress(chain, tokenAddress)) return null;
      const common = {
        alertKind,
        stableKey,
        activityId: boundedText(raw.activityId, 256),
        chain,
        tokenAddress,
        symbol,
        tokenImage: boundedText(raw.tokenImage, 2048),
        displayTime: boundedText(raw.displayTime, 24),
        url: safeFomoTokenUrl(boundedText(raw.url, 2048)),
        observedAt: finiteNumber(raw.observedAt) || Date.now(),
        receivedAt: finiteNumber(raw.receivedAt) || 0,
        liveDelivery: raw.liveDelivery === true
      };
      if (alertKind === 'thesis') {
        const text = boundedText(raw.text, 5000);
        const actorName = boundedText(raw.actorName, 120);
        if (!text || !actorName) return null;
        return {
          ...common,
          actorName,
          actorHandle: boundedText(raw.actorHandle, 120) || actorName,
          actorUserId: boundedText(raw.actorUserId, 128),
          actorAddress: isValidChainAddress(chain, raw.actorAddress) ? boundedText(raw.actorAddress, 160) : '',
          profileImage: boundedText(raw.profileImage, 2048),
          text,
          closed: Boolean(raw.closed)
        };
      }
      const side = boundedText(raw.side, 8).toLowerCase();
      if (!['buy', 'sell'].includes(side)) return null;
      const result = {
        ...common,
        side,
        traderCount: Math.max(1, finiteNumber(raw.traderCount) || 1),
        amountText: boundedText(raw.amountText, 80),
        amountUsd: finiteNumber(raw.amountUsd),
        tokenAmount: finiteNumber(raw.tokenAmount),
        positionClosed: raw.positionClosed === true,
        marketCapText: boundedText(raw.marketCapText, 80),
        marketCapUsd: finiteNumber(raw.marketCapUsd)
      };
      if (alertKind === 'trader') {
        const traderName = boundedText(raw.traderName, 120);
        if (!traderName) return null;
        return {
          ...result,
          traderName,
          traderHandle: boundedText(raw.traderHandle, 120) || traderName,
          traderUserId: boundedText(raw.traderUserId, 128),
          traderAddress: isValidChainAddress(chain, raw.traderAddress) ? boundedText(raw.traderAddress, 160) : '',
          traderAvatar: boundedText(raw.traderAvatar, 2048),
          followedTrader: Boolean(raw.followedTrader),
          tradeId: boundedText(raw.tradeId, 256)
        };
      }
      return result;
    } catch (_error) {
      return null;
    }
  }
  function parseAmount(value) {
    const match = String(value || '').replace(/,/g, '').match(/^\$?(\d+(?:\.\d+)?)([KMB])?$/i);
    if (!match) return null;
    return Number(match[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1);
  }
  function definedChainName(value) {
    return {
      '1': 'ethereum',
      '56': 'bnb',
      '8453': 'base',
      '4663': 'robinhood',
      '1399811149': 'solana',
      'ct_501': 'solana'
    }[String(value || '').trim().toLowerCase()] || '';
  }
  function parseDefinedTokenImage(value) {
    let filename = '';
    try {
      filename = decodeURIComponent(new URL(String(value || '')).pathname.split('/').pop() || '');
    } catch (_error) {
      return null;
    }
    const match = filename.match(/^(ct_501|1399811149|8453|4663|56|1)_([^_]+)_small_/i);
    const chain = definedChainName(match?.[1]);
    const tokenAddress = String(match?.[2] || '').trim();
    return chain && tokenAddress ? { chain, tokenAddress } : null;
  }
  function stableTextHash(value) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  function parseThesis(row) {
    if (!row || typeof row.querySelectorAll !== 'function') return null;
    const divs = Array.from(row.querySelectorAll('div'));
    const badge = divs.find((node) => cleanText(node.textContent).toLowerCase() === 'thesis');
    if (!badge) return null;
    const header = badge.parentElement?.parentElement || null;
    const actorName = cleanText(header?.querySelector?.('.text-sm.text-text-primary')?.textContent);
    const displayTime = cleanText(header?.querySelector?.('.text-xs.text-text-tertiary')?.textContent).replace(/^Closed\s+/i, '');
    const images = Array.from(row.querySelectorAll('img'));
    const profileImage = String(images[0]?.src || '').trim();
    const tokenImage = String(images[1]?.src || '').trim();
    const token = parseDefinedTokenImage(tokenImage);
    const tokenContainer = images[1]?.parentElement?.parentElement || null;
    const symbol = cleanText(tokenContainer?.querySelector?.('[role="link"]')?.textContent);
    const text = cleanText(divs.find((node) => /(?:^|\s)line-clamp-\d+(?:\s|$)/.test(String(node.className || '')))?.textContent);
    if (!actorName || !symbol || !text || !token) return null;
    const followedTrader = FOLLOWED_TRADERS.get(actorName.toLocaleLowerCase()) || null;
    const actorAddress = followedTrader ? (token.chain === 'solana' ? followedTrader[1] : followedTrader[2]) : '';
    const stableKey = `thesis|${token.chain}|${token.tokenAddress.toLowerCase()}|${stableTextHash(`${actorName.toLowerCase()}|${text}`)}`;
    return {
      alertKind: 'thesis',
      stableKey,
      chain: token.chain,
      tokenAddress: token.tokenAddress,
      symbol,
      actorName,
      actorHandle: followedTrader?.[0] || actorName,
      actorAddress,
      followedTrader: Boolean(followedTrader),
      profileImage,
      tokenImage,
      text,
      displayTime,
      closed: /\bThesis\s+Closed\b/i.test(cleanText(row.innerText || row.textContent)),
      url: `https://fomo.family/tokens/${token.chain}/${encodeURIComponent(token.tokenAddress)}`,
      observedAt: Date.now()
    };
  }
  function parseAlert(anchor) {
    const href = String(anchor?.getAttribute('href') || '').trim();
    const route = href.match(/^\/tokens\/([^/]+)\/([^/?#]+)/i);
    if (!route) return null;
    const chain = decodeURIComponent(route[1]).toLowerCase();
    const tokenAddress = decodeURIComponent(route[2]);
    const text = compactText(anchor.textContent);
    const aggregateMatch = text.match(/^(\d+)traders(Buy|Sell)(\$[\d,.]+[KMB]?)(\d+[smhd])(?:\?)?(.+?)at(\$[\d,.]+[KMB]?)MC$/i);
    const traderMatch = text.match(/^(.+?)(Buy|Sell|Withdraw)(\d+[smhd])(.+?)(\$[\d,.]+[KMB]?)at(\$[\d,.]+[KMB]?)MC$/i);
    if (!aggregateMatch && !traderMatch) return null;

    if (traderMatch) {
      const traderName = traderMatch[1].trim();
      const side = traderMatch[2].toLowerCase();
      const displayTime = traderMatch[3];
      const symbol = traderMatch[4].trim();
      const amountText = traderMatch[5];
      const marketCapText = traderMatch[6];
      const tradeId = new URL(href, location.origin).searchParams.get('tradeId') || '';
      const followedTrader = FOLLOWED_TRADERS.get(traderName.toLocaleLowerCase()) || null;
      const traderAvatar = Array.from(anchor?.querySelectorAll?.('img') || [])
        .map((image) => String(image?.currentSrc || image?.src || image?.getAttribute?.('src') || '').trim())
        .find((src) => /prod-fomo-profile-pics|profile-pics/i.test(src)) || '';
      return {
        alertKind: 'trader',
        stableKey: tradeId
          ? `trade|${tradeId}|${side}|${amountText}|${marketCapText}`
          : [chain, tokenAddress.toLowerCase(), side, traderName.toLowerCase(), amountText, marketCapText].join('|'),
        chain, tokenAddress, symbol, side, traderCount: 1, traderName, traderHandle: followedTrader?.[0] || traderName,
        traderAddress: followedTrader ? (chain === 'solana' ? followedTrader[1] : followedTrader[2]) : '', traderAvatar, followedTrader: Boolean(followedTrader), tradeId, amountText,
        amountUsd: parseAmount(amountText), marketCapText, marketCapUsd: parseAmount(marketCapText),
        displayTime, url: new URL(href, location.origin).href, observedAt: Date.now()
      };
    }

    const traderCount = Number(aggregateMatch[1]);
    const side = aggregateMatch[2].toLowerCase();
    const amountText = aggregateMatch[3];
    const displayTime = aggregateMatch[4];
    const symbol = aggregateMatch[5].trim();
    const marketCapText = aggregateMatch[6];
    return {
      alertKind: 'aggregate',
      stableKey: [chain, tokenAddress.toLowerCase(), side, traderCount, amountText, marketCapText].join('|'),
      chain, tokenAddress, symbol, side, traderCount, amountText,
      amountUsd: parseAmount(amountText), marketCapText, marketCapUsd: parseAmount(marketCapText),
      displayTime, url: new URL(href, location.origin).href, observedAt: Date.now()
    };
  }
  function trimSeen() {
    if (seen.size <= 2000) return;
    const keep = Array.from(seen).slice(-1000);
    seen.clear();
    keep.forEach((key) => seen.add(key));
  }
  function persistSeenSoon() {
    if (persistSeenTimer) return;
    persistSeenTimer = setTimeout(() => {
      persistSeenTimer = null;
      chrome.storage.local.set({
        [SEEN_STORAGE_KEY]: { initialized: true, keys: Array.from(seen).slice(-1000) }
      }).catch(() => {});
    }, 500);
  }
  function dispatchAlert(alert, allowBeforePrime = false) {
    if (!alert?.stableKey || seen.has(alert.stableKey)) return false;
    seen.add(alert.stableKey);
    trimSeen();
    persistSeenSoon();
    latestStableKey = alert.stableKey;
    if (!allowBeforePrime && !primed) return false;
    const type = alert.alertKind === 'thesis' ? THESIS_MESSAGE_TYPE : MESSAGE_TYPE;
    if (alert.alertKind === 'thesis' || ['buy', 'sell'].includes(alert.side)) {
      chrome.runtime.sendMessage({ type, payload: alert }).catch(() => {});
      return true;
    }
    return false;
  }
  function scan() {
    const tradeAlerts = Array.from(document.querySelectorAll('a[href^="/tokens/"]')).map(parseAlert).filter(Boolean);
    const thesisAlerts = Array.from(document.querySelectorAll('[role="link"][data-slot="hover-card-trigger"]')).map(parseThesis).filter(Boolean);
    const alerts = [...tradeAlerts, ...thesisAlerts];
    lastScanAt = Date.now();
    latestStableKey = alerts[0]?.stableKey || latestStableKey;
    for (const alert of alerts) {
      dispatchAlert(alert);
    }
    primed = true;
    trimSeen();
    persistSeenSoon();
    sendHeartbeat(alerts.length);
  }
  function getStatus(alertCount) {
    return {
      pageStartedAt,
      lastScanAt,
      lastMutationAt,
      lastWsEventAt,
      wsEventCount,
      wsStatus,
      wsStatusAt,
      wsReadyAt,
      wsUnhealthySince,
      captureMode: 'wss',
      latestStableKey,
      alertCount: Number(alertCount || 0),
      visibilityState: document.visibilityState,
      url: location.href
    };
  }
  function sendHeartbeat(alertCount) {
    chrome.runtime.sendMessage({ type: HEARTBEAT_MESSAGE_TYPE, payload: getStatus(alertCount) }).catch(() => {});
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compactText, parseAmount, parseAlert, parseDefinedTokenImage, parseThesis, sanitizeWssAlert };
    return;
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== PING_MESSAGE_TYPE) return false;
    sendResponse({ ok: true, status: getStatus(wsEventCount) });
    return false;
  });
  window.addEventListener(FOMO_WSS_EVENT, (event) => {
    const alert = sanitizeWssAlert(event?.detail);
    if (!alert) return;
    lastWsEventAt = Date.now();
    lastMutationAt = lastWsEventAt;
    wsEventCount += 1;
    dispatchAlert(alert, true);
  });
  window.addEventListener(FOMO_WSS_STATE, (event) => {
    const nextStatus = String(event?.detail?.status || 'unknown');
    const changedAt = Number(event?.detail?.at || Date.now());
    wsStatus = nextStatus;
    wsStatusAt = changedAt;
    if (nextStatus === 'ready') {
      wsReadyAt = changedAt;
      wsUnhealthySince = 0;
    } else if (!wsUnhealthySince) {
      wsUnhealthySince = changedAt;
    }
    sendHeartbeat(wsEventCount);
  });
  window.dispatchEvent(new CustomEvent(FOMO_WSS_READY));
  setInterval(() => sendHeartbeat(wsEventCount), 30000);
  chrome.storage.local.get(SEEN_STORAGE_KEY).then((stored) => {
    const state = stored?.[SEEN_STORAGE_KEY];
    if (Array.isArray(state?.keys)) state.keys.forEach((key) => seen.add(String(key)));
    primed = state?.initialized === true;
    scan();
  }).catch(() => {
    scan();
  });
})();
