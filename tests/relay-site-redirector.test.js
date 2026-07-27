'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const manifest = JSON.parse(read('manifest.json'));
const mainManifest = JSON.parse(read('mid-screen-extension/manifest.json'));
const contentScripts = manifest.content_scripts || [];
const relayBridgeEntry = contentScripts.find((entry) => Array.isArray(entry.js) && entry.js.includes('relay-site-open-bridge.js'));
const relayRedirectorEntry = contentScripts.find((entry) => Array.isArray(entry.js) && entry.js.includes('relay-site-redirector.js'));

assert.ok(relayBridgeEntry, 'relay-site-open-bridge.js content script entry is missing');
assert.equal(relayBridgeEntry.world, 'MAIN', 'relay-site-open-bridge.js must run in the page world to hook window.open');
assert.ok(relayBridgeEntry.matches.includes('https://market-watch.macmini.lan/*'), 'relay bridge must match market-watch.macmini.lan');

assert.ok(relayRedirectorEntry, 'relay-site-redirector.js content script entry is missing');
assert.ok(relayRedirectorEntry.matches.includes('https://market-watch.macmini.lan/*'), 'relay redirector must match market-watch.macmini.lan');
assert.ok(
  (mainManifest.host_permissions || []).includes('https://market-watch.macmini.lan/*'),
  'main-screen extension must be allowed to connect to the HTTPS market-watch relay host'
);

const bridgeSource = read('relay-site-open-bridge.js');
assert.match(bridgeSource, /window\.open\s*=/, 'relay bridge must override window.open');
assert.match(bridgeSource, /market-watch\.macmini\.lan/, 'relay bridge must restrict itself to the market-watch host');
assert.match(bridgeSource, /gcp-relay-site-external-open/, 'relay bridge must emit the external open event');

const redirectorSource = read('relay-site-redirector.js');
assert.match(redirectorSource, /OPEN_LINK_MESSAGE = 'open-in-main-window'/, 'relay redirector must use the existing main-screen handoff message');
assert.match(redirectorSource, /relayOnly: true/, 'relay site links must not fall back to monitor-profile tabs');
assert.match(redirectorSource, /allowAnyHttpUrl: true/, 'relay site links must allow trusted external HTTP(S) URLs');
assert.match(redirectorSource, /source: RELAY_SITE_SOURCE/, 'relay site links must mark their trusted source');

const backgroundSource = read('background.js');
assert.match(backgroundSource, /monitor-relay-site/, 'monitor background must preserve relay-site source metadata');
assert.match(backgroundSource, /isHttpNavigationUrl/, 'monitor background must support trusted relay-site HTTP(S) handoffs');
assert.match(
  backgroundSource,
  /!options\.relayOnly && !hasActiveMainScreenClient/,
  'relayOnly market-watch links must still be queued when the main-screen client is offline'
);

const mainBackgroundSource = read('mid-screen-extension/background.js');
assert.match(mainBackgroundSource, /monitor-relay-site/, 'main-screen background must trust relay-site events');
assert.match(mainBackgroundSource, /market-watch\\.macmini\\.lan/, 'main-screen background must trust the market-watch origin');

console.log('relay site redirector tests passed');
