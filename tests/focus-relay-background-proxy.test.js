const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const content = fs.readFileSync(path.join(root, 'gmgn', 'content.js'), 'utf8');

assert.match(background, /GMGN_FOCUS_ADDRESS_RELAY_REQUEST_MESSAGE\s*=\s*'gmgn-focus-address-relay-request'/, 'background must define the restricted Focus Relay request channel');
assert.match(background, /message\.type === GMGN_FOCUS_ADDRESS_RELAY_REQUEST_MESSAGE[\s\S]*requestFocusAddressesThroughRelay/, 'background must handle Focus Relay requests');
assert.match(background, /operation === 'list'[\s\S]*operation === 'upsert'[\s\S]*operation === 'sync'[\s\S]*operation === 'delete'/, 'background proxy must allow only the four Focus operations');
assert.match(background, /isAllowedFocusRelaySender\(sender\)/, 'background proxy must validate its content-script sender');

const requestFunction = content.match(/async function relayFocusAddressRequest\([\s\S]*?\n  }\n\n  async function upsertFocusAddress/);
assert.ok(requestFunction, 'Focus Relay request wrapper must exist');
assert.match(requestFunction[0], /sendRuntimeMessage\([\s\S]*GMGN_FOCUS_ADDRESS_RELAY_REQUEST_MESSAGE/, 'content script must route Focus requests through the extension background');
assert.doesNotMatch(requestFunction[0], /fetch\(/, 'content script Focus request wrapper must not fetch Relay directly');

const syncFunction = content.match(/async function syncFocusAddressesFromRelay\([\s\S]*?\n  }\n\n  function startFocusAddressSync/);
assert.ok(syncFunction, 'Focus sync function must exist');
assert.match(syncFunction[0], /relayFocusAddressRequest\('list'\)/, 'Focus list refresh must use the background proxy');
assert.doesNotMatch(syncFunction[0], /fetch\(/, 'Focus list refresh must not fetch Relay from gmgn.ai');

console.log('focus-relay-background-proxy.test.js passed');
