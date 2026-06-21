# GMGN Trade Service

`gmgn-trade-service` 是给 `wallet-convergence-alert-gmgn-monitor` 配套的外部执行服务。

当前定位：

- 浏览器扩展继续作为 **GMGN Twitter 信号源**
- 本服务接收扩展 webhook
- 服务端做鉴权、去重、风控、日志
- 支持 `dry-run / paper-execution / live`
- `live` 模式当前主线是 **BSC 自动买入**
- 买入执行使用 **GMGN Agent/CLI**，不是自己拿 RPC 广播交易
- 自动卖出不在服务里写交易逻辑，使用 GMGN 的 `condition-orders` / 挂单能力

## 执行方式

BSC 买入通过本服务调用本地安装的 `gmgn-cli`：

```bash
gmgn-cli swap \
  --chain bsc \
  --from <GMGN_FROM_ADDRESS> \
  --input-token 0x0000000000000000000000000000000000000000 \
  --output-token <CA> \
  --amount <BNB_WEI> \
  --auto-slippage \
  --raw
```

如果每条 Twitter profile 配置了 `conditionOrders`，服务会把它追加到 `swap` 命令里，让 GMGN 在买入成功后创建止盈/止损策略单。

## 上游契约

扩展发来的 webhook：

- Method: `POST`
- Path: `/webhook/twitter-trigger`
- Headers:
  - `x-gmgn-hook-secret`
  - `x-gmgn-hook-source`
  - `x-gmgn-hook-event`

## 本地启动

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\gmgn-trade-service
Copy-Item .env.example .env
npm install
npm start
```

健康检查：

```text
GET http://127.0.0.1:8787/health
```

返回示例：

```json
{
  "ok": true,
  "service": "gmgn-trade-service",
  "mode": "dry-run",
  "dryRun": true,
  "uptimeMs": 1024,
  "executionChains": ["bsc"]
}
```

## Docker

```bash
docker compose up -d --build
```

容器会把 `./data` 挂载到 `/app/data`。

## 关键配置

通用：

- `HOST`
- `PORT`
- `HOOK_SECRET`
- `MODE`
- `DATA_DIR`
- `SIGNAL_TTL_MS`
- `GLOBAL_COOLDOWN_MS`
- `RULE_COOLDOWN_MS`
- `TWITTER_COOLDOWN_MS`
- `REQUEST_TIMEOUT_MS`
- `GMGN_API_COOLDOWN_MS`
- `EXECUTION_CHAINS`
- `ALLOW_RULE_IDS`
- `ALLOW_TWITTER_IDS`

BSC / GMGN CLI：

- `GMGN_API_KEY`
- `GMGN_PRIVATE_KEY`
- `GMGN_FROM_ADDRESS`
- `GMGN_CLI_COMMAND`
- `MAX_BUY_AMOUNT_BNB`
- `BSC_INPUT_TOKEN_ADDRESS`
- `BSC_SELL_RATIO_TYPE`

默认值：

- `EXECUTION_CHAINS=bsc`
- `BSC_INPUT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000`
- `BSC_SELL_RATIO_TYPE=buy_amount`

`GMGN_PRIVATE_KEY` 是 GMGN Agent/CLI 使用的签名 key。不要提交到 Git，也不要写进日志。

推特交易页创建的新策略应该在每条 Twitter profile 的 `execution` 里配置买入执行参数，包括滑点、Gas、Tip 和防夹开关。

## 模式

`dry-run`

- 记录 signal
- 记录 execution
- 不调用 `gmgn-cli`

`paper-execution`

- 调用 `gmgn-cli order quote`
- 不提交真实买入

`live`

- 调用 `gmgn-cli swap`
- 由 GMGN CLI/Agent 执行 BSC 买入

## GMGN 挂单

卖出策略通过每条 Twitter profile 的 `conditionOrders` 配置。

示例：上涨 `100%` 时卖出 `50%`：

```json
[{"order_type":"profit_stop","side":"sell","price_scale":"100","sell_ratio":"50"}]
```

服务会把它传给：

```bash
gmgn-cli swap ... --condition-orders '<json>' --sell-ratio-type buy_amount
```

BSC 携带 `condition-orders` 时，`gmgn-cli` 要求传 `--gas-price`，所以每条 Twitter profile 里需要配置 `execution.gasPriceGwei`。

## 风控

服务端会检查：

- `HOOK_SECRET`
- `signalId` 去重
- `chain` 白名单
- `ruleId` 白名单
- `twitterId` 白名单
- `MAX_BUY_AMOUNT_BNB`
- 全局冷却
- GMGN API 冷却
- 规则冷却
- 账号冷却

## 日志

默认写入 `data/`：

- `signals.jsonl`
- `executions.jsonl`
- `errors.jsonl`

## curl 测试

```bash
curl -X POST "http://127.0.0.1:8787/webhook/twitter-trigger" \
  -H "Content-Type: application/json" \
  -H "x-gmgn-hook-secret: change-me" \
  -d '{
    "source": "wallet-convergence-alert-gmgn-monitor",
    "signalType": "gmgn_twitter_trigger",
    "signalId": "demo-rule|cz_binance|reply|tweet-1|pc",
    "triggeredAt": 1710000000000,
    "rule": {
      "id": "demo-rule",
      "twitterId": "cz_binance",
      "eventType": "reply",
      "keywords": ["pc"],
      "chain": "bsc",
      "ca": "0x111111111117dc0aa78b770fa6a738034120c302",
      "tokenSymbol": "DEMO",
      "buyAmount": "0.1",
      "note": ""
    },
    "trigger": {
      "twitterId": "cz_binance",
      "username": "cz_binance",
      "userId": "1",
      "name": "CZ",
      "remark": "CZ",
      "eventType": "reply",
      "rawEventType": "reply",
      "tweetId": "tweet-1",
      "text": "pc",
      "url": "https://x.com/example/status/1",
      "ts": 1710000000000
    },
    "matchedKeywords": ["pc"],
    "page": {
      "url": "https://gmgn.ai/follow",
      "title": "GMGN"
    }
  }'
```

## 已知限制

- 当前真实执行主线只做 `bsc` 买入
- `eth / base` 只记录或转发，不直接执行
- `sol` 执行器仍保留，但不是默认主线
- 幂等去重当前是内存级，服务重启后不会保留历史
- 真正 `live` 需要你提供有效 `GMGN_API_KEY`、`GMGN_PRIVATE_KEY`、`GMGN_FROM_ADDRESS`

## 参考

- [GMGN Agent API](https://docs.gmgn.ai/index/gmgn-agent-api)
- [GMGNAI/gmgn-skills](https://github.com/GMGNAI/gmgn-skills)
- [gmgn-cli usage](https://github.com/GMGNAI/gmgn-skills/blob/main/docs/cli-usage.md)
