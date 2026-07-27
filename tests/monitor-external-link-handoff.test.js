'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const monitorRedirector = fs.readFileSync(path.join(repoRoot, 'gmgn', 'redirector.js'), 'utf8');
const monitorBackground = fs.readFileSync(path.join(repoRoot, 'background.js'), 'utf8');
const mainBackground = fs.readFileSync(path.join(repoRoot, 'mid-screen-extension', 'background.js'), 'utf8');
const relaySource = fs.readFileSync(path.join(repoRoot, '..', 'relay', 'server.js'), 'utf8');

assert.match(
  monitorRedirector,
  /source:\s*MONITOR_SCREEN_LINK_SOURCE[\s\S]*sourceOrigin:\s*window\.location\.origin[\s\S]*allowAnyHttpUrl:\s*true/,
  'the explicitly selected monitor screen should mark arbitrary HTTP(S) links as trusted handoffs'
);

assert.match(
  monitorRedirector,
  /async function handoffLinkToMainWindow[\s\S]*sendRuntimeMessage[\s\S]*if \(response && response\.ok\)[\s\S]*window\.location\.assign\(url\)/,
  'a failed runtime handoff must fall back to real navigation instead of leaving a dead click'
);

assert.match(
  monitorBackground,
  /messageSource === MONITOR_SCREEN_LINK_SOURCE[\s\S]*sender\.tab\.windowId === monitorState\.windowId/,
  'the monitor background must only allow arbitrary links from the selected monitor window'
);

assert.match(
  monitorBackground,
  /openInMainWindow\(nextUrl,[\s\S]*buildMonitorScreenRelayOptions\(\)/,
  'the tab-navigation fallback should preserve the trusted monitor source when it retries through Relay'
);

assert.match(
  mainBackground,
  /source === 'gmgn-monitor-screen'[\s\S]*gmgn\\\.ai/,
  'the main-screen extension should accept arbitrary HTTP(S) Relay links only from the GMGN monitor source'
);

assert.match(
  relaySource,
  /function isTrustedMonitorNavigationEvent[\s\S]*gmgn-monitor-screen[\s\S]*gmgn\\\.ai/,
  'Relay should allow external HTTP(S) URLs only for events signed as coming from the GMGN monitor screen'
);

console.log('monitor external-link handoff tests passed');
