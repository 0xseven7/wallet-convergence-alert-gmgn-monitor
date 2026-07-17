const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

assert.match(background, /function buildMarketWatchIntelligenceEvent\(/, 'background should normalize Market Watch intelligence events');
assert.match(background, /\/market-watch\/api\/intelligence-events/, 'background should forward intelligence events to Relay');
assert.match(background, /type === 'convergence_alert'/, 'GMGN convergence alerts should be persisted as aggregate intelligence');
assert.match(background, /\['buy', 'sell'\]\.includes\(side\)/, 'FOMO Buy and Sell alerts should both be accepted');
assert.match(background, /side === 'buy' && isTraderAlert/, 'only real FOMO trader buys should continue into focus-buys');
assert.match(background, /kind: isTraderAlert \? 'trade' : 'aggregate'/, 'FOMO aggregate alerts should not be represented as fake people');
assert.match(background, /function buildGmgnTwitterIntelligenceEvent\(/, 'GMGN Twitter triggers should be normalized for Market Watch');
assert.match(background, /source: 'gmgn-twitter-trigger'/, 'Twitter intelligence should retain its source identity');

console.log('market-watch-intelligence.test.js passed');
