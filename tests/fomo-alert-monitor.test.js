'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseAmount, parseAlert, parseDefinedTokenImage, parseThesis } = require('../fomo/alerts-monitor.js');
const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const monitorSource = fs.readFileSync(path.join(__dirname, '..', 'fomo', 'alerts-monitor.js'), 'utf8');
const convergenceSource = fs.readFileSync(path.join(__dirname, '..', 'gmgn', 'content.js'), 'utf8');

global.location = { origin: 'https://fomo.family' };

const anchor = {
  textContent: '80 traders Buy $197.4K 4h ? PMAV at $834.7K MC',
  getAttribute(name) {
    return name === 'href' ? '/tokens/robinhood/0x6bca58e2ba84ace5a1aba25b793d198450722d28' : '';
  }
};

assert.equal(parseAmount('$197.4K'), 197400);
const parsed = parseAlert(anchor);
assert.ok(Number.isFinite(parsed.observedAt));
delete parsed.observedAt;
assert.deepEqual(parsed, {
  alertKind: 'aggregate',
  stableKey: 'robinhood|0x6bca58e2ba84ace5a1aba25b793d198450722d28|buy|80|$197.4K|$834.7K',
  chain: 'robinhood',
  tokenAddress: '0x6bca58e2ba84ace5a1aba25b793d198450722d28',
  symbol: 'PMAV',
  side: 'buy',
  traderCount: 80,
  amountText: '$197.4K',
  amountUsd: 197400,
  marketCapText: '$834.7K',
  marketCapUsd: 834700,
  displayTime: '4h',
  url: 'https://fomo.family/tokens/robinhood/0x6bca58e2ba84ace5a1aba25b793d198450722d28'
});

const traderAnchor = {
  textContent: 'BinkBinkBink Buy 1h VICECOIN $2.2K at $125.9K MC',
  querySelectorAll(selector) {
    return selector === 'img'
      ? [{ src: 'https://prod-fomo-profile-pics.s3.amazonaws.com/binkieee_small.jpg' }]
      : [];
  },
  getAttribute(name) {
    return name === 'href'
      ? '/tokens/solana/ExCALBK63oJHxoDTgEPspKG7TFuhBcEgMv6YiyApump?tradeId=53359ee2-75ca-4a63-b67e-1be0b1cef3e5'
      : '';
  }
};
const traderParsed = parseAlert(traderAnchor);
assert.equal(traderParsed.alertKind, 'trader');
assert.equal(traderParsed.side, 'buy');
assert.equal(traderParsed.traderName, 'BinkBinkBink');
assert.equal(traderParsed.traderHandle, 'BinkBinkBink');
assert.equal(traderParsed.traderAddress, 'F9Tv9FpKcaDwx7Ns6PvCJrc3SCeksw1qQdBVHpUbz6to');
assert.equal(traderParsed.traderAvatar, 'https://prod-fomo-profile-pics.s3.amazonaws.com/binkieee_small.jpg');
assert.equal(traderParsed.tradeId, '53359ee2-75ca-4a63-b67e-1be0b1cef3e5');
assert.equal(traderParsed.stableKey, 'trade|53359ee2-75ca-4a63-b67e-1be0b1cef3e5|buy|$2.2K|$125.9K');
assert.equal(traderParsed.symbol, 'VICECOIN');
assert.equal(traderParsed.amountUsd, 2200);
assert.equal(traderParsed.marketCapUsd, 125900);

const sellAnchor = {
  textContent: '23 traders Sell $18.2K 3m PMAV at $790.1K MC',
  getAttribute(name) {
    return name === 'href' ? '/tokens/robinhood/0x6bca58e2ba84ace5a1aba25b793d198450722d28' : '';
  }
};
const sellParsed = parseAlert(sellAnchor);
assert.equal(sellParsed.side, 'sell');
assert.equal(sellParsed.traderCount, 23);
assert.equal(sellParsed.amountUsd, 18200);
assert.deepEqual(
  parseDefinedTokenImage('https://token-media.defined.fi/8453_0xb2000000000000000000007bf6d5cbb0e24cb301_small_7ac792e0b733.png'),
  { chain: 'base', tokenAddress: '0xb2000000000000000000007bf6d5cbb0e24cb301' }
);
assert.deepEqual(
  parseDefinedTokenImage('https://token-media.defined.fi/1399811149_BDdzUjksj1J4bSnMveQ5tV9Up8A9c6YS1tHrxNw3pump_small_b6877e19e31c.png'),
  { chain: 'solana', tokenAddress: 'BDdzUjksj1J4bSnMveQ5tV9Up8A9c6YS1tHrxNw3pump' }
);
assert.deepEqual(
  parseDefinedTokenImage('https://token-media.defined.fi/CT_501_BDdzUjksj1J4bSnMveQ5tV9Up8A9c6YS1tHrxNw3pump_small_b6877e19e31c.png'),
  { chain: 'solana', tokenAddress: 'BDdzUjksj1J4bSnMveQ5tV9Up8A9c6YS1tHrxNw3pump' }
);
const thesisHeader = {
  querySelector(selector) {
    if (selector === '.text-sm.text-text-primary') return { textContent: '_OHT_' };
    if (selector === '.text-xs.text-text-tertiary') return { textContent: '1m' };
    return null;
  }
};
const thesisBadge = { textContent: 'Thesis', className: '', parentElement: { parentElement: thesisHeader } };
const thesisBody = { textContent: 'All it takes is one tweet.', className: 'line-clamp-6' };
const thesisTokenContainer = { querySelector: () => ({ textContent: 'BRIAN' }) };
const thesisRow = {
  innerText: '_OHT_ Thesis 1m BRIAN All it takes is one tweet.',
  querySelectorAll(selector) {
    if (selector === 'div') return [thesisBadge, thesisBody];
    if (selector === 'img') return [
      { src: 'https://prod-fomo-profile-pics.s3.amazonaws.com/oht_small.jpg' },
      { src: 'https://token-media.defined.fi/8453_0xb2000000000000000000007bf6d5cbb0e24cb301_small_hash.png', parentElement: { parentElement: thesisTokenContainer } }
    ];
    return [];
  }
};
const thesisParsed = parseThesis(thesisRow);
assert.equal(thesisParsed.alertKind, 'thesis');
assert.equal(thesisParsed.chain, 'base');
assert.equal(thesisParsed.tokenAddress, '0xb2000000000000000000007bf6d5cbb0e24cb301');
assert.equal(thesisParsed.symbol, 'BRIAN');
assert.equal(thesisParsed.actorHandle, '_OHT_');
assert.equal(thesisParsed.text, 'All it takes is one tweet.');
assert.equal(thesisParsed.actorAddress, '0x11d08e4f84a1b65b4892dd15755cdf6f689896de');
assert.match(thesisParsed.stableKey, /^thesis\|base\|0xb200/);
assert.match(monitorSource, /THESIS_MESSAGE_TYPE/, 'thesis rows should use a dedicated background message');
assert.match(backgroundSource, /kind:\s*'twitter'[\s\S]*type:\s*'fomo_thesis'/, 'FOMO thesis must enter Market Watch as token discussion intelligence');
assert.match(backgroundSource, /source:\s*'fomo-thesis'/, 'Market Watch must retain the thesis source');
assert.match(backgroundSource, /chrome\.tabs\.sendMessage[\s\S]*FOMO_AGGREGATE_ALERT_EVENT/, 'FOMO alert should be sent to the monitor screen');
assert.match(backgroundSource, /dispatchFocusBuyToRelay\(focusBuy, settings\)/, 'FOMO alert should also be persisted in Market Watch');
assert.match(backgroundSource, /source:\s*'fomo-alert'/, 'Market Watch item should retain its FOMO source');
assert.match(monitorSource, /fomoAlertSeenV2/, 'seen alerts should persist across hidden-tab reloads');
assert.match(convergenceSource, /getAlertGroupKey\(\{ token, mint, chain \}\)/, 'FOMO should merge by the same token group key as GMGN');
assert.match(convergenceSource, /pendingFomoAggregateAlerts\.push\(message\.payload\)/, 'FOMO WSS events should enter the monitor render queue one by one');
assert.match(convergenceSource, /setTimeout\(flushFomoAggregateAlertBatch, FOMO_RENDER_BATCH_MS\)/, 'FOMO monitor rendering should be coalesced into short batches');
assert.match(convergenceSource, /ingestFomoAggregateAlert\(payload, \{ deferRender: true, deferEffects: true \}\)/, 'a FOMO batch should merge all events before rendering or playing cues');
assert.match(convergenceSource, /function flushFomoAggregateAlertBatch\(\)[\s\S]*if \(!changed\) return;[\s\S]*renderAlerts\(\);[\s\S]*scheduleFomoNewStateClear\(touchedAlerts\)/, 'each FOMO batch should render once and clear highlights together');
assert.match(convergenceSource, /if \(config\.soundEnabled && selectedSoundCue\)[\s\S]*playSound\(selectedSoundCue\.tier, selectedSoundCue\.chain\)/, 'each FOMO batch should play at most one highest-priority cue');
assert.match(convergenceSource, /existing\.wallets = \[\.\.\.walletDetails, \.\.\.fomoWallets\]/, 'GMGN wallet rows should preserve merged FOMO rows');
assert.match(convergenceSource, /const totalBuyWalletCount = effective \+ Math\.max\(fomoRealBuyerCount, fomoAggregateTraderCount\)/, 'the fused card should combine GMGN and FOMO buyers under one wallet count');
assert.match(convergenceSource, /const totalSellWalletCount = Math\.max\(fomoRealSellerCount, fomoAggregateSellerCount\)/, 'the fused card should keep FOMO sell activity compact without switching terminology');
assert.match(convergenceSource, /fomoTradeCount > 1 \? `\$\{fomoTradeCount\} 笔`/, 'repeated FOMO fills from one wallet should expose their transaction count');
assert.match(convergenceSource, /name: signal\.alertKind === 'trader'[\s\S]*\? traderLabel[\s\S]*: formatFomoActorCount\(signal\.traderCount, side\)/, 'FOMO wallet rows should use the same compact name-first copy as GMGN rows');
assert.match(convergenceSource, /function renderAlertWalletTag\(wallet, chain\)/, 'GMGN and FOMO people must share one wallet-row renderer');
assert.match(convergenceSource, /timeMs:\s*Number\(signal\.observedAt \|\| 0\)/, 'FOMO rows must retain their absolute event time');
assert.match(convergenceSource, /gcp-wallet-time[\s\S]*data-time-ms=/, 'rendered wallet times must expose their absolute timestamp');
assert.match(convergenceSource, /RELATIVE_TIME_REFRESH_MS\s*=\s*15\s*\*\s*1000/, 'relative time refresh should use one low-frequency timer');
assert.match(convergenceSource, /function refreshRenderedRelativeTimes[\s\S]*document\.hidden[\s\S]*classList\.contains\('collapsed'\)/, 'time refresh must pause when the page or tray is hidden');
assert.match(convergenceSource, /function startRelativeTimeRefresh[\s\S]*setInterval/, 'relative times should share one timer instead of one timer per row');
assert.match(convergenceSource, /stopRelativeTimeRefresh\(\)/, 'the shared timer must stop with monitor mode');
assert.match(convergenceSource, /const canToggleFocus = !wallet\.external \|\| !!wallet\.address/, 'a FOMO person with a real address must expose the shared Focus toggle');
assert.match(convergenceSource, /function buildFomoWatchedTrade\(signal, alert\)[\s\S]*getFocusWalletMatch\(/, 'FOMO people must use the same Focus identity lookup as GMGN wallet TTS');
assert.match(convergenceSource, /timeMs:\s*Number\(signal\.receivedAt \|\| 0\)/, 'FOMO speech freshness must use local WSS receipt time instead of the minute-rounded upstream event time');
assert.match(convergenceSource, /liveDelivery:\s*signal\.liveDelivery === true/, 'FOMO speech must retain the live-delivery guard');
assert.match(convergenceSource, /if \(trade\.source === 'fomo' && trade\.liveDelivery !== true\) return false/, 'replayed FOMO history must never enter the speech queue');
assert.match(convergenceSource, /flushWatchedTradeAnnouncements\(watchedTradesToSpeak\)/, 'focused FOMO events must enter the existing watched-wallet speech queue');
assert.match(backgroundSource, /actorImage:\s*String\(payload\.traderAvatar/, 'FOMO profile images must reach Market Watch intelligence');
assert.doesNotMatch(convergenceSource, /platform: \{ tag: 'FOMO'/, 'the clickable FOMO icon should replace the repeated text platform badge');
assert.match(convergenceSource, /tier:\s*side === 'buy' \? calcTier\(traderCount\) : 1/, 'sell alerts should not inflate bullish alert tier');

console.log('fomo alert monitor tests passed');
