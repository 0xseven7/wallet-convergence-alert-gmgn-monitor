'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const contentSource = fs.readFileSync(path.join(repoRoot, 'gmgn', 'content.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(repoRoot, 'gmgn', 'styles.css'), 'utf8');

assert.match(
  contentSource,
  /gcp-focus-speech-btn/,
  'aggregate tray should expose a quick Focus Wallet TTS toggle button'
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
  contentSource,
  /Date\.now\(\) < watchedTradeTtsCooldownUntil[\s\S]*fallbackNativeWatchedTradeTts\(text\)/,
  'watched-wallet speech should bypass a failing network TTS endpoint during cooldown'
);

assert.match(
  contentSource,
  /WATCHED_TRADE_TTS_BACKOFF_BASE_MS \* \(2 \*\* Math\.max\(0, watchedTradeTtsFailureCount - 1\)\)/,
  'repeated watched-wallet TTS failures should use exponential backoff'
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

console.log('monitor focus speech toggle tests passed');
