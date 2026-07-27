'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'gmgn', 'focus-address-quick-add.js'), 'utf8');
const convergenceSource = fs.readFileSync(path.join(repoRoot, 'gmgn', 'content.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'background.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const midScreenManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'manifest.json'), 'utf8'));
const {
  normalizeFocusChainName,
  normalizeFocusAddressKey,
  parseGmgnAddressPageUrl,
  buildFocusAddressPayload,
  buildFocusAddressKey
} = require('../gmgn/focus-address-quick-add.js');

const solAddress = '11111111111111111111111111111111';
const evmAddress = '0xA0b86991c6218B36c1D19D4a2e9Eb0cE3606eB48';
const tronAddress = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

assert.equal(normalizeFocusChainName('solana'), 'sol');
assert.equal(normalizeFocusChainName('ethereum'), 'eth');
assert.equal(normalizeFocusChainName('bnb'), 'bsc');
assert.equal(normalizeFocusChainName('Robinhood Chain'), 'robinhood');
assert.equal(normalizeFocusAddressKey(evmAddress), evmAddress.toLowerCase());
assert.equal(buildFocusAddressKey('ETH', evmAddress), `eth:${evmAddress.toLowerCase()}`);

assert.deepEqual(parseGmgnAddressPageUrl(`https://gmgn.ai/sol/address/${solAddress}`), {
  chain: 'sol',
  address: solAddress,
  key: `sol:${solAddress}`,
  sourceUrl: `https://gmgn.ai/sol/address/${solAddress}`
});

assert.deepEqual(parseGmgnAddressPageUrl(`https://www.gmgn.ai/address/bsc/${evmAddress}`), {
  chain: 'bsc',
  address: evmAddress,
  key: `bsc:${evmAddress.toLowerCase()}`,
  sourceUrl: `https://www.gmgn.ai/address/bsc/${evmAddress}`
});

assert.deepEqual(parseGmgnAddressPageUrl(`https://gmgn.ai/address/${evmAddress}?chain=base`), {
  chain: 'base',
  address: evmAddress,
  key: `base:${evmAddress.toLowerCase()}`,
  sourceUrl: `https://gmgn.ai/address/${evmAddress}?chain=base`
});

assert.deepEqual(parseGmgnAddressPageUrl(`https://gmgn.ai/#/tron/address/${tronAddress}`), {
  chain: 'tron',
  address: tronAddress,
  key: `tron:${tronAddress}`,
  sourceUrl: `https://gmgn.ai/#/tron/address/${tronAddress}`
});

assert.deepEqual(parseGmgnAddressPageUrl(`https://gmgn.ai/robinhood/address/${evmAddress}`), {
  chain: 'robinhood',
  address: evmAddress,
  key: `robinhood:${evmAddress.toLowerCase()}`,
  sourceUrl: `https://gmgn.ai/robinhood/address/${evmAddress}`
});

assert.equal(parseGmgnAddressPageUrl(`https://gmgn.ai/sol/token/${solAddress}`), null);
assert.equal(parseGmgnAddressPageUrl(`https://x.com/sol/address/${solAddress}`), null);

assert.deepEqual(buildFocusAddressPayload({
  chain: 'sol',
  address: solAddress,
  sourceUrl: `https://gmgn.ai/sol/address/${solAddress}`
}), {
  chain: 'sol',
  address: solAddress,
  alias: '',
  name: '',
  focusPushEnabled: true,
  source: 'gmgn-monitor-address-page',
  sourceUrl: `https://gmgn.ai/sol/address/${solAddress}`
});

assert.doesNotMatch(
  source,
  /new\s+MutationObserver/,
  'Focus address quick add should not install a full-page MutationObserver'
);

assert.match(
  source,
  /setInterval\(\(\)\s*=>\s*\{[\s\S]*ROUTE_POLL_INTERVAL_MS/,
  'Focus address quick add should use a lightweight route watcher'
);

assert.match(
  backgroundSource,
  /sol\|eth\|bsc\|base\|tron\|blast\|robinhood/,
  'background Relay sync should accept robinhood Focus wallet addresses'
);
assert.match(
  backgroundSource,
  /const chain = \/\^0x\[a-fA-F0-9\]\{40\}\$\/\.test\(address\)[\s\S]*\? 'eth'/,
  'new EVM Focus wallets must use one canonical Relay key across EVM chains'
);

assert.match(
  convergenceSource,
  /function focusAddressMatches\([\s\S]*entry\?\.evmAddress[\s\S]*entry\?\.solanaAddress/,
  'Focus matching must recognize both EVM and Solana wallets linked to one person'
);
assert.match(
  convergenceSource,
  /function findFocusAddressNameKey\([\s\S]*entry\?\.alias[\s\S]*entry\?\.name/,
  'Relay person aliases must provide a safe fallback when a streamed row omits its wallet address'
);
assert.match(
  convergenceSource,
  /<option value="eth">EVM<\/option><option value="sol">Solana<\/option>/,
  'Focus wallet editing must expose wallet families instead of individual EVM chains'
);

const monitorFocusEntry = manifest.content_scripts.find((entry) => (entry.js || []).includes('gmgn/focus-address-quick-add.js'));
assert.ok(monitorFocusEntry, 'monitor manifest should inject the Focus address quick-add script');
assert.ok(
  monitorFocusEntry.matches.some((pattern) => pattern.includes('/address/')),
  'monitor Focus quick-add script should match GMGN address pages'
);
assert.ok(
  monitorFocusEntry.matches.some((pattern) => pattern.includes('/follow')),
  'monitor Focus quick-add script should also load on follow pages for SPA address navigation'
);

const midScreenAddressScripts = midScreenManifest.content_scripts
  .filter((entry) => (entry.matches || []).some((pattern) => pattern.includes('/address/')))
  .flatMap((entry) => entry.js || []);
assert.ok(
  midScreenManifest.content_scripts.some((entry) => (entry.js || []).includes('gmgn/focus-address.js')),
  'main-screen extension should expose the Relay-backed Focus toggle on wallet profiles'
);

console.log('monitor focus address quick-add tests passed');
