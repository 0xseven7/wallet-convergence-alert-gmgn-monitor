import { normalizeTwitterId } from './normalize-signal.mjs';

export function createRiskGuard(config) {
  let globalLastAcceptedAt = 0;
  let gmgnApiLastAcceptedAt = 0;
  const ruleAcceptedAt = new Map();
  const twitterAcceptedAt = new Map();

  return {
    evaluate(signal, now = Date.now()) {
      const chain = signal.rule.chain;
      const twitterId = normalizeTwitterId(signal.rule.twitterId || signal.trigger.twitterId);
      const ruleId = signal.rule.id || '';

      if (!chain) return reject('missing-chain', 'Rule chain is empty.');
      if (!signal.rule.buyAmount) return reject('missing-buy-amount', 'Rule buyAmount is empty.');

      const numericAmount = Number(signal.rule.buyAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return reject('invalid-buy-amount', 'Rule buyAmount must be a positive number.');
      }

      if (config.executionChains.length > 0 && !config.executionChains.includes(chain)) {
        return reject('chain-disabled', `Chain "${chain}" is not enabled for execution.`);
      }

      if (config.allowRuleIds.length > 0 && (!ruleId || !config.allowRuleIds.includes(ruleId))) {
        return reject('rule-not-allowed', `Rule "${ruleId || '(empty)'}" is not allowed.`);
      }

      if (config.allowTwitterIds.length > 0 && (!twitterId || !config.allowTwitterIds.includes(twitterId))) {
        return reject('twitter-not-allowed', `Twitter ID "${twitterId || '(empty)'}" is not allowed.`);
      }

      if (chain === 'sol') {
        const maxAmount = Number(config.maxBuyAmountSol);
        if (Number.isFinite(maxAmount) && maxAmount > 0 && numericAmount > maxAmount) {
          return reject('buy-amount-too-large', `Buy amount ${numericAmount} exceeds maxBuyAmountSol ${config.maxBuyAmountSol}.`);
        }
      }

      if (chain === 'bsc') {
        const maxAmount = Number(config.maxBuyAmountBnb);
        if (Number.isFinite(maxAmount) && maxAmount > 0 && numericAmount > maxAmount) {
          return reject('buy-amount-too-large', `Buy amount ${numericAmount} exceeds maxBuyAmountBnb ${config.maxBuyAmountBnb}.`);
        }
      }

      if (config.globalCooldownMs > 0 && globalLastAcceptedAt > 0 && (now - globalLastAcceptedAt) < config.globalCooldownMs) {
        return reject('global-cooldown', `Global cooldown active for ${config.globalCooldownMs - (now - globalLastAcceptedAt)}ms.`);
      }

      if (shouldApplyGmgnApiCooldown(config, chain) && gmgnApiLastAcceptedAt > 0 && (now - gmgnApiLastAcceptedAt) < config.gmgnApiCooldownMs) {
        return reject('gmgn-api-cooldown', `GMGN API cooldown active for ${config.gmgnApiCooldownMs - (now - gmgnApiLastAcceptedAt)}ms.`);
      }

      if (config.ruleCooldownMs > 0 && ruleId) {
        const lastRuleAt = ruleAcceptedAt.get(ruleId) || 0;
        if (lastRuleAt > 0 && (now - lastRuleAt) < config.ruleCooldownMs) {
          return reject('rule-cooldown', `Rule cooldown active for ${config.ruleCooldownMs - (now - lastRuleAt)}ms.`);
        }
      }

      if (config.twitterCooldownMs > 0 && twitterId) {
        const lastTwitterAt = twitterAcceptedAt.get(twitterId) || 0;
        if (lastTwitterAt > 0 && (now - lastTwitterAt) < config.twitterCooldownMs) {
          return reject('twitter-cooldown', `Twitter cooldown active for ${config.twitterCooldownMs - (now - lastTwitterAt)}ms.`);
        }
      }

      return {
        ok: true,
        code: 'allowed',
        reason: '',
        numericAmount
      };
    },

    reserve(signal, now = Date.now()) {
      globalLastAcceptedAt = now;
      if (shouldApplyGmgnApiCooldown(config, signal.rule.chain)) {
        gmgnApiLastAcceptedAt = now;
      }
      if (signal.rule.id) {
        ruleAcceptedAt.set(signal.rule.id, now);
      }
      const twitterId = normalizeTwitterId(signal.rule.twitterId || signal.trigger.twitterId);
      if (twitterId) {
        twitterAcceptedAt.set(twitterId, now);
      }
    }
  };
}

function shouldApplyGmgnApiCooldown(config, chain) {
  return config.mode !== 'dry-run'
    && (chain === 'sol' || chain === 'bsc')
    && config.gmgnApiCooldownMs > 0
    && (chain === 'bsc' ? !!config.gmgnApiKey : !!config.gmgnRouteKey);
}

function reject(code, reason) {
  return {
    ok: false,
    code,
    reason
  };
}
