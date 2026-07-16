'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseAmount, parseAlert } = require('../fomo/alerts-monitor.js');
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

assert.match(backgroundSource, /chrome\.tabs\.sendMessage[\s\S]*FOMO_AGGREGATE_ALERT_EVENT/, 'FOMO alert should be sent to the monitor screen');
assert.match(backgroundSource, /dispatchFocusBuyToRelay\(focusBuy, settings\)/, 'FOMO alert should also be persisted in Market Watch');
assert.match(backgroundSource, /source:\s*'fomo-alert'/, 'Market Watch item should retain its FOMO source');
assert.match(monitorSource, /fomoAggregateAlertSeenV1/, 'seen alerts should persist across hidden-tab reloads');
assert.match(convergenceSource, /getAlertGroupKey\(\{ token, mint, chain \}\)/, 'FOMO should merge by the same token group key as GMGN');
assert.match(convergenceSource, /existing\.wallets = \[\.\.\.walletDetails, \.\.\.fomoWallets\]/, 'GMGN wallet rows should preserve merged FOMO rows');
assert.match(convergenceSource, /FOMO \$\{fomoTraderCount\} traders/, 'the fused card should expose FOMO aggregate trader count');

console.log('fomo alert monitor tests passed');
