## v1.9.4 — 同链同名同平台代币不再误聚

之前 v1.9.1 已经按 chain 区分了同名跨链的 token，但**同链同名同发射台**的两个 mint（比如两个都叫 FREEMAN 的 Solana pump.fun token）依然会被错位反查到第一个匹配的 mint。

**修复**：xxyy 的 DOM 扫描反查 `tokenMeta` 时改成**唯一匹配**：
- 同 symbol + 同 chain 在已知 meta 里只有 **1 个** mint → 用它
- 有 **2+ 个** 候选 → **放弃猜测**，留空 mint
- 留空的记录被严格模式（v1.8.0 起）直接丢掉，宁可漏报也不误聚

代价：DOM 扫描见到的歧义 token 暂时不算入聚合，等 socket.io 推送过来 trade 自带准确 mint 后才参与（通常几秒内会有）。

socket.io 路径不受影响（mint 直接来自 `tradeData.mint`，本来就准）。
