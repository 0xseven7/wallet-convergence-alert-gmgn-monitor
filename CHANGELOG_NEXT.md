## v1.9.1 — 修跨链同名代币的 mint 错填

**真 bug**：xxyy 的 DOM 扫描没法直接拿到 mint，靠**代币名反查 tokenMeta**填补。如果同时存在 FREEMAN-BSC（`0x72…4444`）和 FREEMAN-SOL 两个同名 token，反查只取「第一个 symbol 匹配」的 meta —— SOL 上的 trade 被错误填上 BSC 的 mint，最终全部并进 BSC 那个聚合，列表里就出现「BNB 购买」和「SOL 购买」混在一起。

**修复**（仅 xxyy DOM 扫描路径）：
1. 从金额单位反推 chain（`SOL` → sol、`BNB` → bsc、`ETH` → eth、`BASE` → base）
2. 反查 `tokenMeta` 时**必须 symbol + chain 都匹配**，不再只看 symbol
3. 没识别到 chain 时，宁可让 mint 留空（被严格模式跳过），也不乱填

socket.io 推送路径不受影响（mint 直接从 `tradeData.mint` 拿，不需要反查）。

**注意**：升级后**已经在池子里的错位记录**还会保留到时间窗口结束（默认 5 分钟）。等池子刷新或手动 console 跑 `__xcp.alertsKol = []; __xcp.buyRecords = []; __xcp.rerender()` 立刻清干净。
