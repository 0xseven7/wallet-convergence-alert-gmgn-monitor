export function normalizeSignal(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const rule = payload.rule || {};
  const trigger = payload.trigger || {};
  const signalId = normalizeString(payload.signalId);
  const ca = normalizeString(rule.ca);
  const twitterId = normalizeTwitterId(rule.twitterId || trigger.twitterId);

  if (!signalId || !ca || !twitterId) return null;

  return {
    signalId,
    source: normalizeString(payload.source) || 'wallet-convergence-alert-gmgn-monitor',
    signalType: normalizeString(payload.signalType) || 'gmgn_twitter_trigger',
    triggeredAt: normalizeTimestamp(payload.triggeredAt),
    forwardedAt: normalizeTimestamp(payload.forwardedAt),
    matchedKeywords: Array.isArray(payload.matchedKeywords)
      ? payload.matchedKeywords.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    rule: {
      id: normalizeString(rule.id),
      twitterId,
      eventType: normalizeString(rule.eventType || 'any').toLowerCase() || 'any',
      keywords: Array.isArray(rule.keywords)
        ? rule.keywords.map((item) => normalizeString(item)).filter(Boolean)
        : [],
      chain: normalizeString(rule.chain).toLowerCase(),
      ca,
      tokenSymbol: normalizeString(rule.tokenSymbol),
      buyAmount: normalizeString(rule.buyAmount),
      note: normalizeString(rule.note),
      filters: normalizeFilters(rule.filters),
      execution: normalizeExecution(rule.execution),
      conditionOrders: normalizeConditionOrders(rule.conditionOrders),
      profileId: normalizeString(rule.profileId)
    },
    trigger: {
      twitterId: normalizeTwitterId(trigger.twitterId || twitterId),
      username: normalizeTwitterId(trigger.username),
      userId: normalizeString(trigger.userId),
      name: normalizeString(trigger.name),
      remark: normalizeString(trigger.remark),
      eventType: normalizeString(trigger.eventType).toLowerCase(),
      rawEventType: normalizeString(trigger.rawEventType),
      tweetId: normalizeString(trigger.tweetId),
      text: normalizeString(trigger.text),
      url: normalizeString(trigger.url),
      ts: normalizeTimestamp(trigger.ts)
    },
    page: payload.page && typeof payload.page === 'object'
      ? {
          url: normalizeString(payload.page.url),
          title: normalizeString(payload.page.title)
        }
      : {}
  };
}

function normalizeFilters(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    marketCapMinUsd: normalizeOptionalNumber(raw.marketCapMinUsd),
    marketCapMaxUsd: normalizeOptionalNumber(raw.marketCapMaxUsd),
    maxTokenAgeSeconds: normalizeOptionalNumber(raw.maxTokenAgeSeconds)
  };
}

function normalizeExecution(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    autoSlippage: raw.autoSlippage !== false,
    slippage: normalizeOptionalNumber(raw.slippage),
    gasPriceGwei: normalizeOptionalNumber(raw.gasPriceGwei),
    tipFeeBnb: normalizeOptionalNumber(raw.tipFeeBnb),
    antiMev: raw.antiMev === true
  };
}

function normalizeConditionOrders(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((order) => ({
      order_type: normalizeString(order?.order_type || 'profit_stop'),
      side: normalizeString(order?.side || 'sell'),
      price_scale: normalizeString(order?.price_scale),
      sell_ratio: normalizeString(order?.sell_ratio)
    }))
    .filter((order) => order.price_scale && order.sell_ratio);
}

function normalizeOptionalNumber(value) {
  const raw = normalizeString(value);
  if (!raw) return '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

export function normalizeTwitterId(value) {
  return normalizeString(value).toLowerCase().replace(/^@/, '');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}
