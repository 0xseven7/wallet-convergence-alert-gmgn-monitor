# 本地信号记忆面板需求文档

## 1. 背景

当前已有多个高价值实时信号源：

- GMGN 聚合买入提醒：关注钱包买入、卖出、建仓、清仓，以及同一代币的多钱包聚合。
- Telegram 重点消息：群内有人提到某个币、CA、叙事或买点。
- 后续可能接入 Debot、Twitter、自动交易服务等更多信号源。

这些信号现在主要通过语音、弹窗或浏览器页面瞬时展示。问题是信息有效期很短，用户通常只能记住 1 到 3 分钟，后续复盘或二次判断时容易遗漏。

目标是新增一个本地网页面板，把实时信号沉淀成可回看的本地事件流。

## 2. 产品目标

第一版要解决两个核心问题：

1. 记录我关注的钱包买了什么币。
2. 记录 TG 的重点消息说了什么币。

进一步目标：

- 把同一个币的不同来源信号聚合到一条时间线里。
- 能按 CA、symbol、钱包、TG 群、来源、时间窗口快速回看。
- 保留原始数据，避免解析错误后无法追溯。
- 作为后续 Debot、Twitter、自动买入服务的统一事件入口。

## 3. 非目标

第一版不做以下内容：

- 不做自动买入或自动卖出。
- 不做云端同步。
- 不做多人账户系统。
- 不做复杂 AI 总结。
- 不替代 GMGN/TG 原始页面，只做本地信号记忆层。
- 不要求所有 TG 消息都精准识别 CA；无法确认 CA 的消息先作为候选信号保存。

## 4. 推荐架构

推荐做一个独立本地服务，运行在本机或局域网机器上。

```text
GMGN Chrome 插件
  -> POST /api/events
  -> SQLite
  -> 本地网页面板

TG 抓取器
  -> POST /api/events
  -> SQLite
  -> 本地网页面板

后续 Debot / Twitter / trade service
  -> POST /api/events
  -> 同一套 SQLite 和网页面板
```

推荐技术栈：

- 后端：Node.js + Fastify 或 Express。
- 存储：SQLite。
- 前端：Vite + React。
- 部署：本地直接运行，后续可 Docker 化。

不建议第一版把数据长期塞进 Chrome extension storage。原因是后续查询、筛选、跨来源聚合、备份和迁移都会变复杂。

## 5. 事件模型

所有来源统一写入 `events` 表。不同来源可以有自己的字段，但必须保留标准字段和原始数据。

### 5.1 事件类型

#### wallet_trade

关注钱包买卖事件。

典型来源：

- GMGN follow 页面 DOM 扫描。
- 后续 Debot track 页面或 WebSocket。

字段重点：

- 钱包名或备注。
- 钱包地址，如果能拿到。
- 动作：buy、sell、open、add、reduce、close。
- 链。
- CA。
- symbol。
- 金额。
- 市值。
- 来源链接。

#### convergence_alert

聚合买入提醒事件。

典型来源：

- GMGN 聚合买入提醒托盘。

字段重点：

- 链。
- CA。
- symbol。
- 参与钱包列表。
- 买入钱包数。
- 卖出/清仓钱包数。
- 当前市值。
- 触发阈值。

#### tg_mention

TG 重点消息事件。

典型来源：

- TG 抓取器。
- Telegram 导出解析器。
- 后续本地转发服务。

字段重点：

- 群名或群 ID。
- 发送人。
- 消息原文。
- 提到的 CA。
- 提到的 symbol。
- 消息链接或 message id。
- 解析置信度。

#### twitter_signal

预留给 Twitter 信号。

字段重点：

- Twitter 用户名或备注。
- 动作：发推、回复、引用、转推、删除、关注、取消关注。
- 文本。
- 提到的 CA 或 symbol。

## 6. 标准事件 JSON

所有数据源都向后端提交如下结构：

```json
{
  "source": "gmgn",
  "type": "wallet_trade",
  "ts": 1780000000000,
  "chain": "bsc",
  "ca": "0x1111111111111111111111111111111111111111",
  "symbol": "PEPE",
  "token_name": "Pepe",
  "wallet": {
    "name": "西瓜",
    "address": "",
    "remark": "西瓜"
  },
  "action": "buy",
  "amount": "1",
  "amount_unit": "BNB",
  "mcap": "120K",
  "text": "西瓜 买入 1 BNB PEPE",
  "url": "https://gmgn.ai/bsc/token/0x1111111111111111111111111111111111111111",
  "raw": {}
}
```

TG 消息示例：

```json
{
  "source": "telegram",
  "type": "tg_mention",
  "ts": 1780000000000,
  "chain": "sol",
  "ca": "",
  "symbol": "PEPE",
  "token_name": "",
  "wallet": null,
  "action": "mention",
  "amount": "",
  "amount_unit": "",
  "mcap": "",
  "text": "这个 PEPE 可以看看，刚有聪明钱进",
  "url": "tg://message?chat_id=-100xxx&message_id=123",
  "raw": {
    "chat_id": "-100xxx",
    "chat_title": "重点群",
    "sender": "某人",
    "message_id": 123
  }
}
```

## 7. SQLite 表设计

第一版只需要两张表。

### 7.1 events

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  chain TEXT,
  ca TEXT,
  symbol TEXT,
  token_name TEXT,
  wallet_name TEXT,
  wallet_address TEXT,
  wallet_remark TEXT,
  action TEXT,
  amount TEXT,
  amount_unit TEXT,
  mcap TEXT,
  text TEXT,
  url TEXT,
  dedupe_key TEXT,
  confidence REAL,
  raw_json TEXT NOT NULL
);
```

索引：

```sql
CREATE INDEX idx_events_ts ON events(ts DESC);
CREATE INDEX idx_events_source_type ON events(source, type, ts DESC);
CREATE INDEX idx_events_token ON events(chain, ca, ts DESC);
CREATE INDEX idx_events_symbol ON events(symbol, ts DESC);
CREATE INDEX idx_events_wallet ON events(wallet_name, ts DESC);
CREATE UNIQUE INDEX idx_events_dedupe ON events(dedupe_key) WHERE dedupe_key IS NOT NULL;
```

### 7.2 token_aliases

用于把 TG 中只有 symbol 的消息，后续人工或自动绑定到 CA。

```sql
CREATE TABLE token_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain TEXT,
  ca TEXT NOT NULL,
  symbol TEXT,
  token_name TEXT,
  alias TEXT NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL
);
```

## 8. API 设计

### 8.1 健康检查

```text
GET /api/health
```

返回：

```json
{ "ok": true }
```

### 8.2 写入事件

```text
POST /api/events
Authorization: Bearer <LOCAL_SIGNAL_TOKEN>
Content-Type: application/json
```

请求体为标准事件 JSON。

返回：

```json
{
  "ok": true,
  "id": 123,
  "deduped": false
}
```

### 8.3 查询事件流

```text
GET /api/events?since=1780000000000&source=gmgn&type=wallet_trade&limit=200
```

支持过滤：

- `since`
- `until`
- `source`
- `type`
- `chain`
- `ca`
- `symbol`
- `wallet`
- `limit`

### 8.4 查询单币时间线

```text
GET /api/tokens/:chain/:ca/timeline?limit=200
```

如果只有 symbol：

```text
GET /api/tokens/by-symbol/:symbol/timeline?limit=200
```

symbol 查询必须标记为候选结果，不能当作确定 CA。

### 8.5 查询最近聚合

```text
GET /api/summary/recent?windowMin=30
```

返回按 token 聚合的最近事件：

- 多少个钱包买入。
- 哪些 TG 消息提到。
- 是否有聚合提醒。
- 最近一次事件时间。

## 9. 去重规则

后端必须生成 `dedupe_key`，避免插件重试或 DOM 重扫导致重复写入。

建议规则：

### wallet_trade

```text
wallet_trade|source|chain|ca_or_symbol|wallet_name|action|amount|event_minute
```

### convergence_alert

```text
convergence_alert|source|chain|ca_or_symbol|wallet_count|event_minute
```

### tg_mention

```text
tg_mention|chat_id|message_id
```

如果 TG 没有 message_id，则使用：

```text
tg_mention|chat_title|sender|text_hash|event_minute
```

## 10. 前端面板

第一版页面分 4 块。

### 10.1 实时事件流

显示最近事件，按时间倒序。

每条事件显示：

- 时间。
- 来源：GMGN / TG / Debot / Twitter。
- 类型：钱包买入、聚合提醒、TG 提及。
- 链。
- symbol / CA。
- 简短文本。
- 原始链接。

### 10.2 按币聚合

按 `chain + ca` 聚合。如果没有 CA，则按 symbol 放入“候选币”分组。

每个币显示：

- 最近 30 分钟事件数。
- 买入钱包数。
- TG 提及次数。
- 最新市值。
- 最近一次出现时间。
- 一键打开 GMGN / Debot / Fomo。

### 10.3 关注钱包动态

只看 `wallet_trade`：

- 钱包名。
- 动作。
- 金额。
- 币。
- 链。
- 时间。

### 10.4 TG 重点消息

只看 `tg_mention`：

- 群名。
- 发送人。
- 原文。
- 提取出来的 CA / symbol。
- 置信度。
- 关联到的 token 时间线。

## 11. CA 与 symbol 关联规则

优先级必须明确：

1. 有 CA：使用 `chain + ca` 作为确定身份。
2. 无 CA 但有明确链和 symbol：作为候选身份。
3. 只有 symbol：只进入候选列表，不自动合并到确定 CA。
4. 后续如果同一时间窗口内 GMGN/TG/Debot 都出现同一个 symbol，可以在 UI 中提示“疑似关联”，但不要自动覆盖。

原因：meme 币重名非常常见，错把 symbol 合并到 CA 会污染后续判断。

## 12. 数据源接入要求

### 12.1 GMGN 插件

需要在以下位置发事件：

- 关注钱包买入/卖出进入池子时，发 `wallet_trade`。
- 聚合提醒触发或更新时，发 `convergence_alert`。

第一版只需要从已有浏览器插件通过 `fetch("http://127.0.0.1:<port>/api/events")` 发送。

### 12.2 TG 抓取器

TG 抓取器需要在识别重点消息时发 `tg_mention`。

最低要求：

- 原文必须保存。
- 群 ID / 群名必须保存。
- message_id 如果能拿到必须保存。
- CA 正则命中时保存 CA。
- 没有 CA 但有 symbol 时保存 symbol。

### 12.3 Debot

Debot 作为后续数据源接入。不要在第一版阻塞本地面板。

调研方向：

- 如果 WebSocket payload 能稳定拿到交易事件，优先 WebSocket。
- 如果 WebSocket payload 不稳定或需要复杂鉴权，先用 DOM。
- Debot 接入结果也统一写入 `wallet_trade` 或 `convergence_alert`，不要单独做另一套面板。

## 13. 本地配置

建议使用 `.env`：

```text
PORT=17374
DB_PATH=./data/signal-board.sqlite3
LOCAL_SIGNAL_TOKEN=change-me-local-token
CORS_ORIGIN=chrome-extension://*
```

安全要求：

- `POST /api/events` 必须校验 `Authorization: Bearer <token>`。
- 默认只监听 `127.0.0.1`。
- 如果要给局域网机器写入，必须显式配置 `HOST=0.0.0.0`。

## 14. MVP 验收标准

### 14.1 后端

- `GET /api/health` 返回 `{ ok: true }`。
- `POST /api/events` 能写入 GMGN 钱包买入事件。
- 重复提交同一个 `dedupe_key` 不重复插入。
- `GET /api/events` 能按时间倒序返回。
- SQLite 重启后数据不丢。

### 14.2 前端

- 能看到最近 30 分钟事件流。
- 能按来源过滤 GMGN / TG。
- 能按币查看时间线。
- 没有 CA 的 TG 消息显示为“候选币”，不会和确定 CA 强行合并。

### 14.3 接入

- 从 GMGN 插件发一条 `wallet_trade`，页面 1 秒内出现。
- 从 TG 抓取器发一条 `tg_mention`，页面 1 秒内出现。
- 同一个 CA 的 GMGN 和 TG 事件能出现在同一个 token 时间线里。

## 15. 推荐实施阶段

### Phase 1: 本地事件服务和静态面板

- 建 Node.js 服务。
- 建 SQLite 表。
- 建 `POST /api/events` 和 `GET /api/events`。
- 前端先用真实 API 展示事件流。
- 用 curl 或测试脚本写入模拟 GMGN/TG 事件。

### Phase 2: 接 GMGN 插件

- 在 GMGN 关注钱包交易入池时发送 `wallet_trade`。
- 在聚合提醒触发时发送 `convergence_alert`。
- 加开关和本地 API 地址配置。
- 网络失败只记录 console warning，不影响原插件提醒。

### Phase 3: 接 TG 抓取器

- 给 TG 抓取器增加 webhook 输出。
- 保存原文、群、发送人、message_id。
- 增加 CA/symbol 提取。

### Phase 4: 关联和复盘

- token 时间线。
- 最近 30 分钟按币聚合。
- 候选 symbol 合并提示。
- 一键打开 GMGN / Debot / Fomo。

## 16. 给其他 Codex 的实现提示词

```text
你要在一个新目录里实现“本地信号记忆面板”。

目标：
把 GMGN 插件、TG 抓取器、后续 Debot/Twitter 的实时信号写入本地 SQLite，并提供网页面板回看。

请先实现 MVP，不要做自动交易，不要做云端同步。

技术栈建议：
- Node.js + Fastify 或 Express
- SQLite
- Vite + React

必须实现：
1. POST /api/events
2. GET /api/events
3. GET /api/health
4. SQLite events 表
5. 去重 dedupe_key
6. 前端实时事件流
7. 按 token 聚合视图
8. TG 消息候选币逻辑：没有 CA 时不能强行合并

事件类型：
- wallet_trade
- convergence_alert
- tg_mention
- twitter_signal 预留

验收：
- curl 写入一条 GMGN wallet_trade，页面能看到
- curl 写入一条 TG tg_mention，页面能看到
- 同一个 chain+ca 的事件能进入同一个 token 时间线
- 重复 dedupe_key 不重复入库

请先输出实现计划和文件结构，然后开始实现。
```

## 17. 风险

### 17.1 symbol 误关联

风险：TG 只说 symbol，但多个链或多个 CA 可能同名。

处理：没有 CA 的消息只能作为候选，不自动归并。

### 17.2 数据源重复推送

风险：GMGN DOM 扫描、TG 重连、插件 reload 都可能重复发送。

处理：后端 dedupe_key 是强制要求。

### 17.3 本地服务不可用

风险：本地服务没启动时，插件发送失败。

处理：数据源侧不能阻塞原逻辑，只 console warning，不能影响语音或原有提醒。

### 17.4 数据量增长

风险：事件长期积累后查询变慢。

处理：第一版加索引；后续加保留策略，例如默认保留 30 天，重要事件可收藏。

## 18. 结论

这个项目应该作为“信号记忆层”单独建设。它不替代 GMGN、TG、Debot，也不直接交易，只负责把高价值瞬时信号记录下来，并按币、钱包和来源组织成可回看的本地工作台。
