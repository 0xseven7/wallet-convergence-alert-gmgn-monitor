import http from 'node:http';
import { createTradePipeline } from 'trade-pipeline-core';

import { isAuthorized } from './auth.mjs';
import { loadConfig } from './config.mjs';
import { toTradeSignal } from './execution/index.mjs';
import { readJson } from './http-body.mjs';
import { createLogger } from './logger.mjs';
import { normalizeSignal } from './normalize-signal.mjs';

export async function startServer() {
  const config = loadConfig();
  const logger = createLogger(config.dataDir);
  const pipeline = createTradePipeline(config, { logger });
  const startedAt = Date.now();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'gmgn-trade-service',
        mode: config.mode,
        dryRun: config.mode === 'dry-run',
        uptimeMs: Date.now() - startedAt,
        executionChains: config.executionChains
      });
    }

    if (req.method === 'POST' && req.url === '/webhook/twitter-trigger') {
      return handleTwitterTriggerWebhook({
        req,
        res,
        config,
        logger,
        pipeline
      });
    }

    sendJson(res, 404, {
      ok: false,
      error: 'Not found'
    });
  });

  await new Promise((resolve) => {
    server.listen(config.port, config.host, resolve);
  });

  logger.info('GMGN trade service started.', {
    host: config.host,
    port: config.port,
    mode: config.mode,
    executionChains: config.executionChains
  });

  return server;
}

async function handleTwitterTriggerWebhook(context) {
  const { req, res, config, logger, pipeline } = context;

  if (!isAuthorized(req, config)) {
    logger.writeError({
      ts: Date.now(),
      type: 'unauthorized',
      ip: req.socket?.remoteAddress || ''
    });
    return sendJson(res, 401, {
      ok: false,
      error: 'Unauthorized'
    });
  }

  let rawPayload;
  try {
    rawPayload = await readJson(req);
  } catch (error) {
    logger.writeError({
      ts: Date.now(),
      type: 'invalid-json',
      error: logger.serializeError(error)
    });
    return sendJson(res, error.statusCode === 413 ? 413 : 400, {
      ok: false,
      error: error.statusCode === 413 ? 'Request body is too large' : 'Invalid JSON payload'
    });
  }

  const signal = normalizeSignal(rawPayload);
  if (!signal) {
    logger.writeError({
      ts: Date.now(),
      type: 'invalid-payload',
      payload: rawPayload
    });
    return sendJson(res, 400, {
      ok: false,
      error: 'Invalid payload'
    });
  }

  logger.writeSignal({
    ts: Date.now(),
    signalId: signal.signalId,
    source: signal.source,
    rawPayload,
    signal
  });

  let executionResult;
  try {
    executionResult = await pipeline.handleSignal(toTradeSignal(signal));
  } catch (error) {
    executionResult = {
      status: 'failed',
      mode: config.mode,
      chain: signal.rule.chain,
      adapter: resolveAdapterName(signal.rule.chain),
      error: error && error.message ? error.message : String(error)
    };
    logger.writeError({
      ts: Date.now(),
      type: 'execution-error',
      signalId: signal.signalId,
      error: logger.serializeError(error)
    });
  }

  logger.writeExecution({
    ts: Date.now(),
    signalId: signal.signalId,
    result: executionResult
  });

  if (executionResult && executionResult.duplicated) {
    return sendJson(res, 200, {
      ok: true,
      duplicated: true,
      signalId: signal.signalId
    });
  }

  if (executionResult && executionResult.status === 'rejected') {
    return sendJson(res, 200, {
      ok: true,
      accepted: false,
      rejected: true,
      signalId: signal.signalId,
      reason: executionResult.reason,
      code: executionResult.code,
      execution: executionResult
    });
  }

  return sendJson(res, 200, {
    ok: true,
    accepted: true,
    signalId: signal.signalId,
    execution: executionResult
  });
}

function resolveAdapterName(chain) {
  if (chain === 'sol') return 'gmgn-sol';
  if (chain === 'bsc') return 'gmgn-bsc';
  return 'unsupported-chain';
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}
