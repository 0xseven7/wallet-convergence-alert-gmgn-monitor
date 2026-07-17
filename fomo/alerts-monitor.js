(() => {
  'use strict';
  const MESSAGE_TYPE = 'fomo-aggregate-alert';
  const HEARTBEAT_MESSAGE_TYPE = 'fomo-monitor-heartbeat';
  const PING_MESSAGE_TYPE = 'fomo-monitor-ping';
  const SEEN_STORAGE_KEY = 'fomoAlertSeenV2';
  const seen = new Set();
  let primed = false;
  let scanTimer = null;
  let lastScanAt = 0;
  let lastMutationAt = 0;
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
  function parseAmount(value) {
    const match = String(value || '').replace(/,/g, '').match(/^\$?(\d+(?:\.\d+)?)([KMB])?$/i);
    if (!match) return null;
    return Number(match[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1);
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
      return {
        alertKind: 'trader',
        stableKey: tradeId ? `trade|${tradeId}|${side}|${amountText}` : [chain, tokenAddress.toLowerCase(), side, traderName.toLowerCase(), amountText, marketCapText].join('|'),
        chain, tokenAddress, symbol, side, traderCount: 1, traderName, traderHandle: followedTrader?.[0] || traderName,
        traderAddress: followedTrader ? (chain === 'solana' ? followedTrader[1] : followedTrader[2]) : '', followedTrader: Boolean(followedTrader), tradeId, amountText,
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
  function scan() {
    scanTimer = null;
    const alerts = Array.from(document.querySelectorAll('a[href^="/tokens/"]')).map(parseAlert).filter(Boolean);
    lastScanAt = Date.now();
    latestStableKey = alerts[0]?.stableKey || latestStableKey;
    for (const alert of alerts) {
      if (seen.has(alert.stableKey)) continue;
      seen.add(alert.stableKey);
      if (primed && ['buy', 'sell'].includes(alert.side)) chrome.runtime.sendMessage({ type: MESSAGE_TYPE, payload: alert }).catch(() => {});
    }
    primed = true;
    if (seen.size > 2000) {
      const keep = Array.from(seen).slice(-1000); seen.clear(); keep.forEach((key) => seen.add(key));
    }
    chrome.storage.local.set({
      [SEEN_STORAGE_KEY]: { initialized: true, keys: Array.from(seen).slice(-1000) }
    }).catch(() => {});
    sendHeartbeat(alerts.length);
  }
  function scheduleScan() { if (!scanTimer) scanTimer = setTimeout(scan, 120); }
  function getStatus(alertCount) {
    return {
      pageStartedAt,
      lastScanAt,
      lastMutationAt,
      latestStableKey,
      alertCount: Number(alertCount || 0),
      visibilityState: document.visibilityState,
      url: location.href
    };
  }
  function sendHeartbeat(alertCount) {
    chrome.runtime.sendMessage({ type: HEARTBEAT_MESSAGE_TYPE, payload: getStatus(alertCount) }).catch(() => {});
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { compactText, parseAmount, parseAlert }; return; }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== PING_MESSAGE_TYPE) return false;
    scan();
    sendResponse({ ok: true, status: getStatus(document.querySelectorAll('a[href^="/tokens/"]').length) });
    return false;
  });
  const observer = new MutationObserver(() => {
    lastMutationAt = Date.now();
    scheduleScan();
  });
  function startObserver() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(() => sendHeartbeat(document.querySelectorAll('a[href^="/tokens/"]').length), 30000);
    for (const eventName of ['visibilitychange', 'pageshow', 'online']) {
      addEventListener(eventName, scheduleScan);
    }
  }
  chrome.storage.local.get(SEEN_STORAGE_KEY).then((stored) => {
    const state = stored?.[SEEN_STORAGE_KEY];
    if (Array.isArray(state?.keys)) state.keys.forEach((key) => seen.add(String(key)));
    primed = state?.initialized === true;
    scan();
    startObserver();
  }).catch(() => {
    scan();
    startObserver();
  });
})();
