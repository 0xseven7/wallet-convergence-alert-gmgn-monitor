'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const performanceSource = fs.readFileSync(path.join(root, 'fomo', 'collector-performance.js'), 'utf8');
const modeSource = fs.readFileSync(path.join(root, 'fomo', 'collector-mode.js'), 'utf8');
const modeCss = fs.readFileSync(path.join(root, 'fomo', 'collector-mode.css'), 'utf8');

const fomoMainEntry = manifest.content_scripts.find((entry) =>
  entry.world === 'MAIN' && entry.js?.includes('fomo/ws-bridge.js')
);
assert.ok(fomoMainEntry, 'FOMO main-world WSS entry must exist');
assert.equal(fomoMainEntry.run_at, 'document_start');
assert.deepEqual(
  fomoMainEntry.js.slice(0, 2),
  ['fomo/collector-performance.js', 'fomo/ws-bridge.js'],
  'the rendering throttle must install before the FOMO WSS bridge'
);

const collectorEntry = manifest.content_scripts.find((entry) =>
  entry.js?.includes('fomo/collector-mode.js')
);
assert.ok(collectorEntry, 'FOMO collector UI content script must exist');
assert.equal(collectorEntry.run_at, 'document_start');
assert.deepEqual(collectorEntry.css, ['fomo/collector-mode.css']);

assert.match(performanceSource, /nativeRequestAnimationFrame/);
assert.match(performanceSource, /gcpFomoCollectorMode/);
assert.match(performanceSource, /FRAME_INTERVAL_MS\s*=\s*500/);
assert.doesNotMatch(performanceSource, /window\.WebSocket\s*=/, 'collector mode must not alter WSS');
assert.doesNotMatch(performanceSource, /window\.setInterval\s*=/, 'collector mode must not alter timers');

assert.match(modeSource, /fomoCollectorModeEnabledV1/);
assert.match(modeSource, /DEFAULT_ENABLED\s*=\s*true/);
assert.match(modeSource, /wallet-convergence:fomo-wss-state/);
assert.match(modeSource, /wallet-convergence:fomo-wss-event/);
assert.match(modeSource, /chrome\.storage\.local\.set/);
assert.match(modeSource, /显示完整页面/);
assert.match(modeSource, /开启轻量采集/);

assert.match(modeCss, /body\s*>\s*:not\(#gcp-fomo-collector-shell\)/);
assert.match(modeCss, /visibility:\s*hidden\s*!important/);
assert.match(modeCss, /z-index:\s*2147483647/);

console.log('fomo-collector-mode tests passed');
