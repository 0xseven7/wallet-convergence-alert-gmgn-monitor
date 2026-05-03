// 运行在 MAIN world，拦截 Socket.IO 长轮询响应解析钱包交易事件
(function () {
  'use strict';
  if (window.__xcpHookInstalled) return;
  window.__xcpHookInstalled = true;

  function postToContent(channel, payload) {
    window.postMessage({ __xcp: true, channel, payload }, '*');
  }

  // ===== 解析 Socket.IO 长轮询响应里的事件 =====
  // 帧格式：42/data,["EVENT_NAME","<json string>"]
  // 多帧用换行 \x1e 或长度前缀 EIO v4 一般直接拼接
  function parseSocketIoFrames(text, sourceUrl) {
    if (!text || text.length < 5) return;
    const isMyChannel = sourceUrl.includes('userId=');
    const channelTag = isMyChannel ? 'my' : 'kol';

    // 多种帧分隔尝试：\x1e (Engine.IO v4 record sep) 或 直接搜索 42/
    const parts = text.split(/\x1e|(?=42\/)/);
    for (const part of parts) {
      if (!part || part.length < 5) continue;
      // 匹配 42/<ns>,[event,data]
      const m = part.match(/^42\/?([^,]*),(\[.+\])$/s);
      if (!m) continue;
      const ns = m[1];
      let arr;
      try { arr = JSON.parse(m[2]); } catch (e) { continue; }
      if (!Array.isArray(arr) || arr.length < 2) continue;

      const eventName = arr[0];
      let data = arr[1];

      // data 通常是 JSON 字符串
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }

      if (eventName === 'FOCUS_WALLET_TRADE' || eventName === 'WALLET_TRADE') {
        postToContent('wallet-trade', {
          source: channelTag,
          ns,
          event: eventName,
          data
        });
      }
      // 其他事件可以先忽略
    }
  }

  // ===== Hook XHR =====
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = null;
    const origOpen = xhr.open;
    xhr.open = function (method, url) {
      _url = url;
      return origOpen.apply(xhr, arguments);
    };
    xhr.addEventListener('load', function () {
      try {
        if (!_url) return;
        if (_url.includes('web-push') && _url.includes('/socket.io/')) {
          parseSocketIoFrames(xhr.responseText, _url);
        }
        // 任何 wallet/focus/group 相关 REST 响应都转给 content 解析
        if (/wallet|focus|group|tracker|kol/i.test(_url) && !_url.includes('socket.io')) {
          const text = xhr.responseText;
          if (text && text.length < 500000) {
            postToContent('rest-resp', { url: _url, text });
          }
        }
      } catch (e) {}
    });
    return xhr;
  }
  for (const k in OrigXHR) {
    try { PatchedXHR[k] = OrigXHR[k]; } catch (e) {}
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // ===== Hook fetch (备用，万一某些走 fetch) =====
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const response = await origFetch.apply(this, arguments);
    try {
      if (url.includes('web-push') && url.includes('/socket.io/')) {
        const cloned = response.clone();
        cloned.text().then(text => parseSocketIoFrames(text, url)).catch(() => {});
      }
    } catch (e) {}
    return response;
  };

  // ===== Hook WebSocket (升级后的连接) =====
  const OrigWS = window.WebSocket;
  function PatchedWS(url, protocols) {
    const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    if (String(url).includes('web-push') && String(url).includes('/socket.io/')) {
      const isMyChannel = String(url).includes('userId=');
      const channelTag = isMyChannel ? 'my' : 'kol';
      ws.addEventListener('message', (ev) => {
        try {
          const data = ev.data;
          if (typeof data !== 'string') return;
          parseSocketIoFrames(data, String(url));
        } catch (e) {}
      });
    }
    return ws;
  }
  PatchedWS.prototype = OrigWS.prototype;
  for (const k in OrigWS) {
    try { PatchedWS[k] = OrigWS[k]; } catch (e) {}
  }
  PatchedWS.CONNECTING = OrigWS.CONNECTING;
  PatchedWS.OPEN = OrigWS.OPEN;
  PatchedWS.CLOSING = OrigWS.CLOSING;
  PatchedWS.CLOSED = OrigWS.CLOSED;
  window.WebSocket = PatchedWS;

  console.log('[XCP] Network hook installed (socket.io parser)');
})();
