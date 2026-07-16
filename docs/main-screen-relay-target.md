# 主屏轻量扩展与 Relay 目标

目标：主屏幕和监控屏幕运行在不同 Chrome profile 时互不影响，监控屏负责采集，主屏只负责轻量交互和接收跳转。

## 目录

- `mid-screen-extension/`：主屏轻量扩展
- `relay/`：本地中间层，默认端口 `17390`
- `docs/main-screen-relay-runbook.md`：安装、验证、Docker/WSL/Mac 部署取舍和排障手册

## 主屏扩展职责

- 接收 relay 的 `open-url` 事件
- 在主屏 profile 内打开或复用 GMGN/FOMO/DEBOT 标签页
- 保留 GMGN/FOMO 悬浮收藏按钮
- 保留 GMGN/FOMO counterpart 跳转按钮
- 做轻量 GMGN UI 清理
- 不加载监控屏的大型 DOM 扫描、钱包流水监听、聚合判断、语音提醒脚本

## 监控扩展职责

- 继续负责 GMGN follow/监控屏采集
- 点击需要跳主屏的链接时，优先探测 relay
- 只有 relay 在线且主屏扩展有心跳时，才发送 `/open-url`
- 如果 relay 或主屏扩展不在线，自动回退到原来的同 profile `windowId` 跳转逻辑
- 巨额买入/特别关注钱包买入优先写 relay `/focus-buys`，Market Watch 未启动时由 relay 持久化待消费

## 跳转链路

```text
监控屏 Profile A 扩展
  -> POST http://127.0.0.1:17390/open-url
  -> relay 入队
  -> relay 通过 WebSocket /ws 推送给主屏 Profile B 扩展
  -> 主屏扩展 chrome.tabs.update/create
```

## Focus Buys 链路

```text
监控屏 Profile A 扩展
  -> POST http://192.168.3.129:17390/focus-buys
  -> relay 持久化 type=focus-buy,target=market-watch
  -> Market Watch 启动后 GET /focus-buys?limit=50
  -> Market Watch 写入成功后 POST /focus-buys/ack
```

relay 不在线时，监控扩展会回退到原来的直连 Market Watch：

```text
POST http://127.0.0.1:17387/focus-buys
```

## 安装方式

1. 启动 relay：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
npm start
```

也可以直接运行：

```powershell
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay\start-relay.ps1
```

或者双击：

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay\start-relay.cmd
```

Docker 方式：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
docker compose up -d --build
```

Docker relay 也监听 `127.0.0.1:17390`，事件持久化到 `relay/data`。不要同时运行 PowerShell relay 和 Docker relay，否则端口会冲突。

Mac mini Docker 方式：

```bash
cd ~/work/wallet-convergence-alert-gmgn-monitor/relay
docker compose -f docker-compose.macmini.yml up -d --build
```

Mac mini relay 地址：

```text
http://192.168.3.129:17390
```

设置为当前 Windows 用户登录后自动启动：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\install-startup.ps1
```

取消自动启动：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\uninstall-startup.ps1
```

2. 在主屏 Chrome profile 加载 unpacked extension：

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\mid-screen-extension
```

主屏扩展 options 页可直接点：

- `检查 Relay`
- `测试打开 GMGN`

3. 在监控屏 Chrome profile 继续加载原扩展：

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor
```

监控屏扩展设置里可以配置：

```text
Main Screen Relay Base URL = http://127.0.0.1:17390
```

这个配置在“语音特别关注钱包”模块里，和 Market Watch Desk Base URL 放在一起。修改后点“保存推送设置”即可写入当前 profile 的扩展存储。

## 验证

relay 健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:17390/health
```

`pendingEvents` 表示还没被主屏扩展确认消费的事件；`acknowledgedEvents` 表示主屏扩展已经处理并回写 ack 的事件。

查看主屏扩展心跳：

```powershell
Invoke-RestMethod http://127.0.0.1:17390/clients
```

查看最近事件和 ack 状态：

```powershell
Invoke-RestMethod http://127.0.0.1:17390/events/recent?limit=10
```

`/events` 只返回未 ack 的待消费事件，避免主屏 profile 重装扩展或 cursor 归零后重放旧跳转；历史排查使用 `/events/recent`。

主屏扩展的主路径已经改成 WebSocket：

```text
ws://127.0.0.1:17390/ws?role=main&client=gmgn-main-screen-extension&target=main
```

HTTP `/events` 只作为兜底和排查保留。

也可以运行：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\status-relay.ps1
```

手动发送跳转事件：

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:17390/open-url `
  -ContentType application/json `
  -Body '{"url":"https://gmgn.ai/","source":"manual-test"}'
```

也可以运行：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\send-open-url.ps1 -Url "https://gmgn.ai/"
```

主屏 profile 应打开或复用一个 GMGN 标签页。

真实主屏 profile 验证：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\verify-real-profile.ps1
```

这个脚本适用于你已经在主屏 Chrome profile 里手动加载 `mid-screen-extension/` 的情况。它会等待 `gmgn-main-screen-extension` 心跳，发送一条 `open-url`，并确认该事件被主屏扩展 ack。

检查当前本机 Chrome profile 是否已经出现主屏扩展安装记录：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\check-main-extension-install.ps1
```

## Runtime Notes

- The main-screen extension uses WebSocket `/ws` as the primary event stream.
- It still uses `chrome.alarms` to wake its MV3 service worker and reconnect/fallback-check relay events.
- The main-screen extension does not request global `https://*/*` host permissions.
- The main-screen UI cleanup observer disconnects after the first 20 seconds of a page load.
- The monitor extension only uses relay when `/health` reports a recent main-screen heartbeat. Otherwise it falls back to the old same-profile window logic.
- Relay smoke test:

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
npm start
# in another terminal
npm run smoke
```

- Full local verification:

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\verify-local.ps1
```

- Automated Chrome profile verification:

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\verify-main-extension-chrome.ps1
```

这个自动验证需要 Chrome for Testing 或 Chromium。当前官方 Chrome 137+ 不再支持用 `--load-extension` 命令行加载 unpacked extension；普通 Chrome 需要在真实主屏 profile 的 `chrome://extensions` 里手动 `Load unpacked`。
