## v1.7.2 — 修同名不同合约的代币跳转错位

**问题**：聚合提醒里如果有两个同名（如都叫 DILLEY）但 CA 不同的代币，点击代币名都跳转到同一个 CA — 因为优先级搞反了，先按名字找原列表的 `.btn-token` click，匹到第一个就走了。

**修复**：跳转优先级倒过来：
1. 优先用 alert 自带的 mint+chain 走 `history.pushState` 直跳 → 精准到 CA
2. 没有 mint 时才退回到原卡 click（可能不准但有总比没有好）

xxyy 和 gmgn 都修。
