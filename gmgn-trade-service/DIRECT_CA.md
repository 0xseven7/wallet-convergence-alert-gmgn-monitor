# Direct CA Mode

The browser extension can send two signal styles to `POST /webhook/twitter-trigger`.

- Fixed rule: `twitterId + eventType + keywords -> fixed CA`
- Direct CA: extract the CA directly from tweet text and send it to the service

Direct CA is configured in the extension settings under `GMGN 外部 Hook`.

For BSC, the extension extracts `0x` addresses from the tweet text and sends a synthetic rule:

```json
{
  "id": "direct-ca-bsc",
  "chain": "bsc",
  "ca": "0x...",
  "buyAmount": "0.3",
  "note": "direct-ca-from-tweet"
}
```

If the service uses `ALLOW_RULE_IDS`, include:

```env
ALLOW_RULE_IDS=direct-ca-bsc
```

If the service uses `ALLOW_TWITTER_IDS`, the tweet author must also be included there.

The service-side `MODE`, `HOOK_SECRET`, `EXECUTION_CHAINS`, cooldowns, and amount limits still apply.
