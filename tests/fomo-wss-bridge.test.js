'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
const monitorSource = fs.readFileSync(path.join(__dirname, '..', 'fomo', 'alerts-monitor.js'), 'utf8');
const {
  normalizeTradingActivity,
  parseFomoSocketMessage
} = require('../fomo/ws-bridge.js');
const { sanitizeWssAlert } = require('../fomo/alerts-monitor.js');

const profile = {
  id: 'bea10b9a-6cc5-51f2-9504-b7cb2d7e7a94',
  address: '5PVeHkHCodbNyF4M194zoWtMWbkCLKyNKWvG19ouMt3H',
  evmAddress: '0x0137c178aa38535e8893a7583d8778f87bf0df29',
  displayName: 'Binkieee',
  userHandle: 'Binkieee',
  profilePictureLink: 'https://prod-fomo-profile-pics.s3.amazonaws.com/binkieee_small.jpg'
};

const buy = normalizeTradingActivity({
  id: 'activity-1',
  type: 'swap_buy',
  createdAt: '2026-07-23T04:00:00.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'trade-1',
  userId: profile.id,
  userHandle: 'Binkieee',
  displayName: 'Binkieee',
  profilePictureLink: profile.profilePictureLink,
  ticker: 'PMAV',
  tokenImageUrl: 'https://example.test/pmav.png',
  usdAmount: 5700,
  fdv: 834700
}, profile, 1774411200000);

assert.equal(buy.alertKind, 'trader');
assert.equal(buy.side, 'buy');
assert.equal(buy.chain, 'robinhood');
assert.equal(buy.traderAddress, profile.evmAddress);
assert.equal(buy.traderAvatar, profile.profilePictureLink);
assert.equal(buy.amountText, '$5.7K');
assert.equal(buy.marketCapText, '$834.7K');
assert.equal(buy.stableKey, 'activity|activity-1');
assert.equal(buy.activityId, 'activity-1');

const minuteRoundedLiveBuy = normalizeTradingActivity({
  id: 'activity-live-minute-rounded',
  type: 'swap_buy',
  createdAt: '2026-07-23T04:00:00.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'trade-live',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 100
}, profile, Date.parse('2026-07-23T04:00:17.800Z'));
assert.equal(minuteRoundedLiveBuy.receivedAt, Date.parse('2026-07-23T04:00:17.800Z'));
assert.equal(minuteRoundedLiveBuy.liveDelivery, true, 'a minute-rounded FOMO timestamp must still be treated as a live WSS delivery');

const replayedBuy = normalizeTradingActivity({
  id: 'activity-replayed',
  type: 'swap_buy',
  createdAt: '2026-07-23T04:00:00.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'trade-replayed',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 100
}, profile, Date.parse('2026-07-23T04:02:00.000Z'));
assert.equal(replayedBuy.liveDelivery, false, 'reconnect backlog must remain visible without becoming speech-eligible');

const repeatedPositionBuy = normalizeTradingActivity({
  id: 'activity-1-second-fill',
  type: 'swap_buy',
  createdAt: '2026-07-23T04:00:30.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'trade-1',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 5700,
  fdv: 732900
}, profile, 1774411230000);

assert.notEqual(
  buy.stableKey,
  repeatedPositionBuy.stableKey,
  'two fills from the same position must remain distinct even when tradeId, side, and amount match'
);
assert.equal(repeatedPositionBuy.stableKey, 'activity|activity-1-second-fill');

const retransmittedBuy = normalizeTradingActivity({
  id: 'activity-1',
  type: 'swap_buy',
  createdAt: '2026-07-23T04:00:00.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'trade-1',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 5700,
  fdv: 834700
}, profile, 1774411200000);
assert.equal(retransmittedBuy.stableKey, buy.stableKey, 'a retransmitted activity must still be deduplicated');

const fallbackFirst = normalizeTradingActivity({
  type: 'swap_buy',
  createdAt: '2026-07-23T04:01:00.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'legacy-trade',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 5700,
  fdv: 800000
}, profile, 1774411260000);
const fallbackSecond = normalizeTradingActivity({
  type: 'swap_buy',
  createdAt: '2026-07-23T04:01:30.000Z',
  networkId: 4663,
  tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  tradeId: 'legacy-trade',
  userId: profile.id,
  userHandle: 'Binkieee',
  ticker: 'PMAV',
  usdAmount: 5700,
  fdv: 800000
}, profile, 1774411290000);
assert.notEqual(fallbackFirst.stableKey, fallbackSecond.stableKey, 'legacy events without activity IDs must include precise event time');

const aggregate = normalizeTradingActivity({
  id: 'activity-2',
  type: 'multi_user_sell',
  createdAt: '2026-07-23T04:00:00.000Z',
  networkId: 1399811149,
  tokenAddress: 'ExCALBK63oJHxoDTgEPspKG7TFuhBcEgMv6YiyApump',
  body: {
    uniqueTraders: 4,
    totalVolume: 18200,
    ticker: 'VICECOIN',
    marketCap: 125900,
    tokenImageUrl: 'https://example.test/vice.png'
  }
}, null, 1774411200000);

assert.equal(aggregate.alertKind, 'aggregate');
assert.equal(aggregate.side, 'sell');
assert.equal(aggregate.chain, 'solana');
assert.equal(aggregate.traderCount, 4);
assert.equal(aggregate.amountText, '$18.2K');

const parsed = parseFomoSocketMessage(JSON.stringify({
  type: 'data',
  topicType: 'trading_activity',
  topicId: 'viewer-1',
  payload: {
    id: 'activity-3',
    type: 'swap_sell',
    createdAt: '2026-07-23T04:00:00.000Z',
    networkId: 56,
    tokenAddress: '0x1111111111111111111111111111111111111111',
    tradeId: 'trade-3',
    userId: profile.id,
    userHandle: profile.userHandle,
    ticker: 'ABC',
    usdAmount: 981,
    marketCap: 263800
  }
}), profile, 1774411200000);

assert.equal(parsed.kind, 'alert');
assert.equal(parsed.payload.side, 'sell');
assert.equal(parsed.payload.chain, 'bnb');
assert.equal(sanitizeWssAlert({ ...parsed.payload, chain: 'unknown-chain' }), null);
assert.equal(sanitizeWssAlert({ ...parsed.payload, stableKey: 'x'.repeat(513) }), null);
assert.equal(sanitizeWssAlert(parsed.payload).traderAddress, profile.evmAddress);
assert.equal(sanitizeWssAlert(parsed.payload).activityId, 'activity-3');
assert.equal(sanitizeWssAlert(minuteRoundedLiveBuy).receivedAt, minuteRoundedLiveBuy.receivedAt);
assert.equal(sanitizeWssAlert(minuteRoundedLiveBuy).liveDelivery, true);

const fomoScripts = manifest.content_scripts
  .filter((entry) => entry.matches.some((match) => match.includes('fomo.family')))
  .flatMap((entry) => entry.js || []);
assert.ok(fomoScripts.includes('fomo/ws-bridge.js'), 'FOMO pages should install the MAIN-world WSS bridge');
assert.match(monitorSource, /FOMO_WSS_EVENT/, 'the isolated monitor should consume normalized WSS events');
assert.match(monitorSource, /FOMO_WSS_READY/, 'the isolated monitor should announce readiness before buffered WSS events flush');
assert.doesNotMatch(monitorSource, /new MutationObserver/, 'the FOMO monitor must not rescan the full page on every DOM mutation');
assert.doesNotMatch(
  monitorSource,
  /message\?\.type !== PING_MESSAGE_TYPE[\s\S]{0,200}\bscan\(\)/,
  'health pings must not trigger a full DOM scan'
);

console.log('fomo WSS bridge tests passed');
