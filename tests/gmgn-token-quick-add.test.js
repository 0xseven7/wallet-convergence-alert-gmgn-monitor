'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeQuickAddChain,
  parseGmgnTokenPageUrl,
  buildQuickAddPayload,
  getQuickAddErrorMessage,
  buildGmgnTokenUrl,
  buildFomoTokenUrl,
  buildCounterpartTokenLink
} = require('../gmgn/token-quick-add.js');

const solCa = 'BZ8SLQP9zCK93zUdYj7XzUKHgVj71PCBXVYKtVSLpump';
const bscCa = '0x1111111111111111111111111111111111111111';
const source = fs.readFileSync(path.join(__dirname, '..', 'gmgn', 'token-quick-add.js'), 'utf8');

assert.equal(normalizeQuickAddChain('sol'), 'solana');
assert.equal(normalizeQuickAddChain('solana'), 'solana');
assert.equal(normalizeQuickAddChain('eth'), 'ethereum');
assert.equal(normalizeQuickAddChain('bsc'), 'bsc');
assert.equal(normalizeQuickAddChain('base'), 'base');

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/sol/token/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://www.gmgn.ai/bsc/token/${bscCa}`), {
  ca: bscCa,
  chain: 'bsc'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/token/${solCa}?chain=sol`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/#/sol/token/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/chart?chain=sol&ca=${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://gmgn.ai/kline/sol/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://fomo.family/tokens/solana/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://app.fomo.family/tokens/solana/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://fomo.family/#/tokens/solana/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://www.fomo.family/tokens/bnb/${bscCa}`), {
  ca: bscCa,
  chain: 'bsc'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://fomo.family/token/solana/${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.deepEqual(parseGmgnTokenPageUrl(`https://fomo.family/?chain=solana&address=${solCa}`), {
  ca: solCa,
  chain: 'solana'
});

assert.equal(parseGmgnTokenPageUrl('https://gmgn.ai/follow?chain=sol'), null);
assert.equal(parseGmgnTokenPageUrl(`https://fomo.family/tokens/${solCa}`), null);
assert.equal(parseGmgnTokenPageUrl('https://debot.ai/token/solana/foo'), null);

assert.deepEqual(buildQuickAddPayload({ ca: solCa, chain: 'solana' }), {
  ca: solCa,
  chain: 'solana',
  note: 'from GMGN plugin',
  tags: 'gmgn,quick-add'
});

assert.equal(
  getQuickAddErrorMessage({ ok: false, json: { error: 'Missing ca/contractAddress/address' }, status: 400 }),
  'Missing ca/contractAddress/address'
);

assert.equal(
  getQuickAddErrorMessage({ ok: false, body: '{"ok":false,"error":"service down"}', status: 500 }),
  '{"ok":false,"error":"service down"}'
);

assert.equal(
  buildFomoTokenUrl({ ca: bscCa, chain: 'bsc' }),
  `https://fomo.family/tokens/bnb/${bscCa}`
);
assert.equal(
  buildGmgnTokenUrl({ ca: solCa, chain: 'solana' }),
  `https://gmgn.ai/sol/token/${solCa}`
);

assert.deepEqual(buildCounterpartTokenLink(`https://gmgn.ai/bsc/token/${bscCa}`, { ca: bscCa, chain: 'bsc' }), {
  label: 'Fomo',
  url: `https://fomo.family/tokens/bnb/${bscCa}`,
  title: '跳转到 FOMO'
});

assert.deepEqual(buildCounterpartTokenLink(`https://fomo.family/tokens/solana/${solCa}`, { ca: solCa, chain: 'solana' }), {
  label: 'GMGN',
  url: `https://gmgn.ai/sol/token/${solCa}`,
  title: '跳转到 GMGN'
});

assert.match(
  source,
  /setInterval\(scheduleRender,\s*ROUTE_POLL_INTERVAL_MS\)/,
  'route watcher must poll URL changes because page-world SPA navigation is invisible to isolated-world history wrappers'
);

assert.match(
  source,
  /button\.onclick = async \(\) => \{[\s\S]*buildQuickAddPayload\(resolveCurrentTokenInfo\(\)\)/,
  'quick-add click handler must resolve the current token at click time instead of reusing stale route payload'
);

console.log('gmgn-token-quick-add tests passed');
