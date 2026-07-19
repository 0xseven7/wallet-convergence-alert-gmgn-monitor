'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const contentSource = fs.readFileSync(path.join(repoRoot, 'gmgn', 'content.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(repoRoot, 'gmgn', 'styles.css'), 'utf8');

assert.match(
  contentSource,
  /gcp-focus-speech-btn[^>]*>🗣<\/button>/,
  'aggregate tray should expose an icon-only Focus Wallet TTS toggle button'
);

assert.match(
  contentSource,
  /function updateFocusSpeechButtonState\(\)/,
  'Focus Wallet TTS button should keep its visible state in sync with audio settings'
);

assert.match(
  contentSource,
  /ttsEnabled:\s*audioSettings\.ttsEnabled === false/,
  'Focus Wallet TTS button should only toggle gmgnAudioSettings.ttsEnabled'
);

assert.match(
  contentSource,
  /function persistAudioSettings\(\)[\s\S]*GMGN_AUDIO_SETTINGS_KEY/,
  'Focus Wallet TTS toggle should persist through gmgnAudioSettings'
);

assert.match(
  contentSource,
  /if \(!config\.soundEnabled \|\| !audioSettings\.enabled \|\| !audioSettings\.ttsEnabled\) return;/,
  'watched-wallet speech should honor the Focus Wallet TTS setting'
);

assert.match(
  styleSource,
  /\.gcp-focus-speech-btn/,
  'Focus Wallet TTS button should have compact tray styling'
);

assert.match(
  styleSource,
  /\.gcp-focus-speech-btn\.is-off/,
  'Focus Wallet TTS button should have an off state'
);

assert.match(
  contentSource,
  /gcp-token-ext-link-fomo[\s\S]*fomo\.family\/favicon\.svg/,
  'FOMO token action should use the official site icon instead of a text pill'
);

assert.match(
  contentSource,
  /gcp-token-ext-link-debot[\s\S]*debot\.ai\/favicon\.ico/,
  'DeBot token action should use the official site icon instead of a text pill'
);

assert.doesNotMatch(
  contentSource,
  /gcp-token-ext-link[^>]*>Fomo<|gcp-token-ext-link[^>]*>Debot</,
  'external token actions should not spend tray width on provider names'
);

assert.match(
  contentSource,
  /gcp-clear-btn[^>]*aria-label="清空提醒"[^>]*>🗑<\/button>/,
  'clear action should remain accessible while using an icon-only control'
);

console.log('monitor focus speech toggle tests passed');
