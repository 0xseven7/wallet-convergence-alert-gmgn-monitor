# 主屏轻量扩展与 Relay 运维手册

## 当前建议

当前先用 Windows 原生 PowerShell relay：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\start-relay.ps1
```

原因：

- 当前主屏和监控屏都在同一台 Windows 机器上。
- `http://127.0.0.1:17390` 已经在两个扩展里可用。
- 不需要额外处理 Mac/WSL 网络、Docker engine、自启动和防火墙。

如果想登录 Windows 后自动启动：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\install-startup.ps1
```

取消自动启动：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\uninstall-startup.ps1
```

## 日常检查

检查 relay 是否在线：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\status-relay.ps1
```

正常状态里应该能看到：

```text
ok: True
relay: http://127.0.0.1:17390
clients: gmgn-main-screen-extension
```

验证主屏真实 profile 链路：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\verify-real-profile.ps1
```

通过时应该看到：

```text
ok: True
acknowledgedBy: gmgn-main-screen-extension
pendingEvents: 0
```

## 两个扩展

主屏 profile 手动加载：

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\mid-screen-extension
```

监控屏 profile 手动加载：

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor
```

主屏轻量扩展只保留：

- relay open-url 接收
- GMGN/FOMO/DEBOT 打开或复用标签页
- 收藏按钮
- counterpart 跳转按钮
- 少量 GMGN UI 清理

监控屏完整扩展继续负责：

- GMGN follow 监控
- 钱包流水和聚合逻辑
- 语音和 Focus Buys 相关功能
- 触发跳主屏时优先发给 relay

## 点击不跳时的排查顺序

1. 先确认 relay 在线：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
.\status-relay.ps1
```

2. 如果 `clients` 里没有 `gmgn-main-screen-extension`，打开主屏 profile 的 GMGN 页面或主屏扩展 options 页面，让扩展唤醒。

3. 运行真实链路验证：

```powershell
.\verify-real-profile.ps1
```

4. 如果真实链路通过，但监控屏点击仍不跳，说明点击入口没有走监控扩展的 redirect/open 路径。当前自动接管主要覆盖 GMGN follow 监控页外跳和扩展按钮，不保证监控 profile 里任意普通页面打开都会被转发。

## Focus Buys 中转

Market Watch 对接细节见：

```text
docs/market-watch-focus-buys-relay-integration.md
```

巨额买入/特别关注钱包买入现在也先写入 relay，不再只直接 POST 到 Market Watch：

```text
监控扩展
  -> POST /focus-buys
  -> relay 持久化 type=focus-buy,target=market-watch
  -> Market Watch 启动后 GET /focus-buys
  -> Market Watch 写入成功后 POST /focus-buys/ack
```

消费接口：

```http
GET http://192.168.3.129:17390/focus-buys?limit=50
```

ack 接口：

```http
POST http://192.168.3.129:17390/focus-buys/ack
Content-Type: application/json

{
  "ids": [1],
  "client": "market-watch"
}
```

如果 relay 不可用，监控扩展会回退到原来的直连 Market Watch：

```text
POST http://127.0.0.1:17387/focus-buys
```

所以正常部署时，监控扩展的 `Main Screen Relay Base URL` 要指向 Mac relay：

```text
http://192.168.3.129:17390
```

## 延迟预期

当前主路径已经改成 WebSocket，relay 收到 `open-url` 后会立即推送给主屏扩展。HTTP `/events` 只作为兜底和排查保留。

```text
Windows 本机 PowerShell relay: 通常几十毫秒到几百毫秒
本机 WSL/Docker relay: 通常额外 1ms - 10ms
Mac Docker relay: 同局域网通常额外 1ms - 20ms
```

体感上，WSL 或 Mac Docker 一般不会明显变慢。真正的延迟主要来自 Chrome service worker 是否已经唤醒、页面打开/聚焦耗时，以及局域网稳定性。

## Docker 方案

本机 Docker/WSL 或 Mac Docker 都可以跑 relay。

本机 Docker 启动：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
docker compose up -d --build
```

停止：

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\relay
docker compose down
```

注意：

- Docker Desktop engine 必须启动。
- 当前 compose 绑定 `127.0.0.1:17390:17390`，适合本机 Chrome 访问。
- 不要同时运行 PowerShell relay 和 Docker relay，它们会抢同一个端口。

## Mac Docker 迁移

如果 relay 放到 Mac Docker，Windows Chrome 不能继续用 `127.0.0.1`，需要改成 Mac 的局域网地址，例如：

```text
http://192.168.3.129:17390
```

Mac 上的 compose 端口需要允许局域网访问：

```yaml
ports:
  - "0.0.0.0:17390:17390"
```

仓库里已经提供 Mac mini 专用 compose 文件：

```bash
cd ~/work/wallet-convergence-alert-gmgn-monitor/relay
docker compose -f docker-compose.macmini.yml up -d --build
```

两个扩展都要同步改配置：

- 主屏轻量扩展 options：`Relay Base URL`
- 监控扩展设置：`Main Screen Relay Base URL`

如果主屏轻量扩展访问 Mac relay，还需要在 `mid-screen-extension/manifest.json` 里加入 Mac 地址 host permission，例如：

```json
"http://192.168.3.129/*"
```

Mac 不能睡眠，否则 relay 会不可用。

## WSL 方案

如果放本机 WSL：

- Windows Chrome 通常可以直接访问 `http://127.0.0.1:17390`。
- 延迟基本可以忽略。
- 需要保证 WSL 或 Docker Desktop backend 常驻。
- Windows 重启后要单独处理自启动。

WSL/Docker 适合后面服务化，但当前最省事的是 Windows 原生 PowerShell relay。

## 当前验证记录

最近一次真实 profile 验证结果：

```text
relay: http://127.0.0.1:17390
acknowledgedBy: gmgn-main-screen-extension
pendingEvents: 0
```

最近一次本地 smoke 验证结果：

```text
verify-local.ps1: passed
eventsAfterAck: 0
eventsWithFutureCursor: 1
websocketPushed: <event id>
```

`eventsWithFutureCursor: 1` 用来确认 relay 重启后，即使主屏扩展本地 cursor 比新事件 id 大，也不会漏掉未 ack 的待消费事件。
