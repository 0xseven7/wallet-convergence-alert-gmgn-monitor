## v1.9.2 — xxyy 双面板阈值独立设置

之前 xxyy 主面板和「我的 聚合」面板共用同一组 `≥ N 钱包 / 内 X 分钟` 阈值，改一个两边都跟着变。现在拆开，**每个面板的阈值独立保存**：

- 主面板（KOL 全聚合）：`config.minWallets` / `config.timeWindowMin`
- 我的聚合：`config.minWalletsMy` / `config.timeWindowMinMy`
- 改任一面板的输入框只影响那一面板，另一边不动
- tier 档位、faded 散场态、聚合检测全部按面板自己的阈值算
- 老版升级自动同步：原来的 `minWallets` 值会同步到新增的 `minWalletsMy`

例：你想用「**KOL 5 钱包 / 5 分钟**」追大热点，同时「**我的 2 钱包 / 30 分钟**」捕捉自己关注的小群体共振 — 现在能直接配。

gmgn 只有一个面板，不受影响。
