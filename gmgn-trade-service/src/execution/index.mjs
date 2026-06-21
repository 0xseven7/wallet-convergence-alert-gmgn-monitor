import { executeSignal as executeCoreSignal } from 'trade-pipeline-core';

export async function executeSignal(signal, context) {
  return executeCoreSignal(toTradeSignal(signal), context);
}

export function toTradeSignal(signal) {
  return {
    source: signal.source || 'wallet-convergence-alert-gmgn-monitor',
    signalId: signal.signalId,
    chain: signal.rule.chain,
    ca: signal.rule.ca,
    buyAmount: signal.rule.buyAmount,
    execution: signal.rule.execution || {},
    filters: signal.rule.filters || {},
    conditionOrders: signal.rule.conditionOrders || [],
    sourceMeta: {
      ruleId: signal.rule.id || '',
      twitterId: signal.rule.twitterId || signal.trigger.twitterId || '',
      tweetId: signal.trigger.tweetId || '',
      username: signal.trigger.username || '',
      signalType: signal.signalType || '',
      triggeredAt: signal.triggeredAt,
      forwardedAt: signal.forwardedAt,
      raw: signal
    }
  };
}
