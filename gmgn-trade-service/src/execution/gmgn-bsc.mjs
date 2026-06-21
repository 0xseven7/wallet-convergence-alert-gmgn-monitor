import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..', '..');

export async function evaluateBscTokenFilters(signal, context) {
  const { config } = context;
  const filters = signal.rule.filters || {};
  const hasMarketCapFilter = Boolean(filters.marketCapMinUsd || filters.marketCapMaxUsd);
  const hasAgeFilter = Boolean(filters.maxTokenAgeSeconds);
  if (!hasMarketCapFilter && !hasAgeFilter) {
    return { ok: true };
  }

  if (config.mode === 'dry-run' && !config.gmgnApiKey) {
    return { ok: true, skipped: true, reason: 'GMGN_API_KEY is empty in dry-run mode.' };
  }

  const tokenInfo = await fetchBscTokenInfo(signal, config);
  const marketCapUsd = extractMarketCapUsd(tokenInfo);
  const createdAtMs = extractCreatedAtMs(tokenInfo);

  if (filters.marketCapMinUsd && (!Number.isFinite(marketCapUsd) || marketCapUsd < Number(filters.marketCapMinUsd))) {
    return rejectFilter('market-cap-too-low', `Market cap ${marketCapUsd || 'unknown'} is below ${filters.marketCapMinUsd}.`, tokenInfo);
  }
  if (filters.marketCapMaxUsd && (!Number.isFinite(marketCapUsd) || marketCapUsd > Number(filters.marketCapMaxUsd))) {
    return rejectFilter('market-cap-too-high', `Market cap ${marketCapUsd || 'unknown'} is above ${filters.marketCapMaxUsd}.`, tokenInfo);
  }
  if (filters.maxTokenAgeSeconds) {
    if (!Number.isFinite(createdAtMs)) {
      return rejectFilter('token-age-unknown', 'Token create/open time is unavailable.', tokenInfo);
    }
    const tokenAgeSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
    if (tokenAgeSeconds > Number(filters.maxTokenAgeSeconds)) {
      return rejectFilter('token-too-old', `Token age ${tokenAgeSeconds}s exceeds ${filters.maxTokenAgeSeconds}s.`, tokenInfo);
    }
  }

  return {
    ok: true,
    tokenInfo: {
      marketCapUsd: Number.isFinite(marketCapUsd) ? marketCapUsd : null,
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null
    }
  };
}

export async function executeBscSignal(signal, context) {
  const { config } = context;
  const amountWei = bnbToWei(signal.rule.buyAmount);

  if (amountWei <= 0n) {
    throw new Error('BSC buy amount resolved to zero wei.');
  }

  const fromAddress = normalizeAddress(config.gmgnFromAddress);
  if (!fromAddress) {
    throw new Error('GMGN_FROM_ADDRESS is required for BSC gmgn-cli execution.');
  }

  if (config.mode === 'paper-execution') {
    const args = buildQuoteArgs({
      config,
      signal,
      fromAddress,
      amountWei
    });
    const result = await runGmgnCli(args, config);
    return {
      status: 'paper',
      mode: 'paper-execution',
      adapter: 'gmgn-cli-bsc',
      chain: 'bsc',
      ca: signal.rule.ca,
      buyAmount: signal.rule.buyAmount,
      amountWei: amountWei.toString(),
      command: summarizeCommand(args),
      result: result.parsed ?? result.stdout
    };
  }

  const args = buildSwapArgs({
    config,
    signal,
    fromAddress,
    amountWei
  });
  const result = await runGmgnCli(args, config);

  return {
    status: inferSwapStatus(result.parsed),
    mode: 'live',
    adapter: 'gmgn-cli-bsc',
    chain: 'bsc',
    ca: signal.rule.ca,
    buyAmount: signal.rule.buyAmount,
    amountWei: amountWei.toString(),
    command: summarizeCommand(args),
    result: result.parsed ?? result.stdout
  };
}

function buildQuoteArgs({ config, signal, fromAddress, amountWei }) {
  const executionOptions = getExecutionOptions(signal, config);
  return [
    'order',
    'quote',
    '--chain',
    'bsc',
    '--from',
    fromAddress,
    '--input-token',
    normalizeAddress(config.bscInputTokenAddress),
    '--output-token',
    normalizeAddress(signal.rule.ca),
    '--amount',
    amountWei.toString(),
    '--slippage',
    executionOptions.slippage,
    '--raw'
  ];
}

function buildSwapArgs({ config, signal, fromAddress, amountWei }) {
  const executionOptions = getExecutionOptions(signal, config);
  const args = [
    'swap',
    '--chain',
    'bsc',
    '--from',
    fromAddress,
    '--input-token',
    normalizeAddress(config.bscInputTokenAddress),
    '--output-token',
    normalizeAddress(signal.rule.ca),
    '--amount',
    amountWei.toString()
  ];

  if (executionOptions.autoSlippage) {
    args.push('--auto-slippage');
  } else {
    args.push('--slippage', executionOptions.slippage);
  }

  if (executionOptions.tipFeeBnb) {
    args.push('--tip-fee', executionOptions.tipFeeBnb);
  }

  if (executionOptions.gasPriceGwei) {
    args.push('--gas-price', executionOptions.gasPriceGwei);
  }

  if (executionOptions.antiMev) {
    args.push('--anti-mev');
  }

  const conditionOrders = getConditionOrders(signal, config);
  if (conditionOrders) {
    if (!executionOptions.gasPriceGwei) {
      throw new Error('BSC condition orders require per-rule gasPriceGwei or fallback BSC_GAS_PRICE_GWEI because gmgn-cli requires --gas-price for BSC condition orders.');
    }
    args.push('--condition-orders', conditionOrders);
    args.push('--sell-ratio-type', config.bscSellRatioType);
  }

  args.push('--raw');
  return args;
}

async function fetchBscTokenInfo(signal, config) {
  const args = [
    'token',
    'info',
    '--chain',
    'bsc',
    '--address',
    normalizeAddress(signal.rule.ca),
    '--raw'
  ];
  const result = await runGmgnCli(args, config, { requirePrivateKey: false });
  return result.parsed ?? {};
}

async function runGmgnCli(args, config, options = {}) {
  const { requirePrivateKey = true } = options;
  const cliCommand = resolveGmgnCliCommand(config.gmgnCliCommand);
  const env = {
    ...process.env,
    GMGN_API_KEY: config.gmgnApiKey,
    GMGN_PRIVATE_KEY: config.gmgnPrivateKey
  };

  if (!env.GMGN_API_KEY) {
    throw new Error('GMGN_API_KEY is required for gmgn-cli execution.');
  }
  if (requirePrivateKey && !env.GMGN_PRIVATE_KEY) {
    throw new Error('GMGN_PRIVATE_KEY is required for gmgn-cli swap/order execution.');
  }

  const output = await spawnWithOutput(cliCommand.command, [...cliCommand.args, ...args], {
    cwd: serviceRoot,
    env,
    timeoutMs: config.requestTimeoutMs
  });

  const parsed = parseJsonOutput(output.stdout);
  return {
    ...output,
    parsed
  };
}

function getConditionOrders(signal, config) {
  if (Array.isArray(signal.rule.conditionOrders) && signal.rule.conditionOrders.length > 0) {
    return JSON.stringify(signal.rule.conditionOrders);
  }
  return config.bscConditionOrders;
}

function getExecutionOptions(signal, config) {
  const raw = signal.rule.execution && typeof signal.rule.execution === 'object'
    ? signal.rule.execution
    : {};
  const autoSlippage = typeof raw.autoSlippage === 'boolean'
    ? raw.autoSlippage
    : config.bscAutoSlippage;
  return {
    autoSlippage,
    slippage: raw.slippage || String(config.bscSlippage),
    tipFeeBnb: raw.tipFeeBnb || config.bscTipFee,
    gasPriceGwei: raw.gasPriceGwei || config.bscGasPriceGwei,
    antiMev: raw.antiMev === true
  };
}

function extractMarketCapUsd(tokenInfo) {
  const candidates = collectValuesByKey(tokenInfo, [
    'market_cap',
    'marketCap',
    'market_cap_usd',
    'marketCapUsd',
    'fdv',
    'fdv_usd'
  ]);
  return firstFiniteNumber(candidates);
}

function extractCreatedAtMs(tokenInfo) {
  const candidates = collectValuesByKey(tokenInfo, [
    'created_at',
    'createdAt',
    'create_time',
    'createTime',
    'open_timestamp',
    'openTimestamp',
    'launch_time',
    'launchTime'
  ]);
  const value = firstFiniteNumber(candidates);
  if (!Number.isFinite(value)) return NaN;
  return value > 10_000_000_000 ? value : value * 1000;
}

function collectValuesByKey(value, keyNames, output = []) {
  if (!value || typeof value !== 'object') return output;
  const keySet = new Set(keyNames);
  for (const [key, child] of Object.entries(value)) {
    if (keySet.has(key)) {
      output.push(child);
    }
    if (child && typeof child === 'object') {
      collectValuesByKey(child, keyNames, output);
    }
  }
  return output;
}

function firstFiniteNumber(values) {
  for (const value of values) {
    const numeric = parseCompactNumber(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return NaN;
}

function parseCompactNumber(value) {
  if (typeof value === 'number') return value;
  const raw = String(value || '').trim().replace(/[$,\s]/g, '');
  const match = /^(\d+(?:\.\d+)?)([kKmMbB])?$/.exec(raw);
  if (!match) return NaN;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return NaN;
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return number * 1_000;
  if (suffix === 'm') return number * 1_000_000;
  if (suffix === 'b') return number * 1_000_000_000;
  return number;
}

function rejectFilter(code, reason, tokenInfo) {
  return {
    ok: false,
    code,
    reason,
    tokenInfo
  };
}

function resolveGmgnCliCommand(configuredCommand) {
  if (configuredCommand) {
    return {
      command: configuredCommand,
      args: []
    };
  }

  if (process.platform === 'win32') {
    const packageEntry = path.join(serviceRoot, 'node_modules', 'gmgn-cli', 'dist', 'index.js');
    if (fs.existsSync(packageEntry)) {
      return {
        command: process.execPath,
        args: [packageEntry]
      };
    }
  }

  const localBinName = process.platform === 'win32' ? 'gmgn-cli.cmd' : 'gmgn-cli';
  const localBin = path.join(serviceRoot, 'node_modules', '.bin', localBinName);
  if (fs.existsSync(localBin)) {
    return {
      command: localBin,
      args: []
    };
  }

  return {
    command: 'gmgn-cli',
    args: []
  };
}

async function spawnWithOutput(command, args, options) {
  const { cwd, env, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`gmgn-cli timed out after ${timeoutMs}ms: ${summarizeCommand(args).join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`gmgn-cli exited with code ${code}: ${stderr || stdout}`.slice(0, 1000)));
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function bnbToWei(rawAmount) {
  const raw = String(rawAmount || '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid BNB amount: "${raw}"`);
  }

  const [wholePart, fractionPart = ''] = raw.split('.');
  const normalizedFraction = `${fractionPart}000000000000000000`.slice(0, 18);
  return (BigInt(wholePart) * 1_000_000_000_000_000_000n) + BigInt(normalizedFraction);
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function parseJsonOutput(stdout) {
  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch (_error) {
    return null;
  }
}

function inferSwapStatus(parsed) {
  if (!parsed) {
    return 'submitted';
  }
  if (parsed.success === false || parsed.error || parsed.error_code || parsed.error_status) {
    return 'failed';
  }
  if (parsed.data?.success === false || parsed.data?.error || parsed.data?.error_code || parsed.data?.error_status) {
    return 'failed';
  }
  return 'submitted';
}

function summarizeCommand(args) {
  return ['gmgn-cli', ...args];
}
