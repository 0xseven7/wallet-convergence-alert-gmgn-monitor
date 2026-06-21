import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.dirname(__dirname);

const DEFAULT_CONFIG = {
  host: '0.0.0.0',
  port: 8787,
  hookSecret: '',
  mode: 'dry-run',
  dataDir: './data',
  signalTtlMs: 30_000,
  globalCooldownMs: 0,
  ruleCooldownMs: 0,
  twitterCooldownMs: 0,
  requestTimeoutMs: 8_000,
  gmgnApiCooldownMs: 5_000,
  statusPollIntervalMs: 1_000,
  statusPollTimeoutMs: 65_000,
  executionChains: ['bsc'],
  allowRuleIds: [],
  allowTwitterIds: [],
  maxBuyAmountSol: '0.3',
  maxBuyAmountBnb: '0.3',
  gmgnRouteKey: '',
  gmgnApiKey: '',
  gmgnPrivateKey: '',
  gmgnFromAddress: '',
  gmgnCliCommand: '',
  solanaPrivateKey: '',
  solanaWalletAddress: '',
  solanaRpcUrl: '',
  solanaInputTokenAddress: 'So11111111111111111111111111111111111111112',
  solanaSlippagePercent: 0.5,
  solanaFeeSol: 0,
  solanaAntiMev: false,
  bscInputTokenAddress: '0x0000000000000000000000000000000000000000',
  bscAutoSlippage: true,
  bscSlippage: 0.01,
  bscTipFee: '',
  bscGasPriceGwei: '',
  bscConditionOrders: '',
  bscSellRatioType: 'buy_amount',
  partner: '',
  forwardExecutionUrl: ''
};

export function loadConfig() {
  const fileConfig = loadFileConfig();
  const envConfig = loadEnvConfig();
  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig
  };

  merged.mode = normalizeMode(merged.mode, fileConfig, envConfig);
  merged.host = normalizeHost(merged.host);
  merged.port = clampInteger(merged.port, DEFAULT_CONFIG.port, 1, 65535);
  merged.hookSecret = normalizeString(merged.hookSecret);
  merged.dataDir = resolveServicePath(normalizeString(merged.dataDir) || DEFAULT_CONFIG.dataDir);
  merged.signalTtlMs = clampInteger(merged.signalTtlMs, DEFAULT_CONFIG.signalTtlMs, 1_000, 600_000);
  merged.globalCooldownMs = clampInteger(merged.globalCooldownMs, DEFAULT_CONFIG.globalCooldownMs, 0, 3_600_000);
  merged.ruleCooldownMs = clampInteger(merged.ruleCooldownMs, DEFAULT_CONFIG.ruleCooldownMs, 0, 3_600_000);
  merged.twitterCooldownMs = clampInteger(merged.twitterCooldownMs, DEFAULT_CONFIG.twitterCooldownMs, 0, 3_600_000);
  merged.requestTimeoutMs = clampInteger(merged.requestTimeoutMs, DEFAULT_CONFIG.requestTimeoutMs, 1_000, 60_000);
  merged.gmgnApiCooldownMs = clampInteger(merged.gmgnApiCooldownMs, DEFAULT_CONFIG.gmgnApiCooldownMs, 0, 300_000);
  merged.statusPollIntervalMs = clampInteger(merged.statusPollIntervalMs, DEFAULT_CONFIG.statusPollIntervalMs, 250, 10_000);
  merged.statusPollTimeoutMs = clampInteger(merged.statusPollTimeoutMs, DEFAULT_CONFIG.statusPollTimeoutMs, 5_000, 300_000);
  merged.executionChains = normalizeCsvArray(merged.executionChains, DEFAULT_CONFIG.executionChains);
  merged.allowRuleIds = normalizeCsvArray(merged.allowRuleIds, []);
  merged.allowTwitterIds = normalizeCsvArray(merged.allowTwitterIds, []).map(normalizeTwitterId);
  merged.maxBuyAmountSol = normalizeDecimalString(merged.maxBuyAmountSol, DEFAULT_CONFIG.maxBuyAmountSol);
  merged.maxBuyAmountBnb = normalizeDecimalString(merged.maxBuyAmountBnb, DEFAULT_CONFIG.maxBuyAmountBnb);
  merged.gmgnRouteKey = normalizeString(merged.gmgnRouteKey);
  merged.gmgnApiKey = normalizeString(merged.gmgnApiKey);
  merged.gmgnPrivateKey = normalizeString(merged.gmgnPrivateKey);
  merged.gmgnFromAddress = normalizeAddress(merged.gmgnFromAddress);
  merged.gmgnCliCommand = normalizeString(merged.gmgnCliCommand);
  merged.solanaPrivateKey = normalizeString(merged.solanaPrivateKey);
  merged.solanaWalletAddress = normalizeString(merged.solanaWalletAddress);
  merged.solanaRpcUrl = normalizeString(merged.solanaRpcUrl);
  merged.solanaInputTokenAddress = normalizeString(merged.solanaInputTokenAddress) || DEFAULT_CONFIG.solanaInputTokenAddress;
  merged.solanaSlippagePercent = clampFloat(merged.solanaSlippagePercent, DEFAULT_CONFIG.solanaSlippagePercent, 0.01, 99);
  merged.solanaFeeSol = clampFloat(merged.solanaFeeSol, DEFAULT_CONFIG.solanaFeeSol, 0, 5);
  merged.solanaAntiMev = normalizeBoolean(merged.solanaAntiMev, DEFAULT_CONFIG.solanaAntiMev);
  merged.bscInputTokenAddress = normalizeAddress(merged.bscInputTokenAddress) || DEFAULT_CONFIG.bscInputTokenAddress;
  merged.bscAutoSlippage = normalizeBoolean(merged.bscAutoSlippage, DEFAULT_CONFIG.bscAutoSlippage);
  merged.bscSlippage = clampFloat(merged.bscSlippage, DEFAULT_CONFIG.bscSlippage, 0.0001, 1);
  merged.bscTipFee = normalizeDecimalString(merged.bscTipFee, '');
  merged.bscGasPriceGwei = normalizeDecimalString(merged.bscGasPriceGwei, '');
  merged.bscConditionOrders = normalizeJsonArrayString(merged.bscConditionOrders);
  merged.bscSellRatioType = normalizeSellRatioType(merged.bscSellRatioType, DEFAULT_CONFIG.bscSellRatioType);
  merged.partner = normalizeString(merged.partner);
  merged.forwardExecutionUrl = normalizeUrl(merged.forwardExecutionUrl);
  merged.serviceRoot = serviceRoot;

  return merged;
}

function loadFileConfig() {
  const configPath = process.env.GMGN_TRADE_SERVICE_CONFIG
    ? path.resolve(process.env.GMGN_TRADE_SERVICE_CONFIG)
    : path.join(serviceRoot, 'config.json');

  if (!fs.existsSync(configPath)) {
    return {};
  }

  return parseJson(fs.readFileSync(configPath, 'utf8'), configPath);
}

function loadEnvConfig() {
  const env = process.env;
  const next = {};

  if (env.HOST !== undefined) next.host = env.HOST;
  if (env.PORT !== undefined) next.port = env.PORT;
  if (env.HOOK_SECRET !== undefined) next.hookSecret = env.HOOK_SECRET;
  if (env.MODE !== undefined) next.mode = env.MODE;
  if (env.DRY_RUN !== undefined) next.dryRun = env.DRY_RUN;
  if (env.DATA_DIR !== undefined) next.dataDir = env.DATA_DIR;
  if (env.SIGNAL_TTL_MS !== undefined) next.signalTtlMs = env.SIGNAL_TTL_MS;
  if (env.GLOBAL_COOLDOWN_MS !== undefined) next.globalCooldownMs = env.GLOBAL_COOLDOWN_MS;
  if (env.RULE_COOLDOWN_MS !== undefined) next.ruleCooldownMs = env.RULE_COOLDOWN_MS;
  if (env.TWITTER_COOLDOWN_MS !== undefined) next.twitterCooldownMs = env.TWITTER_COOLDOWN_MS;
  if (env.REQUEST_TIMEOUT_MS !== undefined) next.requestTimeoutMs = env.REQUEST_TIMEOUT_MS;
  if (env.GMGN_API_COOLDOWN_MS !== undefined) next.gmgnApiCooldownMs = env.GMGN_API_COOLDOWN_MS;
  if (env.STATUS_POLL_INTERVAL_MS !== undefined) next.statusPollIntervalMs = env.STATUS_POLL_INTERVAL_MS;
  if (env.STATUS_POLL_TIMEOUT_MS !== undefined) next.statusPollTimeoutMs = env.STATUS_POLL_TIMEOUT_MS;
  if (env.EXECUTION_CHAINS !== undefined) next.executionChains = env.EXECUTION_CHAINS;
  if (env.ALLOW_RULE_IDS !== undefined) next.allowRuleIds = env.ALLOW_RULE_IDS;
  if (env.ALLOW_TWITTER_IDS !== undefined) next.allowTwitterIds = env.ALLOW_TWITTER_IDS;
  if (env.MAX_BUY_AMOUNT_SOL !== undefined) next.maxBuyAmountSol = env.MAX_BUY_AMOUNT_SOL;
  if (env.MAX_BUY_AMOUNT_BNB !== undefined) next.maxBuyAmountBnb = env.MAX_BUY_AMOUNT_BNB;
  if (env.GMGN_ROUTE_KEY !== undefined) next.gmgnRouteKey = env.GMGN_ROUTE_KEY;
  if (env.GMGN_API_KEY !== undefined) next.gmgnApiKey = env.GMGN_API_KEY;
  if (env.GMGN_PRIVATE_KEY !== undefined) next.gmgnPrivateKey = env.GMGN_PRIVATE_KEY;
  if (env.GMGN_FROM_ADDRESS !== undefined) next.gmgnFromAddress = env.GMGN_FROM_ADDRESS;
  if (env.GMGN_CLI_COMMAND !== undefined) next.gmgnCliCommand = env.GMGN_CLI_COMMAND;
  if (env.SOLANA_PRIVATE_KEY !== undefined) next.solanaPrivateKey = env.SOLANA_PRIVATE_KEY;
  if (env.SOLANA_WALLET_ADDRESS !== undefined) next.solanaWalletAddress = env.SOLANA_WALLET_ADDRESS;
  if (env.SOLANA_RPC_URL !== undefined) next.solanaRpcUrl = env.SOLANA_RPC_URL;
  if (env.SOLANA_INPUT_TOKEN_ADDRESS !== undefined) next.solanaInputTokenAddress = env.SOLANA_INPUT_TOKEN_ADDRESS;
  if (env.SOLANA_SLIPPAGE_PERCENT !== undefined) next.solanaSlippagePercent = env.SOLANA_SLIPPAGE_PERCENT;
  if (env.SOLANA_FEE_SOL !== undefined) next.solanaFeeSol = env.SOLANA_FEE_SOL;
  if (env.SOLANA_ANTI_MEV !== undefined) next.solanaAntiMev = env.SOLANA_ANTI_MEV;
  if (env.BSC_INPUT_TOKEN_ADDRESS !== undefined) next.bscInputTokenAddress = env.BSC_INPUT_TOKEN_ADDRESS;
  if (env.BSC_AUTO_SLIPPAGE !== undefined) next.bscAutoSlippage = env.BSC_AUTO_SLIPPAGE;
  if (env.BSC_SLIPPAGE !== undefined) next.bscSlippage = env.BSC_SLIPPAGE;
  if (env.BSC_TIP_FEE !== undefined) next.bscTipFee = env.BSC_TIP_FEE;
  if (env.BSC_GAS_PRICE_GWEI !== undefined) next.bscGasPriceGwei = env.BSC_GAS_PRICE_GWEI;
  if (env.BSC_CONDITION_ORDERS !== undefined) next.bscConditionOrders = env.BSC_CONDITION_ORDERS;
  if (env.BSC_SELL_RATIO_TYPE !== undefined) next.bscSellRatioType = env.BSC_SELL_RATIO_TYPE;
  if (env.PARTNER !== undefined) next.partner = env.PARTNER;
  if (env.FORWARD_EXECUTION_URL !== undefined) next.forwardExecutionUrl = env.FORWARD_EXECUTION_URL;

  return next;
}

function normalizeMode(rawMode, fileConfig, envConfig) {
  const candidate = normalizeString(rawMode).toLowerCase();
  if (candidate === 'dry-run' || candidate === 'paper-execution' || candidate === 'live') {
    return candidate;
  }

  const dryRunValue = envConfig.dryRun ?? fileConfig.dryRun;
  if (dryRunValue !== undefined) {
    return normalizeBoolean(dryRunValue, true) ? 'dry-run' : 'live';
  }

  return DEFAULT_CONFIG.mode;
}

function normalizeHost(value) {
  const host = normalizeString(value);
  return host || DEFAULT_CONFIG.host;
}

function resolveServicePath(targetPath) {
  if (!targetPath) return serviceRoot;
  return path.isAbsolute(targetPath) ? targetPath : path.join(serviceRoot, targetPath);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampFloat(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const lowered = normalizeString(value).toLowerCase();
  if (!lowered) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  return fallback;
}

function normalizeCsvArray(value, fallback) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  const raw = normalizeString(value);
  if (!raw) return [...fallback];
  return raw.split(',').map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeDecimalString(value, fallback) {
  const raw = normalizeString(value);
  if (!raw) return fallback;
  return raw;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeUrl(value) {
  const raw = normalizeString(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_error) {
    return '';
  }
}

function normalizeAddress(value) {
  const raw = normalizeString(value);
  return raw ? raw.toLowerCase() : '';
}

function normalizeJsonArrayString(value) {
  const raw = normalizeString(value);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return '';
    return JSON.stringify(parsed);
  } catch (_error) {
    return '';
  }
}

function normalizeSellRatioType(value, fallback) {
  const raw = normalizeString(value).toLowerCase();
  if (raw === 'buy_amount' || raw === 'hold_amount') {
    return raw;
  }
  return fallback;
}

function normalizeTwitterId(value) {
  return normalizeString(value).toLowerCase().replace(/^@/, '');
}

function parseJson(raw, source) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON config from ${source}: ${error.message}`);
  }
}
