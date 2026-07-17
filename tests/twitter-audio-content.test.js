'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'gmgn', 'twitter-audio-content.js'), 'utf8');

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, timeoutMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await wait(10);
  }
}

function createWindowMock() {
  const listeners = new Map();
  return {
    __listeners: listeners,
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      const list = listeners.get(event.type) || [];
      for (const handler of list) {
        handler.call(this, event);
      }
      return true;
    }
  };
}

class TestCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

class TestBroadcastChannel {
  constructor() {}
  postMessage() {}
  close() {}
}

class TestAudio {
  constructor(source = '') {
    this.src = source;
    this.preload = '';
    this.readyState = 4;
    this.volume = 1;
  }

  addEventListener(type, handler) {
    if (type === 'ended') this.onended = handler;
    if (type === 'error') this.onerror = handler;
  }

  cloneNode() {
    return new TestAudio(this.src);
  }

  load() {}
  pause() {}
  removeAttribute() {}

  async play() {
    setTimeout(() => {
      if (this.onended) this.onended();
    }, 0);
  }
}

class TestSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.listeners = {};
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  emit(type, event = {}) {
    if (this.listeners[type]) this.listeners[type](event);
  }
}

const windowMock = createWindowMock();
const spoken = [];
const fetchCalls = [];
const ttsMessages = [];
const capturedWarnings = [];
const testConsole = {
  ...console,
  warn(...args) {
    capturedWarnings.push(args);
  }
};
const TestURL = URL;
TestURL.createObjectURL = () => 'blob:test-audio';
TestURL.revokeObjectURL = () => {};

windowMock.speechSynthesis = {
  cancel() {},
  speak(utterance) {
    spoken.push(utterance.text);
    setTimeout(() => {
      utterance.emit('start');
      utterance.emit('end');
    }, 0);
  }
};

const sandbox = {
  window: windowMock,
  document: {
    visibilityState: 'visible',
    addEventListener() {}
  },
  chrome: {
    storage: {
      local: {
        get: async () => ({})
      },
      onChanged: {
        addListener() {}
      }
    },
    runtime: {
      getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
      sendMessage: async (message) => {
        if (message && message.type === 'fetch-twitter-tts-audio') {
          ttsMessages.push(message);
          return {
            ok: false,
            error: 'TTS request failed with 502: {"error":{"code":"TTS_UPSTREAM_ERROR"}}'
          };
        }
        return { ok: true };
      }
    }
  },
  BroadcastChannel: TestBroadcastChannel,
  Audio: TestAudio,
  AudioContext: null,
  webkitAudioContext: null,
  CustomEvent: TestCustomEvent,
  SpeechSynthesisUtterance: TestSpeechSynthesisUtterance,
  AbortController,
  URL: TestURL,
  console: testConsole,
  setTimeout,
  clearTimeout,
  fetch: async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: false,
      status: 502,
      text: async () => '{"error":{"code":"TTS_UPSTREAM_ERROR"}}'
    };
  }
};

sandbox.window.AudioContext = null;
sandbox.window.webkitAudioContext = null;

vm.runInNewContext(source, sandbox);
void awaitReady().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function awaitReady() {
  await wait(5);

  windowMock.dispatchEvent(new TestCustomEvent('TWITTER_WS_MSG_RECEIVED', {
    detail: {
      triggers: [{
        id: 'unmapped_one',
        username: 'unmapped_one',
        name: '鐧芥瘺鑲＄',
        tw: 'reply'
      }]
    }
  }));

  await waitUntil(() => spoken.length >= 1);
  assert.equal(ttsMessages.length, 1, 'first TTS event should request the background TTS proxy');
  assert.equal(ttsMessages[0].payload.ttsApiUrl, 'http://tts.macmini.lan/tts/v3-task');
  assert.equal(ttsMessages[0].payload.text, '鐧芥瘺鑲＄，回复了');
  assert.equal(spoken[0], ttsMessages[0].payload.text);

  windowMock.dispatchEvent(new TestCustomEvent('TWITTER_WS_MSG_RECEIVED', {
    detail: {
      triggers: [{
        id: 'unmapped_two',
        username: 'unmapped_two',
        name: 'Elon Musk',
        tw: 'quote'
      }]
    }
  }));

  await waitUntil(() => spoken.length >= 2);
  assert.equal(ttsMessages.length, 1, 'TTS failure cooldown should skip repeated network proxy calls');
  assert.equal(spoken[1], 'Elon Musk，引用了推文');

  assert.ok(windowMock.__gmgnTwitterAudioDebug.lastNetworkTtsFailure.includes('502'));
  assert.ok(windowMock.__gmgnTwitterAudioDebug.networkTtsCooldownUntil > Date.now());
  assert.ok(capturedWarnings.some((args) => args.some((value) => String(value).includes('Network TTS failed'))));

  console.log('twitter-audio-content tests passed');
}
