'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

loadDotenv(path.join(__dirname, '.env'));

const PORT = parseInteger(process.env.PORT, 8788);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const VOLC_TTS_ENDPOINT = process.env.VOLC_TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v1/tts';
const VOLC_TTS_CLUSTER = process.env.VOLC_TTS_CLUSTER || 'volcano_tts';
const VOLC_TTS_VOICE_TYPE = process.env.VOLC_TTS_VOICE_TYPE || 'zh_female_cancan_mars_bigtts';
const MAX_TEXT_LENGTH = parseInteger(process.env.MAX_TEXT_LENGTH, 500);
const MAX_BODY_BYTES = parseInteger(process.env.MAX_BODY_BYTES, 16 * 1024);
const CACHE_MAX_ITEMS = parseInteger(process.env.CACHE_MAX_ITEMS, 200);
const CACHE_TTL_MS = parseInteger(process.env.CACHE_TTL_MS, 10 * 60 * 1000);
const LOG_REQUESTS = process.env.LOG_REQUESTS !== 'false';

const EDGE_VOICE_ENV = {
  'zh-CN-XiaoxiaoNeural': 'VOLC_TTS_VOICE_XIAOXIAO',
  'zh-CN-YunjianNeural': 'VOLC_TTS_VOICE_YUNJIAN',
  'zh-CN-XiaoyiNeural': 'VOLC_TTS_VOICE_XIAOYI',
  'en-US-AvaMultilingualNeural': 'VOLC_TTS_VOICE_AVA'
};

const cache = new Map();

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        provider: 'volcengine-doubao',
        endpoint: VOLC_TTS_ENDPOINT,
        cacheItems: cache.size
      });
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/tts') {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return;
    }

    const payload = await readJsonBody(req);
    const text = normalizeText(payload.text);
    if (!text) {
      sendJson(res, 400, { ok: false, error: 'Missing text' });
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      sendJson(res, 400, { ok: false, error: `Text is too long. Max ${MAX_TEXT_LENGTH} characters.` });
      return;
    }

    const credentials = getCredentials();
    if (!credentials.appId || !credentials.accessToken) {
      sendJson(res, 500, {
        ok: false,
        error: 'Missing VOLC_TTS_APP_ID or VOLC_TTS_ACCESS_TOKEN'
      });
      return;
    }

    const voiceType = resolveVoiceType(payload.voice_type || payload.voice);
    const speedRatio = ratioFromPercent(payload.rate, 1);
    const pitchRatio = ratioFromPercent(payload.pitch, 1);
    const cacheKey = JSON.stringify([text, voiceType, speedRatio, pitchRatio]);
    const cached = readCache(cacheKey);
    if (cached) {
      sendAudio(res, cached.audio, 'HIT');
      return;
    }

    const audio = await synthesizeWithVolcengine({
      text,
      voiceType,
      speedRatio,
      pitchRatio,
      credentials
    });

    writeCache(cacheKey, audio);
    if (LOG_REQUESTS) {
      console.log(`${timestamp()} synthesized text_len=${text.length} voice=${voiceType} bytes=${audio.length}`);
    }
    sendAudio(res, audio, 'MISS');
  } catch (error) {
    console.error(`${timestamp()} tts error`, error && error.message ? error.message : error);
    sendJson(res, 502, {
      ok: false,
      error: error && error.message ? error.message : 'TTS proxy failed'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`${timestamp()} gmgn doubao tts proxy listening on http://${HOST}:${PORT}`);
});

function getCredentials() {
  return {
    appId: process.env.VOLC_TTS_APP_ID || '',
    accessToken: process.env.VOLC_TTS_ACCESS_TOKEN || '',
    appToken: process.env.VOLC_TTS_APP_TOKEN || process.env.VOLC_TTS_ACCESS_TOKEN || ''
  };
}

async function synthesizeWithVolcengine({ text, voiceType, speedRatio, pitchRatio, credentials }) {
  const body = {
    app: {
      appid: credentials.appId,
      token: credentials.appToken,
      cluster: VOLC_TTS_CLUSTER
    },
    user: {
      uid: process.env.VOLC_TTS_UID || 'gmgn-extension'
    },
    audio: {
      voice_type: voiceType,
      encoding: 'mp3',
      speed_ratio: speedRatio,
      volume_ratio: parseNumber(process.env.VOLC_TTS_VOLUME_RATIO, 1),
      pitch_ratio: pitchRatio
    },
    request: {
      reqid: crypto.randomUUID(),
      text,
      text_type: 'plain',
      operation: 'query'
    }
  };

  const response = await fetch(VOLC_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer; ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  const json = parseJson(responseText, 'Volcengine returned non-JSON response');
  if (!response.ok) {
    throw new Error(`Volcengine HTTP ${response.status}: ${json.message || json.error || responseText.slice(0, 120)}`);
  }

  const code = json.code ?? json.status_code ?? json.status;
  if (code !== undefined && !isSuccessCode(code)) {
    throw new Error(`Volcengine TTS failed code=${code} message=${json.message || json.error || ''}`.trim());
  }

  const audioBase64 = findAudioBase64(json);
  if (!audioBase64) {
    throw new Error('Volcengine TTS response did not include base64 audio data');
  }

  return Buffer.from(audioBase64, 'base64');
}

function findAudioBase64(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.data === 'string') return value.data;
  if (typeof value.audio === 'string') return value.audio;
  if (typeof value.result === 'string') return value.result;
  if (value.result && typeof value.result === 'object') {
    return findAudioBase64(value.result);
  }
  return '';
}

function resolveVoiceType(value) {
  const voice = String(value || '').trim();
  if (!voice) return VOLC_TTS_VOICE_TYPE;
  const mappedEnv = EDGE_VOICE_ENV[voice];
  if (mappedEnv && process.env[mappedEnv]) return process.env[mappedEnv];
  if (voice.includes('_') || voice.startsWith('BV')) return voice;
  return VOLC_TTS_VOICE_TYPE;
}

function ratioFromPercent(value, fallback) {
  const text = String(value || '').trim();
  const match = /^([+-]?\d+(?:\.\d+)?)%$/.exec(text);
  if (!match) return fallback;
  return clamp(1 + (Number(match[1]) / 100), 0.5, 2);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, item);
  if (LOG_REQUESTS) {
    console.log(`${timestamp()} cache hit bytes=${item.audio.length}`);
  }
  return item;
}

function writeCache(key, audio) {
  cache.set(key, { audio, createdAt: Date.now() });
  while (cache.size > CACHE_MAX_ITEMS) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function sendAudio(res, audio, cacheStatus) {
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': audio.length,
    'Cache-Control': 'no-store',
    'X-TTS-Provider': 'volcengine-doubao',
    'X-TTS-Cache': cacheStatus
  });
  res.end(audio);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request body too large. Max ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(parseJson(raw || '{}', 'Invalid JSON request body'));
    });
    req.on('error', reject);
  });
}

function parseJson(text, message) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(message);
  }
}

function isSuccessCode(code) {
  const normalized = String(code);
  return normalized === '0' || normalized === '3000' || normalized.toLowerCase() === 'success';
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
