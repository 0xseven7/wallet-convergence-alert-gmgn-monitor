const DEFAULT_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';
const DEFAULT_CLUSTER = 'volcano_tts';
const DEFAULT_VOICE_TYPE = 'zh_female_cancan_mars_bigtts';
const DEFAULT_CORS_ORIGIN = '*';

const EDGE_VOICE_ENV = {
  'zh-CN-XiaoxiaoNeural': 'VOLC_TTS_VOICE_XIAOXIAO',
  'zh-CN-YunjianNeural': 'VOLC_TTS_VOICE_YUNJIAN',
  'zh-CN-XiaoyiNeural': 'VOLC_TTS_VOICE_XIAOYI',
  'en-US-AvaMultilingualNeural': 'VOLC_TTS_VOICE_AVA'
};

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        provider: 'volcengine-doubao',
        runtime: 'cloudflare-worker'
      }, 200, corsHeaders);
    }

    if (request.method !== 'POST' || url.pathname !== '/tts') {
      return jsonResponse({ ok: false, error: 'Not found' }, 404, corsHeaders);
    }

    try {
      const payload = await request.json();
      const text = String(payload.text || '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return jsonResponse({ ok: false, error: 'Missing text' }, 400, corsHeaders);
      }

      if (!env.VOLC_TTS_APP_ID || !env.VOLC_TTS_ACCESS_TOKEN) {
        return jsonResponse({ ok: false, error: 'Missing VOLC_TTS_APP_ID or VOLC_TTS_ACCESS_TOKEN' }, 500, corsHeaders);
      }

      const voiceType = resolveVoiceType(payload.voice_type || payload.voice, env);
      const response = await fetch(env.VOLC_TTS_ENDPOINT || DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer; ${env.VOLC_TTS_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app: {
            appid: env.VOLC_TTS_APP_ID,
            token: env.VOLC_TTS_APP_TOKEN || env.VOLC_TTS_ACCESS_TOKEN,
            cluster: env.VOLC_TTS_CLUSTER || DEFAULT_CLUSTER
          },
          user: {
            uid: env.VOLC_TTS_UID || 'gmgn-extension'
          },
          audio: {
            voice_type: voiceType,
            encoding: 'mp3',
            speed_ratio: ratioFromPercent(payload.rate, 1),
            volume_ratio: Number(env.VOLC_TTS_VOLUME_RATIO || 1),
            pitch_ratio: ratioFromPercent(payload.pitch, 1)
          },
          request: {
            reqid: crypto.randomUUID(),
            text,
            text_type: 'plain',
            operation: 'query'
          }
        })
      });

      const result = await response.json();
      const code = result.code ?? result.status_code ?? result.status;
      if (!response.ok || (code !== undefined && !isSuccessCode(code))) {
        return jsonResponse({
          ok: false,
          error: `Volcengine TTS failed: ${result.message || result.error || response.status}`
        }, 502, corsHeaders);
      }

      const audioBase64 = findAudioBase64(result);
      if (!audioBase64) {
        return jsonResponse({ ok: false, error: 'Volcengine TTS response did not include audio data' }, 502, corsHeaders);
      }

      return new Response(base64ToBytes(audioBase64), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
          'X-TTS-Provider': 'volcengine-doubao'
        }
      });
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: error && error.message ? error.message : 'TTS worker failed'
      }, 502, corsHeaders);
    }
  }
};

function resolveVoiceType(value, env) {
  const voice = String(value || '').trim();
  if (!voice) return env.VOLC_TTS_VOICE_TYPE || DEFAULT_VOICE_TYPE;
  const mappedEnv = EDGE_VOICE_ENV[voice];
  if (mappedEnv && env[mappedEnv]) return env[mappedEnv];
  if (voice.includes('_') || voice.startsWith('BV')) return voice;
  return env.VOLC_TTS_VOICE_TYPE || DEFAULT_VOICE_TYPE;
}

function ratioFromPercent(value, fallback) {
  const match = /^([+-]?\d+(?:\.\d+)?)%$/.exec(String(value || '').trim());
  if (!match) return fallback;
  return Math.min(2, Math.max(0.5, 1 + (Number(match[1]) / 100)));
}

function findAudioBase64(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.data === 'string') return value.data;
  if (typeof value.audio === 'string') return value.audio;
  if (typeof value.result === 'string') return value.result;
  if (value.result && typeof value.result === 'object') return findAudioBase64(value.result);
  return '';
}

function isSuccessCode(code) {
  const normalized = String(code);
  return normalized === '0' || normalized === '3000' || normalized.toLowerCase() === 'success';
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function buildCorsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true'
  };
}
