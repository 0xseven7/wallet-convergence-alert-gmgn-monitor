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
assert.match(background, /gmgn-wallet-snapshot/, 'every GMGN aggregate wallet should become a non-financial snapshot');
assert.match(background, /kind: 'snapshot'/, 'aggregate wallet snapshots must not masquerade as trades');
assert.doesNotMatch(background, /type !== 'wallet_trade' \|\| raw\.focus_wallet_hit !== true/, 'all direct GMGN wallet trades should be forwarded, not only Focus wallets');
assert.match(background, /tradeId: String\(payload\.tradeId \|\| raw\.trade_id \|\| raw\.stable_key/, 'direct trades should carry a stable trade id');
assert.match(background, /positionAction: String\(payload\.positionAction \|\| action \|\| raw\.original_action/, 'direct trades should preserve reduce versus close semantics');
assert.match(background, /positionAction: wallet\.closed === true \? 'close' : 'buy'/, 'sold aggregate snapshots should be marked as closed positions');
assert.doesNotMatch(background, /function buildConvergenceAlertFocusBuyPayload/, 'aggregate snapshots must not enter the legacy Focus Buy financial stream');
assert.match(background, /actorImage: String\(wallet\.avatar/, 'GMGN wallet avatars should be forwarded');
assert.match(background, /return \{ items: \[aggregateEvent, \.\.\.walletEvents\] \}/, 'aggregate and wallet events should be sent in one batch');
assert.match(background, /index \+= 200/, 'large wallet lists should be split without dropping wallets');
assert.match(background, /for \(let batchIndex = 0; batchIndex < batches\.length; batchIndex \+= 1\)/, 'wallet batches should be sent sequentially');
assert.match(background, /for \(let attempt = 1; attempt <= 3; attempt \+= 1\)/, 'transient Market Watch failures should be retried');
assert.match(background, /failedBatch: batchIndex \+ 1/, 'partial batch failures should report progress');

console.log('market-watch-intelligence.test.js passed');
