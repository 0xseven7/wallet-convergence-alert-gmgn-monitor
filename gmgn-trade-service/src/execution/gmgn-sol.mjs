import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const GMGN_API_HOST = 'https://gmgn.ai';

export async function executeSolSignal(signal, context) {
  const { config } = context;
  const wallet = shouldSignTransaction(config.mode) ? buildWallet(config) : null;
  const fromAddress = config.solanaWalletAddress || wallet?.publicKey?.toBase58() || '';

  if (!fromAddress) {
    throw new Error('SOLANA_WALLET_ADDRESS or SOLANA_PRIVATE_KEY is required for Solana execution.');
  }

  if (wallet && config.solanaWalletAddress && config.solanaWalletAddress !== fromAddress) {
    throw new Error('Configured SOLANA_WALLET_ADDRESS does not match SOLANA_PRIVATE_KEY.');
  }

  const amountLamports = solToLamports(signal.rule.buyAmount);
  if (amountLamports <= 0n) {
    throw new Error('SOL buy amount resolved to zero lamports.');
  }

  const route = await fetchRoute({
    config,
    tokenOutAddress: signal.rule.ca,
    inAmountLamports: amountLamports.toString(),
    fromAddress
  });

  if (config.mode === 'paper-execution') {
    return {
      status: 'paper',
      mode: 'paper-execution',
      adapter: 'gmgn-sol',
      chain: 'sol',
      ca: signal.rule.ca,
      buyAmount: signal.rule.buyAmount,
      route: summarizeRoute(route)
    };
  }

  const signedTx = signSwapTransaction(route.data.raw_tx.swapTransaction, wallet);
  const submitResult = await submitSignedTransaction({
    config,
    signedTx
  });

  const txHash = submitResult?.data?.hash || '';
  const lastValidBlockHeight = Number(route.data.raw_tx.lastValidBlockHeight) || 0;
  const statusResult = await pollTransactionStatus({
    config,
    hash: txHash,
    lastValidBlockHeight
  });

  const status = statusResult.data?.success === true ? 'success' : 'failed';
  return {
    status,
    mode: 'live',
    adapter: 'gmgn-sol',
    chain: 'sol',
    ca: signal.rule.ca,
    buyAmount: signal.rule.buyAmount,
    txHash,
    route: summarizeRoute(route),
    submit: {
      code: submitResult.code,
      msg: submitResult.msg,
      data: submitResult.data || null
    },
    transactionStatus: statusResult.data || null
  };
}

async function fetchRoute({ config, tokenOutAddress, inAmountLamports, fromAddress }) {
  ensureRouteKey(config);

  const url = new URL(`${GMGN_API_HOST}/defi/router/v1/sol/tx/get_swap_route`);
  url.searchParams.set('token_in_address', config.solanaInputTokenAddress);
  url.searchParams.set('token_out_address', tokenOutAddress);
  url.searchParams.set('in_amount', inAmountLamports);
  url.searchParams.set('from_address', fromAddress);
  url.searchParams.set('slippage', String(config.solanaSlippagePercent));
  url.searchParams.set('swap_mode', 'ExactIn');

  if (config.solanaFeeSol > 0) {
    url.searchParams.set('fee', String(config.solanaFeeSol));
  }
  if (config.solanaAntiMev) {
    url.searchParams.set('is_anti_mev', 'true');
  }
  if (config.partner) {
    url.searchParams.set('partner', config.partner);
  }

  const response = await fetchJson(url, {
    method: 'GET',
    headers: {
      'x-route-key': config.gmgnRouteKey
    }
  }, config.requestTimeoutMs);

  if (!response || Number(response.code) !== 0 || !response.data?.raw_tx?.swapTransaction) {
    throw new Error(`GMGN route query failed: ${JSON.stringify(response).slice(0, 500)}`);
  }

  return response;
}

function signSwapTransaction(base64Transaction, wallet) {
  if (!wallet) {
    throw new Error('Wallet is required to sign Solana transaction.');
  }
  const transactionBuffer = Buffer.from(base64Transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuffer);
  transaction.sign([wallet]);
  return Buffer.from(transaction.serialize()).toString('base64');
}

function shouldSignTransaction(mode) {
  return mode === 'live';
}

async function submitSignedTransaction({ config, signedTx }) {
  const response = await fetchJson(`${GMGN_API_HOST}/txproxy/v1/send_transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-route-key': config.gmgnRouteKey
    },
    body: JSON.stringify({
      chain: 'sol',
      signedTx,
      isAntiMev: config.solanaAntiMev
    })
  }, config.requestTimeoutMs);

  if (!response || Number(response.code) !== 0 || !response.data?.hash) {
    throw new Error(`GMGN transaction submit failed: ${JSON.stringify(response).slice(0, 500)}`);
  }

  return response;
}

async function pollTransactionStatus({ config, hash, lastValidBlockHeight }) {
  const startedAt = Date.now();
  let lastResponse = null;

  while ((Date.now() - startedAt) < config.statusPollTimeoutMs) {
    const url = new URL(`${GMGN_API_HOST}/defi/router/v1/sol/tx/get_transaction_status`);
    url.searchParams.set('hash', hash);
    url.searchParams.set('last_valid_height', String(lastValidBlockHeight));

    lastResponse = await fetchJson(url, {
      method: 'GET',
      headers: {
        'x-route-key': config.gmgnRouteKey
      }
    }, config.requestTimeoutMs);

    if (lastResponse?.data?.success === true || lastResponse?.data?.failed === true || lastResponse?.data?.expired === true) {
      return lastResponse;
    }

    await sleep(config.statusPollIntervalMs);
  }

  throw new Error(`GMGN transaction status polling timed out after ${config.statusPollTimeoutMs}ms.`);
}

function ensureRouteKey(config) {
  if (!config.gmgnRouteKey) {
    throw new Error('GMGN_ROUTE_KEY is required for Solana GMGN API execution.');
  }
}

function buildWallet(config) {
  if (!config.solanaPrivateKey) {
    throw new Error('SOLANA_PRIVATE_KEY is required for Solana execution.');
  }

  const secretKey = decodePrivateKey(config.solanaPrivateKey);
  return Keypair.fromSecretKey(secretKey);
}

function decodePrivateKey(privateKey) {
  const trimmed = String(privateKey || '').trim();
  if (!trimmed) {
    throw new Error('Private key is empty.');
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error('SOLANA_PRIVATE_KEY JSON array is invalid.');
    }
    return Uint8Array.from(parsed);
  }

  return bs58.decode(trimmed);
}

function solToLamports(solAmount) {
  const raw = String(solAmount || '').trim();
  if (!raw) return 0n;
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid SOL amount: "${raw}"`);
  }

  const [wholePart, fractionPart = ''] = raw.split('.');
  const normalizedFraction = `${fractionPart}000000000`.slice(0, 9);
  return (BigInt(wholePart) * 1_000_000_000n) + BigInt(normalizedFraction);
}

function summarizeRoute(route) {
  return {
    inputMint: route.data?.quote?.inputMint || '',
    inputAmount: route.data?.quote?.inAmount || '',
    outputMint: route.data?.quote?.outputMint || '',
    outputAmount: route.data?.quote?.outAmount || '',
    slippageBps: route.data?.quote?.slippageBps ?? null,
    priceImpactPct: route.data?.quote?.priceImpactPct ?? '',
    lastValidBlockHeight: route.data?.raw_tx?.lastValidBlockHeight ?? null,
    prioritizationFeeLamports: route.data?.raw_tx?.prioritizationFeeLamports ?? null
  };
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRpcConnection(config) {
  if (!config.solanaRpcUrl) return null;
  return new Connection(config.solanaRpcUrl, 'confirmed');
}
