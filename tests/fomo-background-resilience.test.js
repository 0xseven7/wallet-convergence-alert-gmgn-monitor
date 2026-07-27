'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const monitor = fs.readFileSync(path.join(root, 'fomo', 'alerts-monitor.js'), 'utf8');
const wsBridge = fs.readFileSync(path.join(root, 'fomo', 'ws-bridge.js'), 'utf8');
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
assert.match(background, /FOMO_RECENT_ALERT_RETENTION_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/, 'FOMO cache must retain thirty minutes');
assert.match(background, /await cacheRecentFomoAlert\(payload\)[\s\S]*const tabs = await chrome\.tabs\.query/, 'FOMO events must be cached before monitor delivery');
assert.match(background, /getRecentFomoAlerts\(\)/, 'the monitor screen needs a recent-event replay endpoint');
assert.match(background, /restoreFomoMonitorHealth\(\)[\s\S]*updateFomoMonitorHealth\(sender\.tab\.id/, 'heartbeat wake should merge persisted tab state before writing');
assert.match(background, /chrome\.alarms\.onAlarm[\s\S]*restoreFomoMonitorHealth\(\)[\s\S]*superviseFomoMonitorTabs\(\)/, 'alarm wake should restore persisted health before supervision');
const superviseBlock = background.match(
  /async function superviseFomoMonitorTabs\(\)[\s\S]*?\n}\n\nasync function openSettingsPageInWindow/
);
assert.ok(superviseBlock, 'FOMO supervisor should be locatable');
assert.match(
  superviseBlock[0],
  /refreshedHealth\.visibilityState === 'visible'/,
  'a visible always-on-top FOMO window must stay healthy even when its Chrome window is not focused'
);
assert.doesNotMatch(
  superviseBlock[0],
  /ownerWindow\?\.focused === true/,
  'FOMO visibility must not be inferred from OS window focus'
);
assert.match(monitor, /fomo-monitor-heartbeat/);
assert.match(monitor, /wsStatusAt/, 'the health report must retain when the WSS status changed');
assert.match(wsBridge, /WSS_CONNECT_TIMEOUT_MS/, 'a stuck FOMO authentication attempt must time out');
assert.match(wsBridge, /restartDedicatedSocket\('connect_timeout'\)/, 'a timed-out socket must enter the normal reconnect path');
assert.match(
  superviseBlock[0],
  /wsUnhealthyTooLong/,
  'a responsive page with a persistently unhealthy WSS must still be recovered'
);
assert.match(
  superviseBlock[0],
  /FOMO_MONITOR_WS_RECOVERY_MS/,
  'WSS recovery must wait for a bounded grace period before refreshing the page'
);
assert.match(monitor, /\['buy', 'sell'\]\.includes\(alert\.side\)/, 'both buy and sell alerts should be forwarded');
assert.match(screen, /\['buy', 'sell'\]\.includes\(side\)/, 'monitor screen should display both directions');
assert.match(screen, /is-sell/, 'sell rows should be visually distinct');
assert.match(screen, /mapFomoSignalToWallet/, 'all GMGN reconciliation paths should preserve FOMO side metadata');
assert.match(screen, /restoreRecentFomoAlerts\(\)/, 'GMGN monitor refresh must restore cached FOMO events');
assert.match(screen, /historical:\s*true/, 'restored events must be marked historical');
assert.match(screen, /deferEffects:\s*true/, 'restored events must not replay sound or speech');

console.log('fomo background resilience tests passed');
