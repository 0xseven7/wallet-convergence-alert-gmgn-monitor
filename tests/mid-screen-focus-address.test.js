'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'manifest.json'), 'utf8'));
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'background.js'), 'utf8');
const source = fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'gmgn', 'focus-address.js'), 'utf8');
const {
  parseGmgnAddressPageUrl,
  parseGmgnAddressContextCandidates
} = require('../mid-screen-extension/gmgn/focus-address.js');

const solAddress = '11111111111111111111111111111111';
const evmAddress = '0xA0b86991c6218B36c1D19D4a2e9Eb0cE3606eB48';

assert.deepEqual(parseGmgnAddressPageUrl(`https://gmgn.ai/sol/address/${solAddress}`), {
  chain: 'sol',
  address: solAddress,
  key: `sol:${solAddress}`,
  sourceUrl: `https://gmgn.ai/sol/address/${solAddress}`
});

assert.deepEqual(parseGmgnAddressContextCandidates([
  'https://gmgn.ai/follow?chain=sol',
  `https://gmgn.ai/address/base/${evmAddress}`
]), {
  chain: 'base',
  address: evmAddress.toLowerCase(),
  key: `base:${evmAddress.toLowerCase()}`,
  sourceUrl: `https://gmgn.ai/address/base/${evmAddress}`
});

assert.equal(parseGmgnAddressContextCandidates([
  `https://gmgn.ai/sol/token/${solAddress}`
]), null);

assert.match(
  source,
  /querySelectorAll\([\s\S]*role="dialog"[\s\S]*ant-drawer[\s\S]*href\*="\/address\/"/,
  'main-screen Focus button should resolve the address shown inside a GMGN profile drawer'
);
assert.match(
  source,
  /setInterval\(scheduleRender,\s*ROUTE_POLL_INTERVAL_MS\)/,
  'main-screen Focus button should remount after GMGN replaces its DOM'
);
assert.doesNotMatch(source, /new\s+MutationObserver/, 'main-screen Focus support must stay lightweight');

const entry = manifest.content_scripts.find((item) => (item.js || []).includes('gmgn/focus-address.js'));
assert.ok(entry, 'main-screen manifest should inject the wallet Focus helper');
assert.ok(entry.matches.some((pattern) => pattern.includes('gmgn.ai/*')), 'wallet Focus helper should load on GMGN follow and address pages');

assert.match(
  backgroundSource,
  /GMGN_FOCUS_ADDRESS_MESSAGE[\s\S]*quickChangeFocusAddress/,
  'main-screen background should handle wallet Focus status, add, and remove requests'
);
assert.match(backgroundSource, /\/focus-addresses/, 'main-screen Focus changes should use Relay persistence');

console.log('mid-screen Focus address tests passed');
