'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'gmgn', 'content.js'), 'utf8');

function extractFunction(name) {
  const marker = `  function ${name}`;
  const fnStart = source.indexOf(marker);
  assert.notEqual(fnStart, -1, `${name} not found`);
  const bodyStart = source.indexOf('{', fnStart);
  assert.notEqual(bodyStart, -1, `${name} body not found`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(fnStart, i + 1);
    }
  }
  assert.fail(`${name} body end not found`);
}

function extractBetween(name, nextName) {
  const startMarker = `  function ${name}`;
  const startIndex = source.indexOf(startMarker);
  const nextMarkers = [`  function ${nextName}`, `  async function ${nextName}`];
  let endIndex = -1;
  for (const marker of nextMarkers) {
    endIndex = source.indexOf(marker, startIndex + startMarker.length);
    if (endIndex !== -1) break;
  }
  assert.notEqual(startIndex, -1, `${name} not found`);
  assert.notEqual(endIndex, -1, `${nextName} not found after ${name}`);
  return source.slice(startIndex, endIndex);
}

const start = source.indexOf('  function normalizeChainName');
const end = source.indexOf('  function getCurrentChainHint');

assert.notEqual(start, -1, 'normalizeChainName not found');
assert.notEqual(end, -1, 'getCurrentChainHint not found');
assert.ok(end > start, 'parser helper block is malformed');

const helperBlock = source.slice(start, end);
const sandbox = {
  URL,
  location: {
    href: 'https://gmgn.ai/follow?chain=sol'
  },
  module: { exports: {} }
};

vm.runInNewContext(`
  const SUPPORTED_GMGN_CHAINS = new Set(['sol', 'eth', 'bsc', 'bnb', 'base', 'tron', 'blast', 'robinhood']);
${helperBlock}
  module.exports = { normalizeChainName, parseGmgnTokenHref, parseDebotTokenHref, buildGmgnTokenPath, buildFomoTokenUrl, buildDebotTokenUrl };
`, sandbox);

const { normalizeChainName, parseGmgnTokenHref, parseDebotTokenHref, buildGmgnTokenPath, buildFomoTokenUrl, buildDebotTokenUrl } = sandbox.module.exports;
const solMint = 'So11111111111111111111111111111111111111112';
const bscAddress = '0x1111111111111111111111111111111111111111';

function parse(href) {
  return JSON.parse(JSON.stringify(parseGmgnTokenHref(href)));
}

assert.deepEqual(parse(`/sol/profile/${solMint}`), {
  href: `/sol/profile/${solMint}`,
  chain: 'sol',
  mint: solMint
});

assert.deepEqual(parse(`https://gmgn.ai/sol/profile/${solMint}`), {
  href: `https://gmgn.ai/sol/profile/${solMint}`,
  chain: 'sol',
  mint: solMint
});

assert.deepEqual(parse(`/sol/token/${solMint}`), {
  href: `/sol/token/${solMint}`,
  chain: 'sol',
  mint: solMint
});

assert.deepEqual(parse(`/token/${solMint}?chain=sol`), {
  href: `/token/${solMint}?chain=sol`,
  chain: 'sol',
  mint: solMint
});

assert.deepEqual(parse(`/bsc/profile/${bscAddress}`), {
  href: `/bsc/profile/${bscAddress}`,
  chain: '',
  mint: ''
});

assert.equal(buildGmgnTokenPath('sol', solMint), `/sol/token/${solMint}`);
assert.equal(buildGmgnTokenPath('bsc', bscAddress), `/bsc/token/${bscAddress}`);
assert.equal(buildGmgnTokenPath('bnb', bscAddress), `/bsc/token/${bscAddress}`);
assert.equal(buildGmgnTokenPath('robinhood', bscAddress), `/robinhood/token/${bscAddress}`);
assert.equal(normalizeChainName('solana'), 'sol');
assert.equal(normalizeChainName('ethereum'), 'eth');
assert.equal(normalizeChainName('Robinhood'), 'robinhood');
assert.equal(normalizeChainName('RH'), 'robinhood');
assert.equal(normalizeChainName('Robinhood Chain'), 'robinhood');

const tradeIdentitySandbox = { module: { exports: {} } };
vm.runInNewContext(`
${extractFunction('normalizeTradeKeyPart')}
${extractFunction('buildStableTradeKey')}
  module.exports = { buildStableTradeKey };
`, tradeIdentitySandbox);
const { buildStableTradeKey } = tradeIdentitySandbox.module.exports;
const repeatedTrade = {
  chain: 'base',
  mint: bscAddress,
  wallet: 'alex',
  walletAddress: '0xb226f97bc5b01978848dc440b40c70faea7c006e',
  action: 'buy',
  amount: '0.536',
  fingerprint: 'buy|0.536TSG'
};
assert.equal(buildStableTradeKey({ ...repeatedTrade, timeMs: 1784291100000 }), buildStableTradeKey({ ...repeatedTrade, timeMs: 1784291160000 }), 'relative scan time must not change trade identity');
assert.notEqual(buildStableTradeKey(repeatedTrade), buildStableTradeKey({ ...repeatedTrade, sourceTradeId: '0xabc1234567890123' }), 'an explicit source transaction id must take precedence');
assert.notEqual(buildStableTradeKey(repeatedTrade), buildStableTradeKey({ ...repeatedTrade, amount: '0.537', fingerprint: 'buy|0.537TSG' }), 'different trade content must remain distinct');

assert.deepEqual(JSON.parse(JSON.stringify(parseDebotTokenHref(`/token/solana/274997_${solMint}`))), {
  href: `/token/solana/274997_${solMint}`,
  chain: 'sol',
  mint: solMint
});

assert.deepEqual(JSON.parse(JSON.stringify(parseDebotTokenHref(`https://debot.ai/token/bsc/${bscAddress}`))), {
  href: `https://debot.ai/token/bsc/${bscAddress}`,
  chain: 'bsc',
  mint: bscAddress
});

assert.equal(buildFomoTokenUrl('sol', solMint), `https://fomo.family/tokens/solana/${solMint}`);
assert.equal(buildFomoTokenUrl('bsc', bscAddress), `https://fomo.family/tokens/bnb/${bscAddress}`);
assert.equal(buildFomoTokenUrl('bnb', bscAddress), `https://fomo.family/tokens/bnb/${bscAddress}`);
assert.equal(buildFomoTokenUrl('base', bscAddress), `https://fomo.family/tokens/base/${bscAddress}`);
assert.equal(buildFomoTokenUrl('eth', bscAddress), `https://fomo.family/tokens/ethereum/${bscAddress}`);
assert.equal(buildFomoTokenUrl('tron', bscAddress), '');

assert.equal(buildDebotTokenUrl('sol', solMint), `https://debot.ai/token/solana/${solMint}`);
assert.equal(buildDebotTokenUrl('bsc', bscAddress), `https://debot.ai/token/bsc/${bscAddress}`);
assert.equal(buildDebotTokenUrl('bnb', bscAddress), `https://debot.ai/token/bsc/${bscAddress}`);
assert.equal(buildDebotTokenUrl('base', bscAddress), `https://debot.ai/token/base/${bscAddress}`);
assert.equal(buildDebotTokenUrl('eth', bscAddress), `https://debot.ai/token/ethereum/${bscAddress}`);
assert.equal(buildDebotTokenUrl('tron', bscAddress), '');

const debotParserSandbox = {
  module: { exports: {} }
};

vm.runInNewContext(`
${extractFunction('normalizeTradeAgeText')}
${extractFunction('stripTrailingTradeAgeText')}
${extractFunction('normalizeTradeAmountText')}
${extractFunction('splitTradeAmountAndToken')}
${extractFunction('splitCompactAmountAndToken')}
${extractFunction('stripLeadingActionMeta')}
${extractFunction('parseDebotDomTradeText')}
  module.exports = { parseDebotDomTradeText };
`, debotParserSandbox);

const { parseDebotDomTradeText } = debotParserSandbox.module.exports;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const textExtractionSandbox = {
  module: { exports: {} }
};

vm.runInNewContext(`
${extractFunction('getElementClassText')}
${extractFunction('isExcludedTradeTextElement')}
${extractFunction('hasExcludedTradeTextAncestor')}
${extractFunction('getTextExcludingSvg')}
${extractFunction('compactDebugText')}
  module.exports = { compactDebugText };
`, textExtractionSandbox);

const { compactDebugText: compactTextWithoutSvg } = textExtractionSandbox.module.exports;
const textNode = (text) => ({ nodeType: 3, nodeName: '#text', textContent: text, childNodes: [] });
const elementNode = (tagName, childNodes = [], attrs = {}) => ({
  nodeType: 1,
  tagName,
  nodeName: tagName,
  childNodes,
  textContent: childNodes.map((child) => child.textContent || '').join(''),
  hidden: Boolean(attrs.hidden),
  className: attrs.className || '',
  getAttribute: (name) => attrs[name] || ''
});

assert.equal(compactTextWithoutSvg(elementNode('div', [
  elementNode('svg', [elementNode('title', [textNode('te')])]),
  textNode(' test')
])), 'test');

assert.equal(compactTextWithoutSvg(elementNode('div', [
  textNode('$0.082 '),
  elementNode('svg', [textNode('te')]),
  textNode(' test 1m MC:$1K')
])), '$0.082 test 1m MC:$1K');

assert.equal(compactTextWithoutSvg(elementNode('div', [
  elementNode('span', [textNode('te')], { 'aria-hidden': 'true' }),
  textNode(' test')
])), 'test');

assert.equal(compactTextWithoutSvg(elementNode('div', [
  elementNode('span', [textNode('te')], { role: 'img' }),
  textNode(' test')
])), 'test');

assert.equal(compactTextWithoutSvg(elementNode('div', [
  elementNode('span', [textNode('te')], { className: 'token-icon' }),
  textNode(' test')
])), 'test');

const tokenCleanSandbox = {
  module: { exports: {} }
};

vm.runInNewContext(`
${extractFunction('stripDuplicateShortTokenPrefix')}
${extractFunction('stripInlineSvgPrefixTokenText')}
  module.exports = { stripInlineSvgPrefixTokenText };
`, tokenCleanSandbox);

const { stripInlineSvgPrefixTokenText } = tokenCleanSandbox.module.exports;

assert.equal(stripInlineSvgPrefixTokenText('te test', null), 'test');
assert.equal(stripInlineSvgPrefixTokenText('TE test', null), 'test');
assert.equal(stripInlineSvgPrefixTokenText('99 9999', null), '99 9999');

assert.deepEqual(plain(parseDebotDomTradeText('Gibmemes100x加仓1m0.3249Binface45m市值$3.11K买 0')), {
  wallet: 'Gibmemes100x',
  action: '加仓',
  amount: '0.3249',
  tokenSymbol: 'Binface',
  timeAgo: '1m',
  tradeAge: '45m',
  mcap: '$3.11K'
});

assert.deepEqual(plain(parseDebotDomTradeText('Emroonz加仓0.245MLM13m市值$335K买 0')), {
  wallet: 'Emroonz',
  action: '加仓',
  amount: '0.245',
  tokenSymbol: 'MLM',
  timeAgo: '',
  tradeAge: '13m',
  mcap: '$335K'
});

const duplicateImproveSandbox = {
  module: { exports: {} }
};

vm.runInNewContext(`
  let buyRecords = [{
    stableKey: 'sol|mint|wallet|action|time',
    token: 'I24Y...pump',
    wallet: '7kkQ...i7i3',
    amount: '',
    mcap: '',
    chain: 'sol',
    mint: 'mint'
  }];
  let sellRecords = [];
  let closedRecords = [];
${extractFunction('looksLikeAddressLabel')}
${extractFunction('looksLikeTokenFallbackLabel')}
${extractFunction('improveDuplicateTradeRecord')}
  improveDuplicateTradeRecord({
    stableKey: 'sol|mint|wallet|action|time',
    token: 'MLM',
    wallet: 'Emroonz',
    amount: '0.245',
    mcap: '$335K',
    chain: 'sol',
    mint: 'mint',
    href: 'https://debot.ai/token/solana/mint',
    platform: { tag: 'P', cls: 'gcp-plat-pump', label: 'Pump.fun' }
  });
  module.exports = buyRecords[0];
`, duplicateImproveSandbox);

assert.deepEqual(plain(duplicateImproveSandbox.module.exports), {
  stableKey: 'sol|mint|wallet|action|time',
  token: 'MLM',
  wallet: 'Emroonz',
  amount: '0.245',
  mcap: '$335K',
  chain: 'sol',
  mint: 'mint',
  href: 'https://debot.ai/token/solana/mint',
  platform: { tag: 'P', cls: 'gcp-plat-pump', label: 'Pump.fun' }
});

const signalEventSandbox = {
  URL,
  location: {
    origin: 'https://gmgn.ai',
    href: 'https://gmgn.ai/follow?chain=bsc',
    pathname: '/follow',
    hostname: 'gmgn.ai'
  },
  module: { exports: {} }
};

vm.runInNewContext(`
  const SUPPORTED_GMGN_CHAINS = new Set(['sol', 'eth', 'bsc', 'bnb', 'base', 'tron', 'blast', 'robinhood']);
  const config = { minWallets: 2 };
  function getSpeechWatchAlias(name) { return name === '西瓜' ? '西瓜哥' : ''; }
  function isDebotMonitorWindowPage() { return false; }
  function shortAddress(value) { return String(value || '').slice(0, 4); }
  function getFocusWalletMatch() { return null; }
${helperBlock}
${extractFunction('normalizeTradeKeyPart')}
${extractFunction('buildAlertGroupKey')}
${extractFunction('getAlertGroupKey')}
${extractFunction('getWatchedTradeQuoteAsset')}
${extractFunction('normalizeTradeEventAction')}
${extractFunction('getTradeEventActionLabel')}
${extractFunction('normalizeSignalEventMcap')}
${extractFunction('buildSignalEventUrl')}
${extractFunction('buildSignalWalletPayload')}
${extractFunction('getSignalEventSource')}
${extractBetween('buildWalletTradeEventText', 'buildWalletTradeSignalEvent')}
${extractBetween('buildWalletTradeSignalEvent', 'buildConvergenceAlertSignalEvent')}
${extractBetween('buildConvergenceAlertSignalEvent', 'dispatchSignalEvent')}
  module.exports = { normalizeTradeEventAction, buildWalletTradeSignalEvent, buildConvergenceAlertSignalEvent };
`, signalEventSandbox);

const { normalizeTradeEventAction, buildWalletTradeSignalEvent, buildConvergenceAlertSignalEvent } = signalEventSandbox.module.exports;

assert.equal(normalizeTradeEventAction('建仓'), 'open');
assert.equal(normalizeTradeEventAction('加仓'), 'add');
assert.equal(normalizeTradeEventAction('买入'), 'buy');
assert.equal(normalizeTradeEventAction('减仓'), 'reduce');
assert.equal(normalizeTradeEventAction('卖出'), 'sell');
assert.equal(normalizeTradeEventAction('清仓'), 'close');

assert.deepEqual(plain(buildWalletTradeSignalEvent({
  wallet: '西瓜',
  action: '买入',
  token: 'PEPE',
  mint: bscAddress,
  chain: 'bsc',
  amount: '1',
  mcap: '$120K',
  timeMs: 1780000000000,
  href: `/bsc/token/${bscAddress}`,
  stableKey: 'trade-stable-key'
})), {
  schemaVersion: 2,
  tradeId: 'trade-stable-key',
  identityConfidence: 'heuristic',
  source: 'gmgn',
  type: 'wallet_trade',
  ts: 1780000000000,
  chain: 'bsc',
  ca: bscAddress,
  symbol: 'PEPE',
  token_name: 'PEPE',
  wallet: {
    name: '西瓜',
    address: '',
    remark: '西瓜哥'
  },
  action: 'buy',
  amount: '1',
  amount_unit: 'BNB',
  mcap: '120K',
  text: '西瓜哥 买入 1 BNB PEPE',
  url: `https://gmgn.ai/bsc/token/${bscAddress}`,
  raw: {
    from: 'gmgn-extension',
    stable_key: 'trade-stable-key',
    trade_id: 'trade-stable-key',
    identity_confidence: 'heuristic',
    inferred_time: false,
    original_action: '买入'
  }
});

assert.deepEqual(plain(buildConvergenceAlertSignalEvent({
  token: 'PEPE',
  mint: bscAddress,
  chain: 'bsc',
  walletCount: 5,
  effectiveCount: 5,
  closedCount: 0,
  wallets: [{ name: '西瓜' }, { name: '土豆' }, { name: '香蕉' }],
  mcap: '$120K',
  latestTradeTimeMs: 1780000000000
}, {
  requiredWallets: 2,
  hasPriorityWallet: false
})), {
  schemaVersion: 2,
  source: 'gmgn',
  type: 'convergence_alert',
  ts: 1780000000000,
  chain: 'bsc',
  ca: bscAddress,
  symbol: 'PEPE',
  image: '',
  action: 'alert',
  mcap: '120K',
  text: 'PEPE 5 个关注钱包聚合买入',
  url: `https://gmgn.ai/bsc/token/${bscAddress}`,
  raw: {
    buy_wallet_count: 5,
    sell_wallet_count: 0,
    closed_wallet_count: 0,
    wallet_count: 5,
    threshold: 2,
    priority_wallet_hit: false,
    focus_wallet_hit: false,
    focus_wallets: [],
    group_key: `bsc|${bscAddress}`,
    record_kind: 'aggregate_snapshot',
    wallets: [
      { name: '西瓜', address: '', amount: '', timeAgo: '', timeMs: 0, avatar: '', closed: false, closedAt: 0 },
      { name: '土豆', address: '', amount: '', timeAgo: '', timeMs: 0, avatar: '', closed: false, closedAt: 0 },
      { name: '香蕉', address: '', amount: '', timeAgo: '', timeMs: 0, avatar: '', closed: false, closedAt: 0 }
    ]
  }
});

const watchedSpeechSandbox = {
  module: { exports: {} }
};

vm.runInNewContext(`
  const SUPPORTED_GMGN_CHAINS = new Set(['sol', 'eth', 'bsc', 'bnb', 'base', 'tron', 'blast', 'robinhood']);
  function getSpeechWatchAlias(name) { return name === '西瓜' ? '西瓜哥' : ''; }
${helperBlock}
${extractFunction('sanitizeSpeechName')}
${extractFunction('normalizeWatchedTradeVerb')}
${extractFunction('getWatchedTradeQuoteAsset')}
${extractFunction('normalizeSignalEventMcap')}
${extractFunction('isCurrencyAmountText')}
${extractFunction('buildWatchedTradeSpeechText')}
  module.exports = { buildWatchedTradeSpeechText };
`, watchedSpeechSandbox);

const { buildWatchedTradeSpeechText } = watchedSpeechSandbox.module.exports;

assert.equal(buildWatchedTradeSpeechText({
  wallet: '西瓜',
  action: '买入',
  token: 'PEPE',
  chain: 'bsc',
  amount: '1',
  mcap: '$120K'
}), '西瓜哥，买入了 1 BNB PEPE，市值 120K');

assert.equal(buildWatchedTradeSpeechText({
  wallet: '西瓜',
  action: '买入',
  token: 'PEPE',
  chain: 'bsc',
  amount: '1',
  mcap: ''
}), '西瓜哥，买入了 1 BNB PEPE');

console.log('gmgn-content-url-parser tests passed');
