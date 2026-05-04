## v1.8.0 — 严格 CA 隔离 + 平台徽章

### 严格按合约聚合（修长期 bug）

之前没拿到 mint 的记录会 fallback 用名字 key 聚合 → 导致同名不同 CA 的代币错误地混进一条提醒（这版才彻底修）。

**新行为**：没有 mint 的记录直接**不参与聚合**（宁可漏几个不报，也不误报）。

副作用：xxyy 早期 DOM 扫描进来的、没机会被 socket.io 补 mint 的记录会被丢掉。但 socket.io 持续推送 → 实际可用的记录都有 mint，影响极小。

### 平台徽章

代币名旁边自动显示发射平台小标签：
- 🟢 **PUMP**：mint 末尾 `pump` → pump.fun
- 🟠 **BONK**：mint 末尾 `bonk` → bonk.fun
- 🟣 **BOOP**：mint 末尾 `boop` → boop.fun
- 🔴 **FOUR**：BSC + dex 名含 four → four.meme

xxyy 用 socket.io 的 `tradeData.dex` 字段更可靠；gmgn 暂只看 mint 后缀（BSC 的 four.meme 暂时识别不到，需要 dex 字段，后续看怎么从 DOM 抓）。
