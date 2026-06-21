# Twitter Trade Profiles

The browser extension stores per-twitter trade profiles in Chrome local storage under:

```text
gmgnTwitterTradeProfiles
```

Each profile can extract CA values from the tweet text and send a signal to:

```text
POST /webhook/twitter-trigger
```

Example profile payload:

```json
{
  "id": "twitter-trade-cz",
  "enabled": true,
  "twitterId": "cz_binance",
  "eventTypes": ["tweet", "reply"],
  "keywords": ["电脑"],
  "excludeKeywords": [],
  "chain": "bsc",
  "mode": "tweet-ca",
  "buyAmount": "0.3",
  "filters": {
    "marketCapMinUsd": "10000",
    "marketCapMaxUsd": "20000",
    "maxTokenAgeSeconds": "120"
  },
  "execution": {
    "autoSlippage": true,
    "slippage": "",
    "gasPriceGwei": "10",
    "tipFeeBnb": "",
    "antiMev": true
  },
  "conditionOrders": [
    {
      "order_type": "profit_stop",
      "side": "sell",
      "price_scale": "30",
      "sell_ratio": "50"
    }
  ],
  "note": "CZ strategy"
}
```

The service receives these values inside `rule.filters`, `rule.execution`, and `rule.conditionOrders`.

For BSC:

- token filters are checked with `gmgn-cli token info --chain bsc --address <CA> --raw`
- `rule.execution` controls slippage, gas, tip, and anti-MEV for this profile
- `rule.conditionOrders` controls GMGN condition orders for this profile
- condition orders require `rule.execution.gasPriceGwei`
- if `ALLOW_RULE_IDS` is configured, include each profile `id`
