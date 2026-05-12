# 钱包聚合买入提醒

一个同时支持 **xxyy.io** 和 **gmgn.ai** 的 Chrome 扩展，用来监控钱包追踪面板里的交易流，做聚合买入提醒，并给 GMGN 补一套独立的 Twitter 语音提示和 follow 信息流语音特别关注。

> ⚠️ 非官方第三方工具，仅供个人学习和自用。请自行评估使用风险。

## 功能概览

| 功能 | xxyy.io | gmgn.ai |
|---|---|---|
| N 个钱包 X 分钟内买入同币时聚合提醒 | ✅ | ✅ |
| 按合约去重，避免同名不同链误聚合 | ✅ | ✅ |
| 页面内跳转到代币页，不整页刷新 | ✅ | ✅ |
| 聚合买入提醒保留原始蜂鸣音 | ✅ | ✅ |
| 独立 Twitter 监控语音模块 | ❌ | ✅ |
| follow 信息流语音特别关注 | ❌ | ✅ |
| 多个 follow 标签页共享聚合池 | ❌ | ✅ |
| 监控页外链优先跳到指定主窗口 | ❌ | ✅ |
| GMGN 全站移除导航栏“预测”按钮 | ❌ | ✅ |
| 扩展内中文设置页 | ✅ | ✅ |
| 自定义音源：内置音频 / 上传 MP3 / 远程链接 | — | ✅ |
| TTS 音色 / 语速 / 音调 / 试听 | — | ✅ |
| 开发态自动重载 | ✅ | ✅ |

## 当前版本重点

- GMGN 聚合数据源只在 `follow` 页面启用，其他 GMGN 页面不跑聚合扫描。
- Twitter 语音提示是独立模块，不会改写现有聚合买入提醒逻辑。
- GMGN follow 的“语音特别关注”与 GMGN 自带星标是两套不同逻辑。
- 语音特别关注只播报 **10 秒内** 的新买卖，避免旧 DOM 重绘时重复念。
- 扩展图标点击后会直接打开一个完整的中文设置页标签，不再使用小弹窗 popup。

## 安装

1. 去 [Releases](../../releases) 下载最新的 `wallet-convergence-alert-v*.zip`
2. 解压到本地目录
3. 打开 `chrome://extensions/`
4. 开启“开发者模式”
5. 点击“加载已解压的扩展程序”，选择解压后的目录
6. 安装完成后，点击扩展图标即可打开设置页标签

## 使用

### xxyy.io

1. 打开 [pro.xxyy.io](https://pro.xxyy.io)
2. 钱包监控区域会自动注入“聚合买入提醒”面板
3. 满足阈值时触发聚合买入提醒，并保持原有蜂鸣音

### gmgn.ai

1. 打开 [gmgn.ai/follow](https://gmgn.ai/follow)
2. 只有 `follow` 页面会启用聚合买入扫描和共享聚合池
3. 面板里会显示当前页行数、聚合池大小，以及各链记录数量
4. 代币名支持页面内跳转，不刷新整页

### GMGN 语音特别关注

- 在 follow 页聚合面板的钱包标签前，点击 `☆ / ★` 可加入或移出“语音特别关注”
- 这套名单和 GMGN 自带星标不同
- 也可以在扩展设置页里手动添加钱包名和播报名
- 只有加入这套名单的钱包，后续在 follow 信息流里出现新的买卖时才会触发 TTS
- 仅播报 **10 秒内** 的新记录
- 当前标准播报用词：
  - `买入` -> “买入了”
  - `卖出` -> “卖出了”
  - `建仓` -> “建仓了”
  - `清仓` -> “清仓了”

示例：

```text
西瓜 买入了 1BNB pepe
```

### Twitter 语音监控

GMGN 全站会监听 `twitter_user_monitor_basic` 数据流，并按映射关系播放音频或 TTS。

当前可区分的动作包括：

- 发推
- 转推
- 回复
- 引用
- 关注
- 取消关注
- 删除
- 点赞
- 置顶
- 资料更新

示例：

```text
elonmusk 发推了
CZ 转推了
某账号 取消关注了一个账号
```

## 设置页

点击扩展图标会打开一个完整的设置页标签，当前支持：

- 主窗口选择
- 推特语音总开关
- 未映射账号默认提示音
- TTS 语音风格、语速、音调、试听
- 推特事件筛选
- `Twitter ID -> 音源` 映射
- GMGN 语音特别关注钱包名单
- 自定义音源库
- 规则导入导出
- 音源备份导入导出

### 音源类型

支持三类音源：

1. 内置提示音，如 `default.MP3`、`preset1.MP3`
2. 本地上传音频，如 `MP3 / WAV / OGG / M4A / FLAC / ZIP`
3. 远程音频链接，如 `https://example.com/alert.mp3`

## 项目结构

```text
wallet-convergence-alert/
├── manifest.json
├── background.js
├── settings.html              # 扩展设置页（点击图标打开）
├── popup.html                 # 复用的设置页结构模板
├── popup.js                   # 设置页逻辑
├── popup.css
├── sounds/                    # 内置提示音
├── lib/                       # 前端依赖（当前含 JSZip）
├── dev/
│   ├── auto-reload-client.js
│   └── auto-reload-server.mjs
├── xxyy/
│   ├── network-hook.js
│   ├── content.js
│   └── styles.css
└── gmgn/
    ├── page-bridge.js
    ├── redirector.js
    ├── content.js
    ├── twitter-audio-content.js
    ├── twitter-audio-inject.js
    └── styles.css
```

## 工作原理

### xxyy.io

- 使用 MAIN world hook 拦截 `socket.io` 数据流
- 启动时会拉一次历史交易
- 实时性较高

### gmgn.ai

- GMGN 数据主要在 Web Worker 内部流转，页面侧很难直接 hook 到交易接口
- 因此聚合买入部分采用 `DOM 扫描 + MutationObserver + 定时兜底`
- 仅在 `follow` 页面启用聚合扫描
- 多个打开的 `follow` 标签页会共享记录池

### GMGN Twitter 语音

- 通过注入脚本监听 `twitter_user_monitor_basic` WebSocket 消息
- 命中映射时优先播放指定音源
- 未映射账号可回退到默认提示音或 TTS
- 现有筛选开关仍然有效：
  - `推文 / 转推 / 回复 / 引用` 各自独立
  - `关注 / 取消关注 / 删除 / 点赞 / 置顶 / 资料更新` 归类到“其他”

## 调试

DevTools Console:

### xxyy

```js
__xcp.alertsKol
__xcp.alertsMy
__xcp.cloneData
__xcp.starred
__xcp.tokenMeta
__xcp.walletGroups
__xcp.rerender()
```

### gmgn

```js
__gcp.alerts
__gcp.buyRecords
__gcp.tokenMeta
__gcp.starred
__gcp.rescan()
```

## 开发

### 本地自动重载

已解压扩展开发模式下，可以启动本地 watcher，在代码保存后自动重载扩展并刷新相关页面。

```bash
node dev/auto-reload-server.mjs
```

说明：

- 状态接口默认是 `http://127.0.0.1:17373/status`
- 第一次改完代码后，仍需要去 `chrome://extensions` 手动重载一次扩展，让自动重载客户端生效

### 打包

```bash
bash release.sh
```

会生成：

- `dist/wallet-convergence-alert-v*.zip`
- `dist/RELEASE_NOTES_v*.md`

## 隐私与外部请求

- 聚合买入检测、follow 信息流扫描、钱包特别关注匹配，都在本地浏览器内完成
- 配置数据保存在浏览器本地存储中
- **如果启用 TTS**，扩展会请求外部 TTS 接口生成语音：
  - `https://cloudflare-edge-tts.tech-melon.workers.dev/tts`
- 如果外部 TTS 失败，会回退到浏览器原生 `speechSynthesis`
- **如果你添加了远程音频链接**，浏览器会直接请求该音频 URL
- GMGN 聚合买入主提醒本身不依赖外部 TTS，仍使用本地蜂鸣音

## 协议

MIT
