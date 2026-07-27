'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeTradingActivity } = require('../fomo/ws-bridge.js');

const screenSource = fs.readFileSync(path.join(__dirname, '..', 'gmgn', 'content.js'), 'utf8');
const summaryMatch = screenSource.match(
  /  function summarizeFomoSignalsToWallets\(signals\) \{([\s\S]*?)\n  \}\n\n  function mergeRecentFomoSignals/
);
assert.ok(summaryMatch, 'the monitor must expose one deterministic FOMO person-summary function');
const summarizeFomoSignalsToWallets = new Function(
  'shortAddress',
  `"use strict"; function summarizeFomoSignalsToWallets(signals) {${summaryMatch[1]}\n  }\nreturn summarizeFomoSignalsToWallets;`
)((value) => String(value || '').slice(0, 8));

const normalizedBuy = normalizeTradingActivity({
  id: 'buy-token-quantity',
  type: 'swap_buy',
  createdAt: '2026-07-27T05:00:00.000Z',
  networkId: 1399811149,
  tokenAddress: 'Ai66VANu2bbqtRGhuZHjUDxT3eiWzfSzGw2UvTiipump',
  outHumanAmount: '250000',
  usdAmount: 1000,
  userHandle: 'Thepennyflip'
}, {
  id: 'person-1',
  address: '11111111111111111111111111111111',
  userHandle: 'Thepennyflip'
}, Date.parse('2026-07-27T05:00:01.000Z'));
assert.equal(normalizedBuy.tokenAmount, 250000, 'FOMO WSS normalization must retain token quantity');

const common = {
  alertKind: 'trader',
  traderUserId: 'person-1',
  traderName: 'Thepennyflip',
  traderAddress: '11111111111111111111111111111111',
  traderAvatar: 'https://example.test/person.png'
};
const wallets = summarizeFomoSignalsToWallets([
  { ...common, stableKey: 'buy-1', side: 'buy', amountUsd: 1000, tokenAmount: 100, observedAt: 1000 },
  { ...common, stableKey: 'buy-2', side: 'buy', amountUsd: 1000, tokenAmount: 100, observedAt: 2000 },
  { ...common, stableKey: 'sell-1', side: 'sell', amountUsd: 1200, tokenAmount: 50, observedAt: 3000 }
]);

assert.equal(wallets.length, 1, 'one trader must render as one wallet row');
assert.equal(wallets[0].name, 'Thepennyflip', 'the visible FOMO name must not keep @');
assert.equal(wallets[0].amount, '买 2 · 卖 1');
assert.equal(wallets[0].closed, false, 'a partial sell must not be crossed out');
assert.equal(wallets[0].profileUrl, 'https://fomo.family/profile/Thepennyflip');

const fullySold = summarizeFomoSignalsToWallets([
  { ...common, stableKey: 'buy-full', side: 'buy', tokenAmount: 200, observedAt: 1000 },
  { ...common, stableKey: 'sell-full', side: 'sell', tokenAmount: 200, observedAt: 2000 }
]);
assert.equal(fullySold.length, 1);
assert.equal(fullySold[0].closed, true, 'a confirmed full token-quantity sell must be crossed out');

const unknownPosition = summarizeFomoSignalsToWallets([
  { ...common, stableKey: 'legacy-buy', side: 'buy', amountUsd: 1000, observedAt: 1000 },
  { ...common, stableKey: 'legacy-sell', side: 'sell', amountUsd: 2000, observedAt: 2000 }
]);
assert.equal(
  unknownPosition[0].closed,
  false,
  'USD totals must not be used to guess full liquidation when token quantity is unavailable'
);

console.log('fomo wallet summary tests passed');
