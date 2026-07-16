# Monitor Extension Handbook

This handbook captures the recent monitor-screen regressions, their root causes,
and the exact handling rules for future Codex threads.

All Chinese UI labels are written as Unicode escapes to avoid Windows terminal
encoding issues. Key labels:

- `\u8bbe\u4e3a\u76d1\u63a7\u5c4f` = "set as monitor screen"
- `\u5df2\u8bbe\u4e3a\u76d1\u63a7\u5c4f` = "already set as monitor screen"
- `\u805a\u5408\u4e70\u5165\u6258\u76d8` = aggregate buy tray

## Current Architecture

- Monitor extension path: `C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor`
- Main-screen lightweight extension path: `C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\mid-screen-extension`
- Official relay project path: `C:\Users\zx\work\relay`
- Historical in-repo relay docs still exist, but new relay project work should not be maintained in this folder unless the user explicitly asks.

The monitor extension should own:

- GMGN follow-page wallet-trade scanning.
- Aggregate buy tray.
- Twitter / watched-wallet audio alerts.
- Monitor-profile link handoff to relay/main screen.

The main-screen extension should stay lightweight:

- Receive relay open-url events.
- Open or reuse GMGN/FOMO/DEBOT tabs in the main profile.
- Keep small UI helpers such as favorite and counterpart buttons.
- Do not run monitor-screen DOM scanners or aggregation logic.

## Monitor Screen State

The monitor tray must only appear in the explicitly selected monitor window.

State owner:

- `background.js`
- `MONITOR_STATE_STORAGE_KEY = 'monitorState'`
- message: `GET_MONITOR_SCREEN_STATUS_MESSAGE = 'get-monitor-screen-status'`
- setter: `setMonitorScreenFromTab()`
- status builder: `buildMonitorScreenStatus()`

Runtime gate:

- `gmgn/content.js`
- `isMonitorWindowPage()` must require `monitorScreenActive`.
- A GMGN follow URL alone must not mount the tray.

UI entry:

- `gmgn/redirector.js`
- GMGN follow page shows a page button with id `gcp-monitor-screen-toggle`.
- The button text is `\u8bbe\u4e3a\u76d1\u63a7\u5c4f` or `\u5df2\u8bbe\u4e3a\u76d1\u63a7\u5c4f`.

User operation:

1. Reload the monitor extension in `chrome://extensions` after code changes.
2. In the intended monitor Chrome window, open a GMGN follow page.
3. Click the lower-right page button `gcp-monitor-screen-toggle`.
4. The aggregate buy tray should mount only in that window.

Important rule:

- The extension icon must open the settings page.
- Do not reuse the extension icon to set the monitor screen.

Regression guard:

```powershell
node tests/monitor-screen-gating.test.js
```

## Issue: Other Windows Also Show The Tray

Symptom:

- After removing the old "set this screen as main screen" flow, another window in the same Chrome profile also showed the aggregate buy tray.

Root cause:

- The old logic inferred monitor status from GMGN follow URLs.
- Any same-profile window on a follow page could be treated as monitor.

Fix:

- Removed automatic `findMonitorCandidate()` usage from `ensureMonitorState()`.
- Added explicit status query through `GET_MONITOR_SCREEN_STATUS_MESSAGE`.
- Gated `gmgn/content.js` tray startup behind `monitorScreenActive`.
- Added the visible `gcp-monitor-screen-toggle` page button in `gmgn/redirector.js`.

Files:

- `background.js`
- `gmgn/content.js`
- `gmgn/redirector.js`
- `tests/monitor-screen-gating.test.js`

Do not reintroduce:

- Any "follow URL means monitor window" inference.
- Any automatic scanning of all normal windows to pick a monitor candidate.

## Issue: Extension Icon Cannot Open Settings

Symptom:

- On the monitor GMGN follow page, clicking the extension icon did not open settings.

Root cause:

- `chrome.action.onClicked` had been reused to call `setMonitorScreenFromTab()` when the current tab was a follow page.
- That branch returned before `openSettingsPageInWindow()`.

Fix:

- `chrome.action.onClicked` now always calls `openSettingsPageInWindow()`.
- Monitor-screen selection only happens through the GMGN page button.

Files:

- `background.js`
- `tests/monitor-screen-gating.test.js`

Regression guard:

```powershell
node tests/monitor-screen-gating.test.js
```

## Issue: Tray Disappears After Refresh Or Tab Churn

Symptom:

- The selected monitor screen lost the aggregate buy tray.
- The user could not tell where to set the monitor screen again.

Root cause:

- Monitor ownership was conceptually window-scoped but still partially stored as a specific `tabId`.
- When the original selected tab closed, refreshed oddly, or was no longer found, the code cleared both `tabId` and `windowId`.
- Once `monitorState.windowId` became null, `gmgn/content.js` saw `monitorScreenActive = false` and unloaded the tray.

Fix:

- Keep monitor state window-scoped.
- If the selected tab is gone but its containing window still exists, clear only `tabId` and preserve `windowId`.
- Only clear monitor ownership when the whole Chrome window is closing.

Files:

- `background.js`
- `tests/monitor-screen-gating.test.js`

Key checks:

- `chrome.tabs.onRemoved` should inspect `removeInfo.isWindowClosing`.
- `ensureMonitorState()` should validate `windowId` with `findWindowById()`.
- `monitorState.windowId` must survive normal tab churn.

Regression guard:

```powershell
node tests/monitor-screen-gating.test.js
```

## Issue: Audio Disappears After Refresh

Symptom:

- After refreshing the monitor page, aggregate buy stage audio and Twitter audio both stopped.
- Playing the settings-page sample or opening DevTools made audio work again.

Root cause:

- This was blocked playback, not settings loss.
- In `gmgn/content.js`, `playSound()` returned early when `AudioContext.state === 'suspended'`.
- In `gmgn/twitter-audio-content.js`, autoplay-blocked `Audio.play()` failures were not retried.

Fix:

- `gmgn/content.js` now tries to resume the audio context.
- If WebAudio is blocked, it keeps the latest aggregate cue for a short retry window.
- Watched-wallet TTS also queues briefly when autoplay blocks playback.
- `gmgn/twitter-audio-content.js` classifies `NotAllowedError` / autoplay failures separately from network TTS failures.
- Twitter playback blocked by browser policy is retried after pointer/key/focus/visibility activation events.

Files:

- `gmgn/content.js`
- `gmgn/twitter-audio-content.js`
- `tests/audio-unlock-regression.test.js`
- `tests/twitter-audio-content.test.js`

Regression guards:

```powershell
node tests/audio-unlock-regression.test.js
node tests/twitter-audio-content.test.js
```

If this still fails in Chrome:

- Move audio playback to an extension offscreen document.
- Do not keep stacking page-level autoplay workarounds forever.

## Standard Verification Commands

Run these after touching monitor-screen ownership, tray gating, or audio:

```powershell
node --check background.js
node --check gmgn/content.js
node --check gmgn/redirector.js
node --check gmgn/twitter-audio-content.js
node tests/monitor-screen-gating.test.js
node tests/audio-unlock-regression.test.js
node tests/twitter-audio-content.test.js
node tests/gmgn-content-url-parser.test.js
node tests/gmgn-token-quick-add.test.js
```

Run relay/main-screen checks only when the change touches relay URLs or main-screen handoff:

```powershell
node tests/relay-site-redirector.test.js
node tests/mid-screen-ui-cleanup.test.js
```

Also run:

```powershell
git diff --check
```

Known harmless warning:

- `tests/twitter-audio-content.test.js` may emit a CRLF/LF conversion warning on Windows.

## Debug Checklist For Other Threads

When the tray is missing:

1. Confirm the monitor extension has been reloaded after code changes.
2. Open GMGN follow in the intended monitor Chrome window.
3. Look for the lower-right `gcp-monitor-screen-toggle` page button.
4. Click it and verify the button changes from `\u8bbe\u4e3a\u76d1\u63a7\u5c4f` to `\u5df2\u8bbe\u4e3a\u76d1\u63a7\u5c4f`.
5. If the button is missing, inspect `gmgn/redirector.js` injection and manifest content scripts.
6. If the button exists but tray is missing, inspect `background.js -> buildMonitorScreenStatus()` and `gmgn/content.js -> monitorScreenActive`.
7. Do not solve by allowing all follow pages to mount the tray.

When settings cannot open:

1. Inspect `background.js -> chrome.action.onClicked`.
2. It should only call `openSettingsPageInWindow()`.
3. It should not call `setMonitorScreenFromTab()`.

When audio is missing:

1. Check whether the page was just refreshed.
2. Inspect console logs for `AudioContext.state === 'suspended'`, `NotAllowedError`, or autoplay messages.
3. Settings sample playback restoring audio points to browser audio activation, not lost settings.
4. Keep the audio unlock retry path in place.

When another screen shows the tray:

1. Check whether URL-only detection has been reintroduced.
2. `isMonitorWindowPage()` must include `monitorScreenActive`.
3. `ensureMonitorState()` must not auto-discover monitor candidates from open follow pages.

