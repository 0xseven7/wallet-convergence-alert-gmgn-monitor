'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'gmgn', 'ui-cleanup.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'manifest.json'), 'utf8'));

assert.doesNotMatch(
  source,
  /new\s+MutationObserver/,
  'main-screen UI cleanup must not install a full-page MutationObserver on heavy GMGN pages'
);

assert.doesNotMatch(
  source,
  /observe\s*\(\s*document\.documentElement/,
  'main-screen UI cleanup must not observe the whole GMGN document subtree'
);

assert.match(
  source,
  /CLEANUP_RUN_DELAYS_MS\s*=\s*\[[^\]]+\]/,
  'main-screen UI cleanup should use finite delayed cleanup passes'
);

assert.match(
  source,
  /queryTopChromeElements/,
  'main-screen UI cleanup should scope scans to top chrome roots'
);

const addressScripts = manifest.content_scripts
  .filter((entry) => (entry.matches || []).some((pattern) => pattern.includes('/address/')))
  .flatMap((entry) => entry.js || []);

assert.deepEqual(
  [...new Set(addressScripts)].sort(),
  [],
  'main-screen address pages should not inject the Focus address button'
);

const cleanupEntry = manifest.content_scripts.find((entry) => (entry.js || []).includes('gmgn/ui-cleanup.js'));
assert.ok(cleanupEntry, 'manifest should include the GMGN UI cleanup content script');
assert.ok(
  (cleanupEntry.exclude_matches || []).some((pattern) => pattern.includes('/address/')),
  'UI cleanup should be excluded from GMGN address pages'
);

console.log('mid-screen UI cleanup tests passed');
