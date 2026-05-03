# 钱包聚合买入提醒

一个 Chrome 扩展同时支持 **xxyy.io** 和 **gmgn.ai** 两个平台的钱包追踪聚合检测。

> ⚠️ 非官方第三方工具。仅本地处理数据，不上传任何信息。仅供个人学习使用，使用风险自担。

## 功能

| 功能 | xxyy.io | gmgn.ai |
|---|---|---|
| 🔥 N 个钱包 X 分钟内买同币聚合提醒 | ✅ | ✅ |
| ★ 我的列单独聚合（双面板） | ✅ | ❌ (gmgn 没有 KOL/我的 区分) |
| ⭐ 特别关注炫彩高亮 | ✅ | ✅ |
| 🪞 实时镜像第二张监控卡（新版页面） | ✅ | ❌ |
| 🎯 按合约去重（同名不同链不会误聚） | ✅ | ✅ |
| 🔗 SPA 跳转（不刷新整页） | ✅ | ✅ |
| 🏷️ 钱包分组徽章 | ✅ | ❌ |
| 🌐 多布局支持（新版/旧版） | ✅ | — |

## 安装

1. 去 [Releases 页](../../releases) 下载最新的 `wallet-convergence-alert-v*.zip` 解压
2. Chrome 地址栏 `chrome://extensions/` → 开启「**开发者模式**」
3. 点「**加载已解压的扩展程序**」选解压后的目录
4. 打开任意 [pro.xxyy.io](https://pro.xxyy.io) 或 [gmgn.ai](https://gmgn.ai) 页面

每个网站的逻辑独立，不会互相影响。

## 使用

打开任一支持的网站后：

- 钱包监控/追踪面板顶部出现金色「🔥 聚合买入提醒」面板
- 默认阈值：**≥ 2 钱包** + **内 5 分钟**（gmgn 默认 30 分钟，因为列表跨度更大）
- 点钱包名前的 ☆ 加星标 → 该钱包出现在任何提醒里整条会**炫彩动画高亮**
- 点提醒里的代币名 → 页面内跳转到该币交易页（不刷新）

## 项目结构

```
wallet-convergence-alert/
├── manifest.json            # 共用清单，按域名分发
├── icons/                   # 共用图标
├── xxyy/                    # xxyy.io 专用
│   ├── content.js           # 注入逻辑（聚合检测、面板、克隆卡）
│   ├── network-hook.js      # MAIN world 拦截 socket.io 钱包交易
│   └── styles.css
└── gmgn/                    # gmgn.ai 专用
    ├── content.js           # 纯 DOM 扫描（gmgn 走 Web Worker 抓不到网络）
    └── styles.css
```

## 工作原理差异

**xxyy.io**：
- MAIN world hook 拦截 `web-push.xxyy.io/socket.io/` 长轮询里的 `FOCUS_WALLET_TRADE` 帧
- 启动时主动 `GET /api/trade/wallet/focusWallet/history` 拉历史
- 实时性 1-2 秒

**gmgn.ai**：
- 数据走 Web Worker 内的 fetch（页面 hook 抓不到）→ 纯 DOM 扫描
- `MutationObserver` + 5 秒兜底定时
- 时间字段是相对的（"2h"/"5m"），转毫秒做窗口判断有 ±时间不精确

## 调试

DevTools Console:

xxyy:
```js
__xcp.alertsKol       // 主面板聚合（KOL+我的 全聚合）
__xcp.alertsMy        // 我的聚合
__xcp.cloneData       // 两栏交易缓存
__xcp.starred         // 特别关注集
__xcp.tokenMeta       // 代币元数据
__xcp.walletGroups    // 钱包→分组映射
__xcp.rerender()      // 强制重渲
```

gmgn:
```js
__gcp.alerts          // 所有聚合提醒
__gcp.buyRecords      // 池子里的所有买入
__gcp.tokenMeta       // 已知合约/symbol
__gcp.starred         // 特别关注
__gcp.rescan()        // 强制重扫
```

## 打包发布

```bash
bash release.sh                                # 生成 dist/wallet-convergence-alert-v*.zip
gh release create vX.Y.Z dist/*.zip            # 上传到 GitHub Release
```

## 隐私

- 所有数据**仅本地浏览器处理**，不发送到任何外部服务器
- `localStorage` 仅保存：阈值、声音开关、特别关注名单
- xxyy 的 fetch 调用复用浏览器现有 cookie，gmgn 完全不发请求
- 没有任何分析 / 埋点

## 协议

MIT
