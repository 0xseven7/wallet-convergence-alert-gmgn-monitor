export async function handleUnsupportedExecution(signal, context) {
  const { config } = context;

  if (config.forwardExecutionUrl) {
    return forwardSignal(signal, config.forwardExecutionUrl, config.requestTimeoutMs);
  }

  return {
    status: 'skipped',
    mode: config.mode,
    adapter: 'unsupported-chain',
    chain: signal.rule.chain,
    reason: `Chain "${signal.rule.chain}" is not implemented in this service yet.`
  };
}

async function forwardSignal(signal, targetUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signal),
      signal: controller.signal
    });

    const body = await response.text().catch(() => '');
    return {
      status: response.ok ? 'forwarded' : 'failed',
      mode: 'live',
      adapter: 'forward',
      chain: signal.rule.chain,
      targetUrl,
      responseStatus: response.status,
      responseBody: body.slice(0, 500)
    };
  } catch (error) {
    return {
      status: 'failed',
      mode: 'live',
      adapter: 'forward',
      chain: signal.rule.chain,
      targetUrl,
      error: error && error.message ? error.message : String(error)
    };
  } finally {
    clearTimeout(timer);
  }
}
