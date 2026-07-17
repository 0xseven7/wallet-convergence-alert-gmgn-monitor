'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const monitor = fs.readFileSync(path.join(root, 'fomo', 'alerts-monitor.js'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'gmgn', 'content.js'), 'utf8');

assert.ok(manifest.permissions.includes('alarms'), 'background supervision requires alarms permission');
assert.match(background, /chrome\.alarms\.onAlarm/);
assert.match(background, /autoDiscardable:\s*false/);
assert.match(background, /chrome\.tabs\.reload\(tab\.id\)/);
assert.match(background, /const DEFAULT_FOMO_MONITOR_URL = 'https:\/\/fomo\.family\/tokens\//, 'the monitor must have a valid token-page fallback');
assert.match(background, /async function ensureFomoMonitorTab\(\)/, 'the background must create the carrier tab when none exists');
assert.match(background, /fomoMonitorCreatePromise/, 'concurrent startup and alarm checks must not create duplicate tabs');
assert.match(background, /chrome\.tabs\.create\(\{[\s\S]*active:\s*false,[\s\S]*pinned:\s*true/, 'the managed FOMO tab must stay in the background');
assert.match(background, /const tabs = await ensureFomoMonitorTab\(\)/, 'supervision must always ensure an input tab before health checks');
assert.match(background, /rememberFomoMonitorUrl\(fomoTabUrl\)/, 'a manually visited FOMO token page must become the next carrier URL');
assert.match(background, /FOMO_MONITOR_PING_EVENT/);
assert.match(background, /chrome\.storage\.session/, 'health state should survive MV3 service-worker suspension');
assert.match(background, /restoreFomoMonitorHealth\(\)[\s\S]*updateFomoMonitorHealth\(sender\.tab\.id/, 'heartbeat wake should merge persisted tab state before writing');
assert.match(background, /chrome\.alarms\.onAlarm[\s\S]*restoreFomoMonitorHealth\(\)[\s\S]*superviseFomoMonitorTabs\(\)/, 'alarm wake should restore persisted health before supervision');
assert.match(background, /ownerWindow\?\.focused === true/, 'an active tab in an unfocused window is still background work');
assert.match(monitor, /fomo-monitor-heartbeat/);
assert.match(monitor, /\['buy', 'sell'\]\.includes\(alert\.side\)/, 'both buy and sell alerts should be forwarded');
assert.match(screen, /\['buy', 'sell'\]\.includes\(side\)/, 'monitor screen should display both directions');
assert.match(screen, /is-sell/, 'sell rows should be visually distinct');
assert.match(screen, /mapFomoSignalToWallet/, 'all GMGN reconciliation paths should preserve FOMO side metadata');

console.log('fomo background resilience tests passed');
