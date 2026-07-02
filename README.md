# 钱包聚合买入提醒

一个同时支持 **xxyy.io** 和 **gmgn.ai** 的 Chrome 扩展，用来监控钱包追踪页面里的交易流，做聚合买入提醒，并为 GMGN 增加一套独立的 Twitter 语音提示、follow 信息流语音特别关注、主窗口跳转和页面清理能力。

> 非官方第三方工具，仅供个人学习和自用。请自行评估使用风险。

## 功能概览

| 功能 | xxyy.io | gmgn.ai |
| --- | --- | --- |
| N 个钱包在 X 分钟内买入同一代币时触发聚合提醒 | 支持 | 支持 |
| 按 `chain + mint` 去重，避免同名不同链误聚合 | 支持 | 支持 |
| 页面内跳转到代币页，不整页刷新 | 支持 | 支持 |
| 聚合买入主提醒保留原始蜂鸣音 | 支持 | 支持 |
| 多个监控页共享聚合池 | 不适用 | 支持 |
| 独立 Twitter 语音模块 | 不适用 | 支持 |
| follow 信息流语音特别关注 | 不适用 | 支持 |
| 打开监控链接时优先跳到指定主窗口 | 不适用 | 支持 |
| 全站移除 GMGN 导航栏“预测”按钮 | 不适用 | 支持 |
| 中文扩展设置页 | 支持 | 支持 |
| 自定义音源：内置音频 / 上传 MP3 / 远程音频链接 | 不适用 | 支持 |
| TTS 音色 / 语速 / 音调 / 试听 | 不适用 | 支持 |

## 最近新增的重点能力

- GMGN 聚合扫描现在只在 `follow` 页面启用，支持：
  - `https://gmgn.ai/follow`
  - `https://gmgn.ai/follow?chain=base`
  - `https://gmgn.ai/{chain}/follow`
- GMGN 聚合数据源支持 `BSC / ETH / BASE`，不同 `follow` 标签页会共享聚合池。
- GMGN 的 Twitter 提示是独立模块，不会改写原本的聚合买入提醒逻辑。
- Twitter 语音只在当前可见前台 tab 播放，后台 tab 保持静默，避免重复提醒。
- Twitter 语音支持按动作播报：发推、转推、回复、引用、关注、取消关注、删除、点赞、置顶、资料更新。
- GMGN follow 里新增“语音特别关注”名单，和 GMGN 自带星标是两套不同逻辑。
- 语音特别关注的钱包只会播报 **10 秒内** 的新买卖，避免旧 DOM 重绘后重复念。
- 扩展图标现在会直接打开完整设置页标签，不再依赖小弹窗 popup。
- 设置页支持上传自定义音频，也支持填写远程音频链接作为音源。

## 安装

1. 前往 [Releases](../../releases) 下载最新的 `wallet-convergence-alert-v*.zip`
2. 解压到本地目录
3. 打开 `chrome://extensions/`
4. 启用“开发者模式”
5. 点击“加载已解压的扩展程序”，选择解压后的目录
6. 安装完成后，点击扩展图标即可打开设置页

## 使用说明

### xxyy.io

1. 打开 [pro.xxyy.io](https://pro.xxyy.io)
2. 钱包监控区域会自动注入“聚合买入提醒”面板
3. 当多个钱包在时间窗口内买入同一币种时触发提醒
4. 点击代币名会在当前页内跳转，不做整页刷新

### gmgn.ai

1. 打开任意支持的 `follow` 页面
2. 只有 `follow` 页面会启用聚合买入扫描和共享聚合池
3. 面板会显示当前扫描到的行数、聚合池大小、以及各链记录数
4. 聚合买入主提醒仍然使用本地蜂鸣音，不依赖 TTS
5. 页面内代币跳转仍然可用

### 主窗口与监控窗口

- `监控窗口`：正在打开 `gmgn.ai/follow` 的那个窗口。聚合买入面板、follow 信息流扫描、语音特别关注、Twitter 语音监听，都是在这个窗口里运行。
- `主窗口`：你平时用来查看代币详情、打开外链、继续深挖页面的那个 Chrome 窗口。

设置方式：

1. 先把你想作为“主窗口”的那个 Chrome 窗口切到前台
2. 点击扩展图标，打开设置页
3. 点击 `设为主窗口`
4. 再去另一个窗口打开 `gmgn.ai/follow` 作为“监控窗口”

当前行为：

- 在监控窗口里点击代币、外链或由监控页触发的跳转时，扩展会优先把目标页面打开到主窗口
- 监控窗口会尽量继续停留在 `follow` 页面，避免监控页被跳转带走
- 如果你没有设置主窗口，扩展就不会有这层“分屏导流”效果

### GMGN 语音特别关注

- 在 `follow` 聚合买入面板的钱包标签前，点击 `☆ / ★` 可以加入或移出“语音特别关注”
- 这套名单和 GMGN 自带星标不同，不共用
- 也可以在扩展设置页里手动维护这份名单，并设置播报名
- 只有进入这份名单的钱包，后续在 `follow` 信息流里出现新买卖时才会触发语音
- 当前播报词固定为：
  - `买入` -> “买入了”
  - `卖出` -> “卖出了”
  - `建仓` -> “建仓了”
  - `清仓` -> “清仓了”

示例：

```text
西瓜 买入了 1BNB pepe
```

### GMGN Twitter 语音监控

GMGN 全站会监听 `twitter_user_monitor_basic` WebSocket 消息，并按映射关系播放音频或 TTS。

支持区分的动作包括：

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

播报名优先级：

1. `remark`
2. 设置页里为该账号配置的备注
3. GMGN 推送里的 `name`
4. `username`
5. `id`

示例：

```text
V神 发推了
CZ 转推了
某账号 取消关注了一个账号
```

## 设置页

点击扩展图标后会直接打开完整设置页标签。当前支持：

- 主窗口选择
- Twitter 语音总开关
- 未映射账号默认提示
- TTS 音色、语速、音调、试听
- Twitter 事件筛选
- `Twitter ID -> 音源` 映射
- GMGN 语音特别关注钱包名单
- 自定义音源库
- 规则导入导出
- 音源备份导入导出

### 音源类型

支持三类音源：

1. 内置提示音，例如 `default.MP3`、`preset1.MP3`
2. 本地上传音频，例如 `MP3 / WAV / OGG / M4A / FLAC / ZIP`
3. 远程音频链接，例如 `https://example.com/alert.mp3`

## 项目结构

```text
wallet-convergence-alert-gmgn-monitor/
├─ manifest.json
├─ background.js
├─ settings.html
├─ popup.html
├─ popup.js
├─ popup.css
├─ sounds/
├─ lib/
├─ xxyy/
│  ├─ network-hook.js
│  ├─ content.js
│  └─ styles.css
└─ gmgn/
   ├─ page-bridge.js
   ├─ redirector.js
   ├─ content.js
   ├─ twitter-audio-content.js
   ├─ twitter-audio-inject.js
   └─ styles.css
```

## 工作原理

### xxyy.io

- 通过 MAIN world hook 拦截 `socket.io` 数据流
- 启动时会补拉一遍历史交易
- 实时性较高

### gmgn.ai 聚合买入

- GMGN 的交易流主要在页面内部 worker/DOM 层体现，直接网络层 hook 不稳定
- 因此聚合买入提醒采用 `DOM 扫描 + MutationObserver + 定时兜底`
- 仅在 `follow` 页面启用
- 多个已打开的 `follow` 标签页会共享聚合快照
- 聚合键基于 `chain + mint`

### gmgn.ai Twitter 语音

- 通过注入脚本监听 `twitter_user_monitor_basic` WebSocket
- `gmgn/twitter-audio-inject.js` 负责抓取触发器并派发事件
- `gmgn/twitter-audio-content.js` 负责筛选、映射、队列、TTS 和播放
- 只有 `document.visibilityState === 'visible'` 的前台 tab 会播放
- 命中映射时优先播指定音源；未映射账号可以退回默认音或 TTS

## 调试

DevTools Console 常用前缀：

- `[GMGN Twitter Inject]`
- `[GMGN Twitter Audio]`
- `[GMGN Twitter Receive]`
- `[GMGN Monitor Link Redirector]`

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

### 打包

```bash
bash release.sh
```

会生成：

- `dist/wallet-convergence-alert-v*.zip`
- `dist/RELEASE_NOTES_v*.md`

## 隐私与外部请求

- 聚合买入扫描、follow 信息流扫描、语音特别关注匹配，都在本地浏览器内完成
- 配置数据保存在浏览器本地存储中
- 如果启用 TTS，扩展会请求外部 TTS 接口：
  - 默认使用 Mac mini 上的豆包语音服务：`http://tts.macmini.lan/tts/v3-task`
  - 也可以在设置页切换到 Cloudflare Worker：`https://cloudflare-edge-tts.tech-melon.workers.dev/tts`
  - 兼容旧代理格式：`POST /tts`，请求体为 `{ text, voice, rate, pitch }`
- 如果外部 TTS 失败，会回退到浏览器原生 `speechSynthesis`
- 如果你添加了远程音频链接，浏览器会直接请求对应音频 URL
- GMGN 聚合买入主提醒本身仍然使用本地蜂鸣音，不依赖外部 TTS

## License

MIT
