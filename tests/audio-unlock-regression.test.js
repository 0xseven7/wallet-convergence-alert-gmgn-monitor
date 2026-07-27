'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const monitorSource = read('gmgn/content.js');
const twitterSource = read('gmgn/twitter-audio-content.js');

assert.match(
  monitorSource,
  /async function resumeAudioCtx/,
  'monitor aggregate audio should be able to resume a suspended AudioContext'
);

assert.match(
  monitorSource,
  /pendingAggregateCue/,
  'monitor aggregate cue should be retained briefly when autoplay blocks WebAudio'
);

assert.doesNotMatch(
  monitorSource,
  /if \(!ctx \|\| ctx\.state === 'suspended'\) return/,
  'monitor playSound must not silently drop cues while the AudioContext is suspended'
);

assert.match(
  monitorSource,
  /queuePendingWatchedTradeSpeech/,
  'watched-wallet TTS should be retained briefly when autoplay blocks media playback'
);

assert.match(
  twitterSource,
  /isAutoplayBlockedError/,
  'twitter audio should classify browser autoplay policy failures'
);

assert.match(
  twitterSource,
  /queuePlaybackAfterUnlock/,
  'twitter audio should queue blocked playback for retry after user activation'
);

assert.match(
  twitterSource,
  /lastAudioPlaybackBlockedByPolicy/,
  'twitter audio should distinguish autoplay blocks from network TTS failures'
);

assert.match(
  twitterSource,
  /drainPendingPlaybacksAfterUnlock/,
  'twitter audio should retry pending playback when audio is unlocked'
);

console.log('audio unlock regression tests passed');
