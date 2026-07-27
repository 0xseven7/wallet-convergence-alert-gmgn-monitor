'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeQuickAddChain,
  parseGmgnTokenPageUrl,
  buildGmgnTokenUrl,
  buildFomoTokenUrl,
  buildCounterpartTokenLink
} = require('../mid-screen-extension/gmgn/token-quick-add.js');

const ca = '0x1111111111111111111111111111111111111111';
const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'mid-screen-extension', 'background.js'), 'utf8');

assert.equal(normalizeQuickAddChain('robinhood'), 'robinhood');
assert.equal(normalizeQuickAddChain('RH'), 'robinhood');
assert.equal(normalizeQuickAddChain('Robinhood Chain'), 'robinhood');

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/robinhood/token/${ca}`), {
  ca,
  chain: 'robinhood'
});
assert.deepEqual(parseGmgnTokenPageUrl(`https://fomo.family/tokens/robinhood/${ca}`), {
  ca,
  chain: 'robinhood'
});

assert.equal(buildGmgnTokenUrl({ ca, chain: 'robinhood' }), `https://gmgn.ai/robinhood/token/${ca}`);
assert.equal(buildFomoTokenUrl({ ca, chain: 'robinhood' }), `https://fomo.family/tokens/robinhood/${ca}`);

assert.deepEqual(
  buildCounterpartTokenLink(`https://gmgn.ai/robinhood/token/${ca}`, { ca, chain: 'robinhood' }),
  { label: 'Fomo', url: `https://fomo.family/tokens/robinhood/${ca}`, title: '跳转到 FOMO' }
);
assert.deepEqual(
  buildCounterpartTokenLink(`https://fomo.family/tokens/robinhood/${ca}`, { ca, chain: 'robinhood' }),
  { label: 'GMGN', url: `https://gmgn.ai/robinhood/token/${ca}`, title: '跳转到 GMGN' }
);

assert.match(backgroundSource, /robinhood:\s*'4663'/, 'background quick-add should use Robinhood mainnet chain ID');

console.log('mid-screen Robinhood link tests passed');
