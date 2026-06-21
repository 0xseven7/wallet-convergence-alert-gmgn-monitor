# GMGN Doubao TTS Proxy

这个服务把浏览器插件的 `/tts` 请求转发到火山引擎豆包语音，并把返回的 base64 音频解码成 MP3。插件里不保存火山密钥。

## 为什么不直接放插件里

- Chrome 扩展里的 JS 可以被用户和网页调试工具看到，不能放 `Access Token`。
- 代理可以跑在本机、Mac 或局域网机器上，访问火山引擎国内节点通常比 Cloudflare Worker 更稳。
- 代理内置短缓存，相同播报文本会直接复用音频，减少延迟和调用量。

## 本机运行

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\tts-proxy
Copy-Item .env.example .env
notepad .env
npm start
```

插件设置页里把 `TTS 代理地址` 改成：

```text
http://127.0.0.1:8788/tts
```

## Docker 运行

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\tts-proxy
Copy-Item .env.example .env
notepad .env
docker build -t gmgn-doubao-tts .
docker run --name gmgn-doubao-tts --env-file .env -p 8788:8788 --restart unless-stopped gmgn-doubao-tts
```

如果放在局域网另一台机器，把插件设置成：

```text
http://<那台机器的局域网IP>:8788/tts
```

## 可选：Cloudflare Worker

如果你仍然想按现有插件原来的方式走 Worker，可以把 `cloudflare-worker.mjs` 部署到 Cloudflare Workers，然后配置这些环境变量：

```text
VOLC_TTS_APP_ID
VOLC_TTS_ACCESS_TOKEN
VOLC_TTS_CLUSTER
VOLC_TTS_VOICE_TYPE
```

部署后插件里填写：

```text
https://<你的-worker域名>/tts
```

国内本地访问 Cloudflare Worker 可能出现高延迟、间歇不可达或被运营商路由绕远。抢时间的语音提醒不建议把 CF 作为唯一链路，优先用本机或局域网 Docker。

## 需要的火山参数

- `VOLC_TTS_APP_ID`: 火山引擎控制台里的 AppID。
- `VOLC_TTS_ACCESS_TOKEN`: 火山引擎控制台里的 Access Token。
- `VOLC_TTS_CLUSTER`: 通常是 `volcano_tts`，以控制台实际值为准。
- `VOLC_TTS_VOICE_TYPE`: 你要使用的豆包音色 ID，例如文档里的 `zh_female_cancan_mars_bigtts`。

## 健康检查

```powershell
Invoke-RestMethod http://127.0.0.1:8788/health
```

## 试听接口

```powershell
$body = @{ text = '西瓜，买入了 1 BNB pepe'; rate = '+0%'; pitch = '+0%' } | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:8788/tts -Method Post -ContentType 'application/json' -Body $body -OutFile test.mp3
```
