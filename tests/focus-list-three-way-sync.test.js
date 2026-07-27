const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const content = fs.readFileSync(path.join(repoRoot, 'gmgn', 'content.js'), 'utf8');
const background = fs.readFileSync(path.join(repoRoot, 'background.js'), 'utf8');

assert.match(content, /relayFocusAddressRequest\('sync'/, 'local cached addresses must be merged into Relay');
assert.match(content, /if \(!relayEntries\[entry\.key\]\) relayEntries\[entry\.key\] = entry;/, 'Relay entries must win over stale local copies');
assert.match(content, /function promoteSpeechFocusToAddress\(/, 'legacy name-only watches must migrate when a wallet address appears');
assert.match(content, /id = 'gcp-focus-manager'/, 'the plugin must expose a Focus List editor');
assert.match(content, /data-action="edit"/, 'the plugin editor must support editing');
assert.match(content, /data-action="delete"/, 'the plugin editor must support deletion');
assert.match(background, /deleteFocusAddressFromRelay\(item\)/, 'quick-remove must delete from Relay as well as local storage');

console.log('focus-list-three-way-sync.test.js passed');
