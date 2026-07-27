# Market Watch Focus Buys Relay 对接文档

## 目标

巨额买入 / 特别关注钱包买入不再要求 Market Watch 实时在线。

监控扩展会先把 Focus Buys 写入 relay，Market Watch 启动后从 relay 消费并 ack。这样 Market Watch 没启动时，事件会暂存在 relay，不会直接丢失。

## Relay 地址

当前 Mac mini relay：

```text
http://192.168.3.129:17390
```

WebSocket 地址：

```text
ws://192.168.3.129:17390/ws?role=market-watch&client=market-watch&target=market-watch
```

## 推荐接入方式

Market Watch 启动后做两件事：

1. 先拉取未消费的 Focus Buys，补离线期间的数据。
2. 再连接 WebSocket，实时接收新的 Focus Buys。

如果先做简单版，也可以只做轮询：

```text
每 3-5 秒 GET /focus-buys?limit=50
写入 Market Watch
写入成功后 POST /focus-buys/ack
```

## 拉取未消费 Focus Buys

```http
GET http://192.168.3.129:17390/focus-buys?limit=50
```

返回示例：

```json
{
  "ok": true,
  "events": [
    {
      "id": 7,
      "type": "focus-buy",
      "target": "market-watch",
      "source": "gmgn-monitor-extension",
      "payload": {
        "traderName": "wallet-alias",
        "traderAddress": "0x...",
        "tokenName": "Token Name",
        "symbol": "TOKEN",
        "chainId": "56",
        "contractAddress": "0x...",
        "amountUsd": 1234,
        "marketCap": 567890,
        "source": "gmgn-plugin",
        "txUrl": "https://gmgn.ai/...",
        "note": "focus wallet note",
        "boughtAt": "2026-07-03T00:00:00.000Z"
      },
      "createdAt": "2026-07-03T00:00:01.000Z",
      "acknowledgedAt": null,
      "acknowledgedBy": null
    }
  ],
  "items": [
    {
      "id": 7,
      "createdAt": "2026-07-03T00:00:01.000Z",
      "payload": {
        "traderName": "wallet-alias",
        "symbol": "TOKEN",
        "chainId": "56",
        "contractAddress": "0x..."
      }
    }
  ]
}
```

Market Watch 可以优先使用 `events`，因为里面有 relay event `id` 和完整 ack 状态。

## 写入成功后 ACK

Market Watch 只有在本地写入成功后才 ack。

```http
POST http://192.168.3.129:17390/focus-buys/ack
Content-Type: application/json

{
  "ids": [7],
  "client": "market-watch"
}
```

返回示例：

```json
{
  "ok": true,
  "acknowledged": 1,
  "ids": [7]
}
```

ack 后，该事件不会再出现在：

```http
GET /focus-buys
```

但仍可通过排查接口看到历史：

```http
GET http://192.168.3.129:17390/events/recent?limit=20
```

## WebSocket 实时接收

连接：

```text
ws://192.168.3.129:17390/ws?role=market-watch&client=market-watch&target=market-watch
```

连接成功后 relay 会发 `hello`：

```json
{
  "type": "hello",
  "ok": true,
  "client": {
    "role": "market-watch",
    "client": "market-watch"
  },
  "pendingEvents": []
}
```

新事件推送：

```json
{
  "type": "event",
  "event": {
    "id": 7,
    "type": "focus-buy",
    "target": "market-watch",
    "source": "gmgn-monitor-extension",
    "payload": {
      "traderName": "wallet-alias",
      "traderAddress": "0x...",
      "symbol": "TOKEN",
      "chainId": "56",
      "contractAddress": "0x...",
      "amountUsd": 1234,
      "boughtAt": "2026-07-03T00:00:00.000Z"
    }
  }
}
```

WebSocket ack：

```json
{
  "type": "ack",
  "ids": [7],
  "client": "market-watch"
}
```

ack 返回：

```json
{
  "type": "ack",
  "ok": true,
  "ids": [7],
  "acknowledged": 1
}
```

## 建议处理流程

启动时：

```text
1. GET /focus-buys?limit=50
2. 逐条写入 Market Watch
3. 写入成功的 id 批量 POST /focus-buys/ack
4. 连接 WebSocket /ws
```

WebSocket 运行时：

```text
1. 收到 type=event,type=focus-buy
2. 写入 Market Watch
3. 写入成功后 WebSocket ack
```

WebSocket 断线重连后：

```text
1. 重新连接 /ws
2. 再 GET /focus-buys?limit=50 补漏
3. 写入成功后 ack
```

## 去重建议

优先用 relay event id 做消费去重：

```text
relay_event_id
```

如果 Market Watch 需要业务去重，可以额外使用：

```text
contractAddress + traderAddress + boughtAt
```

或者：

```text
chainId + contractAddress + traderAddress + boughtAt
```

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `id` | relay event id，用于 ack 和消费去重 |
| `type` | 固定为 `focus-buy` |
| `target` | 固定为 `market-watch` |
| `payload.traderName` | 钱包备注或别名 |
| `payload.traderAddress` | 钱包地址 |
| `payload.tokenName` | 代币名称 |
| `payload.symbol` | 代币符号 |
| `payload.chainId` | 链 id，例如 BSC 为 `56`，Solana 为 `CT_501` |
| `payload.contractAddress` | 合约地址 / CA |
| `payload.amountUsd` | 买入金额，单位 USD |
| `payload.marketCap` | 触发时市值 |
| `payload.source` | 来源，例如 `gmgn-plugin` |
| `payload.txUrl` | 来源页面或交易链接 |
| `payload.note` | 备注 |
| `payload.boughtAt` | 买入时间，ISO 字符串 |

## 验证命令

检查 relay：

```powershell
Invoke-RestMethod http://192.168.3.129:17390/health
```

查看待消费 Focus Buys：

```powershell
Invoke-RestMethod http://192.168.3.129:17390/focus-buys?limit=50
```

查看最近历史：

```powershell
Invoke-RestMethod http://192.168.3.129:17390/events/recent?limit=20
```

运行 relay smoke：

```powershell
$env:GMGN_RELAY_BASE_URL='http://192.168.3.129:17390'
npm --prefix relay run smoke
```

成功时应看到：

```text
focusBuyEventId: <number>
focusBuyAck: 1
pendingEvents: 0
```
