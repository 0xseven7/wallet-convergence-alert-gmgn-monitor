## v1.8.3 — 修同钱包多次买入未合并

**问题**：同一个钱包通过 socket.io（带地址）+ DOM 扫描（无地址）两条路径都进入了池子，因为 dedup id 不一致（addr vs displayName），被算成两个不同钱包；提醒里同一个钱包名出现两次。

**修复**：
- 新增 `walletNameToAddr` 映射：socket.io 推送时学习「钱包显示名 → 地址」
- 新增 `canonicalWallet(record)` 函数：addr 优先，没有时回查映射，最后才用 displayName
- 所有用到钱包 key 的地方（dedup、分组、清仓匹配）都走 `canonicalWallet`
- DOM 扫描的没有地址的 trade，也能通过映射规范成 socket.io 已知地址 → 跨路径合并

适用场景：
- 同一钱包先经 socket.io 入池，后又被 DOM 扫描发现（旧版页面常见）
- 重连后 socket.io 重推同一笔交易（带毫秒级时间戳差异）
