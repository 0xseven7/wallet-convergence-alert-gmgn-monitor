# GMGN Main Screen Helper

This is the lightweight extension for the main-screen Chrome profile.

It intentionally does not include the monitor-screen scripts from the full extension.

## Included

- `gmgn/token-quick-add.js`: floating favorite and counterpart buttons
- `gmgn/ui-cleanup.js`: small GMGN header cleanup
- `fast-open/`: event-driven X and GMGN warm-tab navigation bridge
- `background.js`: quick-add API calls and relay WebSocket event handling

## Performance Boundary

- No monitor DOM scanner.
- No wallet stream parser.
- No global `https://*/*` host permission.
- UI cleanup does not observe full-page mutations. It runs a few idle, header/nav-scoped cleanup passes after load and is not injected on GMGN address pages.
- The GMGN address-page Focus button uses delayed idle rendering and avoids backdrop blur so wallet pages stay smooth during initial load.
- Relay navigation uses WebSocket `/ws` as the primary event stream, with HTTP `/events` kept as fallback.
- X and GMGN each use their own extension-owned warm tab. GMGN `/follow` monitor tabs are never reused.
- Fast open has no DOM observer or polling loop. If same-document navigation does not render, it falls back to a normal tab navigation.

## Not Included

- GMGN follow monitor DOM scanner
- wallet trade stream parsing
- convergence alert logic
- speech/audio watchlist
- Twitter trigger hook

## Settings

Open the extension options page and keep defaults unless needed:

- Relay Base URL: `https://market-watch.macmini.lan`
- Market Watch Desk Base URL: `http://127.0.0.1:17387`
- Open mode: reuse tab

The options page also includes:

- Check Relay: verifies `GET /health` and `GET /clients`.
- Test Open GMGN: opens `https://gmgn.ai/` in the current main-screen profile.

## Load Path

```text
C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\mid-screen-extension
```
