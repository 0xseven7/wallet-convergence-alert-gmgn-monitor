# Relay open-url 外链策略需求

## 背景

当前监控窗口页面运行在：

```text
https://market-watch.macmini.lan/
```

该页面里的所有向外跳转，都需要转发到主屏 Chrome profile 打开，不能在监控屏 profile 里打开。

本仓库已经在监控扩展里做了拦截：

- `relay-site-open-bridge.js`：拦截该页面脚本里的 `window.open`
- `relay-site-redirector.js`：拦截该页面里的外链点击和外部 form submit
- 转发消息会带上 `source: "monitor-relay-site"` 和 `payload.sourceOrigin`

正式 relay 项目不在本仓库维护，后续如需调整服务端策略，应在：

```text
C:\Users\zx\work\relay
```

里完成。

## 当前阻塞

`C:\Users\zx\work\relay\server.js` 里的 `/open-url` 校验目前只允许固定白名单域名。

因此当前项目即使已经把 `https://market-watch.macmini.lan/` 的外链 POST 到 `/open-url`，relay 服务端仍可能拒绝非白名单 URL。

## 需求

当事件满足以下条件时，`/open-url` 应允许普通 `http:` / `https:` URL：

- `type` 为 `open-url`
- `target` 为 `main`
- `source` 为 `monitor-relay-site`
- `payload.sourceOrigin` 为：

```text
https://market-watch.macmini.lan
```

必须继续拒绝以下协议：

```text
javascript:
data:
file:
chrome:
chrome-extension:
about:
```

relay 入队和 WebSocket 推送时，需要保留：

```json
{
  "source": "monitor-relay-site",
  "payload": {
    "sourceOrigin": "https://market-watch.macmini.lan"
  }
}
```

主屏扩展会用该来源识别这是监控窗口的可信外链事件。

## 验收

1. 从监控窗口 `https://market-watch.macmini.lan/` 点击任意外部 `https:` 链接，主屏 profile 打开目标链接，监控窗口不新开页面。
2. 同源链接，例如 `https://market-watch.macmini.lan/...`，仍然在监控窗口页面内正常跳转。
3. `/open-url` 对 `javascript:`、`data:`、`file:` 等非网页协议继续返回错误。
4. `/events/recent` 或 WebSocket 事件里能看到 `source: "monitor-relay-site"`。
