import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.EXT_AUTO_RELOAD_PORT || 17373);
const ROOT = process.cwd();
const WATCH_DEBOUNCE_MS = 120;
const IGNORED_SEGMENTS = new Set([
  '.git',
  'dist',
  'node_modules'
]);
const IGNORED_SUFFIXES = [
  '.log',
  '.tmp',
  '.swp'
];
const IGNORED_PATH_SNIPPETS = [
  'dev\\watcher-state',
  'dev/auto-reload-server'
];

let currentToken = makeToken();
let changedAt = Date.now();
let pendingBumpTimer = null;

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/status') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    response.end(JSON.stringify({
      token: currentToken,
      changedAt
    }));
    return;
  }

  response.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`[auto-reload] ${HOST}:${PORT} is already in use. Assuming watcher is already running.`);
    process.exit(0);
    return;
  }

  console.error('[auto-reload] watcher failed to start:', error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[auto-reload] watching ${ROOT}`);
  console.log(`[auto-reload] status endpoint http://${HOST}:${PORT}/status`);
  startRecursiveWatcher();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  if (pendingBumpTimer) {
    clearTimeout(pendingBumpTimer);
    pendingBumpTimer = null;
  }
  server.close(() => process.exit(0));
}

function startRecursiveWatcher() {
  try {
    fs.watch(ROOT, { recursive: true }, (_eventType, filename) => {
      const relativePath = normalizeRelativePath(filename);
      if (!shouldTriggerReload(relativePath)) {
        return;
      }
      scheduleTokenBump(relativePath);
    });
  } catch (error) {
    console.error('[auto-reload] recursive watch is unavailable:', error);
    process.exit(1);
  }
}

function scheduleTokenBump(relativePath) {
  if (pendingBumpTimer) {
    clearTimeout(pendingBumpTimer);
  }

  pendingBumpTimer = setTimeout(() => {
    pendingBumpTimer = null;
    currentToken = makeToken();
    changedAt = Date.now();
    console.log(`[auto-reload] changed: ${relativePath}`);
  }, WATCH_DEBOUNCE_MS);
}

function normalizeRelativePath(filename) {
  return String(filename || '')
    .replace(/\//g, path.sep)
    .replace(/\\/g, path.sep)
    .trim();
}

function shouldTriggerReload(relativePath) {
  if (!relativePath) return false;

  const pathSegments = relativePath.split(path.sep).filter(Boolean);
  if (pathSegments.some((segment) => IGNORED_SEGMENTS.has(segment))) {
    return false;
  }

  const lowerCasedPath = relativePath.toLowerCase();
  if (IGNORED_SUFFIXES.some((suffix) => lowerCasedPath.endsWith(suffix))) {
    return false;
  }

  if (IGNORED_PATH_SNIPPETS.some((snippet) => lowerCasedPath.includes(snippet.toLowerCase()))) {
    return false;
  }

  return true;
}

function makeToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
