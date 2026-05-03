# 钱包聚合买入提醒（XXYY 增强插件）

适配 [pro.xxyy.io](https://pro.xxyy.io) 的 Chrome 浏览器扩展，给钱包监控面板加几个实用功能。

> ⚠️ 非官方第三方工具。仅本地处理数据，不上传任何信息。仅供个人学习使用，使用风险自担。

## 功能

| 功能 | 说明 |
|---|---|
| 🔥 聚合买入提醒 | N 个钱包在 X 分钟内买入同一代币 → 弹出提醒 + 声音 |
| ★ 我的聚合 | 单独检测「我的」列里钱包之间的聚合行为 |
| ★ 特别关注 | 给任意 KOL 加星标，他出现时整条提醒炫彩高亮 |
| 🪞 实时镜像 | 新版页面：克隆出第二张监控卡，独立显示「我的」无需切 tab（旧版页面跳过） |
| 🌐 双布局支持 | 自动识别新版 dock / 旧版双列 plate 两种页面 |
| 🔗 SPA 跳转 | 点提醒里的代币名直接页面内跳转，不刷新整页 |
| 🎯 按合约去重 | 同名不同合约的代币各自独立聚合 |
| 🏷️ 分组徽章 | 自动捕获你的钱包分组，显示在每个钱包名后 |

## 安装

### 方法 1：从 Release 下载

1. 去 [Releases 页](../../releases) 下载最新的 `xxyy-convergence-alert-v*.zip`
2. 解压到任意目录
3. Chrome 地址栏输入 `chrome://extensions/`
4. 右上角开「**开发者模式**」
5. 点「**加载已解压的扩展程序**」选解压后的目录
6. 打开 https://pro.xxyy.io 任意代币页面，钱包监控卡片里就会出现新面板

### 方法 2：克隆仓库

```bash
git clone <仓库地址>
# 然后按方法 1 第 3 步开始
```

## 使用

打开 [pro.xxyy.io](https://pro.xxyy.io) 任意代币页面：

- 钱包监控卡片顶部会内嵌一个金色「🔥 聚合买入提醒」面板
- 阈值可调：**≥ N 钱包** + **内 X 分钟**（两个面板自动同步）
- 每条交易行的钱包名前会有 ☆ 按钮，点击加星标
- 加星的钱包出现在任何提醒里，整条都会**炫彩动画高亮** + 右上角金色 ★
- 点提醒里的代币名 → 页面内跳转到该币交易页（不刷新）

## 调试

DevTools Console 输入：

```js
__xcp.cloneData       // 当前缓存的两栏交易（kol / my）
__xcp.alertsKol       // 主面板聚合提醒
__xcp.alertsMy        // 我的聚合提醒
__xcp.tokenMeta       // 已知代币的合约/链/logo 映射
__xcp.starred         // 特别关注的钱包名集合
__xcp.walletGroups    // 钱包→分组名映射
__xcp.refetchGroups() // 重试拉取钱包分组
__xcp.setGroup('钱包名', '分组名') // 手动塞分组映射
__xcp.rerender()      // 强制重渲所有面板
```

## 工作原理

1. `network-hook.js` 在 MAIN world 拦截 `XMLHttpRequest` / `fetch` / `WebSocket`，专门解析 `web-push.xxyy.io/socket.io/` 长轮询里的 `FOCUS_WALLET_TRADE` 事件
2. `content.js` 在隔离世界接收消息，建立去重池 + 滑动时间窗口聚合检测
3. 启动时主动 `GET /api/trade/wallet/focusWallet/history?channel=1|2&allChain=1` 拉历史，免去用户手动切换 tab
4. 用 `MutationObserver` 把 ☆ 按钮持续注入到 vue-recycle-scroller 复用的节点

## 打包发布

```bash
# Bash (Git Bash / WSL)
bash release.sh

# Windows CMD
release.bat
```

会在 `dist/` 生成 `xxyy-convergence-alert-v*.zip`。

## 隐私

- 所有数据**仅本地浏览器处理**，不发送到任何外部服务器
- `localStorage` 仅保存：阈值配置、声音开关、特别关注名单
- 拉取的接口都是 xxyy.io 自己的，复用浏览器现有 cookie
- 没有任何分析 / 埋点

## 协议

MIT
