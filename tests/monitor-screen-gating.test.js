'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const backgroundSource = read('background.js');
const redirectorSource = read('gmgn/redirector.js');
const contentSource = read('gmgn/content.js');
const settingsSource = read('settings.html');
const popupSource = read('popup.js');

assert.match(
  backgroundSource,
  /GET_MONITOR_SCREEN_STATUS_MESSAGE = 'get-monitor-screen-status'/,
  'background must expose an explicit monitor-screen status query'
);

assert.match(
  backgroundSource,
  /async function setMonitorScreenFromTab/,
  'background must register the monitor screen only from an explicit tab action'
);

assert.match(
  backgroundSource,
  /SET_MONITOR_SCREEN_FROM_SETTINGS_MESSAGE = 'set-monitor-screen-from-settings'/,
  'background must expose an explicit settings-page monitor-screen action'
);

assert.match(
  backgroundSource,
  /async function setMonitorScreenFromSettings/,
  'settings-page action must resolve the GMGN Follow tab from the current window'
);

assert.match(
  settingsSource,
  /id="setMonitorScreenBtn"/,
  'settings page must expose the monitor-screen button away from the lower-right page corner'
);

assert.match(
  settingsSource,
  /id="monitorScreenStatus"/,
  'settings page must show whether the current window is the monitor screen'
);

assert.match(
  popupSource,
  /SET_MONITOR_SCREEN_FROM_SETTINGS_MESSAGE/,
  'settings controller must call the dedicated monitor-screen action'
);

const actionClickBlock = backgroundSource.match(
  /chrome\.action\.onClicked\.addListener\([\s\S]*?\n}\);/
);
assert.ok(actionClickBlock, 'extension action click handler should be locatable');
assert.match(
  actionClickBlock[0],
  /openSettingsPageInWindow/,
  'extension action click should open the settings page'
);
assert.doesNotMatch(
  actionClickBlock[0],
  /setMonitorScreenFromTab/,
  'extension action click must not be reused for setting the monitor screen'
);

const ensureMonitorStateBlock = backgroundSource.match(
  /async function ensureMonitorState[\s\S]*?\n}\n\nfunction buildMonitorScreenStatus/
);
assert.ok(ensureMonitorStateBlock, 'ensureMonitorState block should be locatable');
assert.doesNotMatch(
  ensureMonitorStateBlock[0],
  /findMonitorCandidate/,
  'ensureMonitorState must not auto-discover GMGN follow pages as monitor screens'
);

assert.match(
  ensureMonitorStateBlock[0],
  /findWindowById\(normalWindows, monitorState\.windowId\)/,
  'ensureMonitorState should keep a manually selected monitor window even if the original tab is gone'
);

assert.match(
  backgroundSource,
  /function findWindowById/,
  'background should be able to validate monitor state at window scope'
);

const tabRemovedBlock = backgroundSource.match(
  /chrome\.tabs\.onRemoved\.addListener\([\s\S]*?\n}\);/
);
assert.ok(tabRemovedBlock, 'tab removal handler should be locatable');
assert.match(
  tabRemovedBlock[0],
  /removeInfo\.isWindowClosing/,
  'tab removal should only clear the monitor screen when the whole window is closing'
);
assert.match(
  tabRemovedBlock[0],
  /windowId: Number\.isInteger\(removeInfo\.windowId\) \? removeInfo\.windowId : monitorState\.windowId/,
  'closing the original monitor tab should preserve the monitor window identity'
);

const initializeRedirectBlock = redirectorSource.match(
  /function initializeMonitorRedirect[\s\S]*?\n}\n\nfunction syncMonitorRedirectForRoute/
);
assert.ok(initializeRedirectBlock, 'initializeMonitorRedirect block should be locatable');
assert.doesNotMatch(
  initializeRedirectBlock[0],
  /registerMonitorTab\s*\(/,
  'redirector must not auto-register every GMGN follow page as a monitor screen'
);

assert.match(
  redirectorSource,
  /MONITOR_SCREEN_BUTTON_ID = 'gcp-monitor-screen-toggle'/,
  'redirector should provide a page control for setting the monitor screen'
);

assert.match(
  redirectorSource,
  /if \(!monitorScreenActive\)/,
  'redirector handoff must be gated by the explicit monitor-screen state'
);

assert.match(
  contentSource,
  /return monitorScreenActive && \(FOLLOW_PATH_RE\.test\(location\.pathname\) \|\| isDebotMonitorWindowPage\(\)\)/,
  'aggregate tray must only run in the explicit monitor screen'
);

assert.match(
  contentSource,
  /watchMonitorScreenState\(\)/,
  'content script should react when another window becomes the monitor screen'
);

assert.match(
  contentSource,
  /syncFollowModeFromMonitorState/,
  'SPA navigation should refresh monitor-screen state before toggling the tray'
);

assert.match(
  redirectorSource,
  /robinhood/,
  'monitor follow-page detection should include Robinhood follow routes'
);

console.log('monitor screen gating tests passed');
