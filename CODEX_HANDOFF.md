# GMGN Monitor / Focus Wallet Handoff

Last updated: 2026-07-15

This file is for continuing the current GMGN monitor / Relay work in another
Codex thread.

## Current Workspaces

- Monitor extension: `C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor`
- Main-screen lightweight extension: `C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor\mid-screen-extension`
- Official Relay project: `C:\Users\zx\work\relay`
- Historical Relay files under the monitor repo should not be maintained unless the user explicitly asks.

The worktree is dirty from multiple prior changes. Do not reset or revert broad files.
Only touch the files required by the current request.

## Current Goal

Focus Wallet should mean the wallets the user adds from GMGN address pages or
from existing watched-wallet flows.

Expected behavior:

1. On a GMGN address page, the monitor extension shows `Add Focus`.
2. Clicking it writes the wallet to `chrome.storage.local.gmgnFocusAddresses`.
3. In the same Chrome profile, another screen/window using the same extension can read it automatically through `chrome.storage.onChanged`.
4. Relay is only needed for cross-profile, cross-machine, Mac mini, or central persistence use cases.
5. When the GMGN follow stream sees that wallet buy/open/add, the aggregate tray treats it as a priority / Focus wallet and can trigger TTS and Focus Buys.

## Add Focus Flow

Frontend content script:

- `gmgn/focus-address-quick-add.js`
- Parses GMGN address routes such as:
  - `https://gmgn.ai/sol/address/{address}`
  - `https://gmgn.ai/address/{address}?chain=base`
  - `https://gmgn.ai/robinhood/address/{address}`
- Sends runtime message:
  - `type: 'gmgn-focus-address-quick-add'`
  - `source: 'gmgn-monitor-address-page'`

Background handler:

- `background.js`
- `quickAddGmgnFocusAddress()`
- Writes to `GMGN_FOCUS_ADDRESSES_KEY = 'gmgnFocusAddresses'` first.
- Then calls Relay `/focus-addresses` as best-effort sync.

Monitor tray reader:

- `gmgn/content.js`
- Loads `gmgnFocusAddresses` through `loadFocusAddresses()`.
- Listens through `chrome.storage.onChanged` in `handleSharedStorageChange()`.
- Relay pull happens in `syncFocusAddressesFromRelay()`.
- `mergeRelayFocusAddressesWithLocal()` preserves local/manual entries so Relay sync does not erase same-profile additions.

Important same-profile rule:

- Two screens in the same Chrome profile share the same `chrome.storage.local`.
- If screen A clicks `Add Focus`, screen B should see it without Relay, as long as screen B has the content script running and the extension has been reloaded.

## Relay Focus Address API

Official project:

```powershell
cd C:\Users\zx\work\relay
```

Endpoints:

- `POST /focus-addresses`
- `GET /focus-addresses`
- `GET /focus-addresses?chain=sol&address=...`
- `DELETE /focus-addresses?chain=sol&address=...`

Supported chain values after current local edits:

```text
sol, eth, bsc, base, tron, blast, robinhood
```

Aliases now accepted by Relay:

- `solana -> sol`
- `ethereum -> eth`
- `bnb`, `binance`, `binance-smart-chain -> bsc`
- `rh`, `robin`, `Robinhood Chain -> robinhood`

Important deployment note:

- These Relay changes are local in `C:\Users\zx\work\relay`.
- Mac mini will not pick them up until Relay is deployed/restarted there.

## Focus Wallet Speech Toggle

Tray quick toggle:

- Button class: `.gcp-focus-speech-btn`
- File: `gmgn/content.js`
- Style: `gmgn/styles.css`
- State key: `gmgnAudioSettings.ttsEnabled`

Behavior:

- `TTS` means Focus Wallet TTS is on.
- `TTS-` means Focus Wallet TTS is off.
- This must not reuse the global sound bell.
- The global sound bell controls aggregate bell/audio through `config.soundEnabled`.
- Focus Wallet speech is guarded by:
  - `config.soundEnabled`
  - `audioSettings.enabled`
  - `audioSettings.ttsEnabled`

## Monitor Screen Ownership

Only the selected monitor window should show the aggregate tray.

Owner:

- `background.js`
- Storage key: `monitorState`
- Message: `get-monitor-screen-status`

Page button:

- `gmgn/redirector.js`
- Button id: `gcp-monitor-screen-toggle`

Rules:

- Extension icon opens settings.
- Do not use extension icon to set monitor screen.
- Do not infer monitor screen only from GMGN follow URL.
- `gmgn/content.js -> isMonitorWindowPage()` must require `monitorScreenActive`.

## Common Failure Modes

### Add Focus shows failure

Check:

1. Monitor extension was reloaded in `chrome://extensions`.
2. GMGN page was refreshed after reload.
3. `background.js` contains the `gmgn-focus-address-quick-add` handler.
4. Address route parses in `gmgn/focus-address-quick-add.js`.
5. If a separate frontend posts directly to Relay, Mac mini Relay must be the new version that supports `robinhood`.

Note:

- The monitor button writes local storage before Relay sync.
- If the monitor button itself fails, Relay is usually not the first cause; likely old extension/background, invalid payload, or runtime message error.
- If a web frontend calls Relay directly, old Relay can be the cause.

### Another screen does not see the new Focus Wallet

Check:

1. Both screens are really the same Chrome profile.
2. Both screens load the same unpacked extension version.
3. The monitor screen was explicitly selected through `gcp-monitor-screen-toggle`.
4. `gmgn/content.js` has called `startSharedPoolSync()`, which registers `chrome.storage.onChanged`.
5. `chrome.storage.local.gmgnFocusAddresses` contains the new entry.

### Relay sync erases a local Focus Wallet

This should be fixed by `mergeRelayFocusAddressesWithLocal()`.
Do not replace that merge with plain `applyFocusAddresses(body.items)`.

### Focus Wallet TTS mutes the wrong audio

Do not wire the tray TTS button to `config.soundEnabled`.
It must toggle only `gmgnAudioSettings.ttsEnabled`.

## Verification Commands

Monitor extension:

```powershell
cd C:\Users\zx\work\wallet-convergence-alert-gmgn-monitor
node --check background.js
node --check gmgn/content.js
node --check gmgn/focus-address-quick-add.js
node tests/monitor-focus-address-quick-add.test.js
node tests/monitor-focus-speech-toggle.test.js
node tests/monitor-screen-gating.test.js
node tests/audio-unlock-regression.test.js
node tests/gmgn-content-url-parser.test.js
git diff --check -- background.js gmgn/content.js gmgn/styles.css gmgn/focus-address-quick-add.js tests/monitor-focus-address-quick-add.test.js tests/monitor-focus-speech-toggle.test.js
```

Relay:

```powershell
cd C:\Users\zx\work\relay
pnpm run check
git diff --check -- server.js smoke-test.js API.md
```

Optional live smoke after starting Relay:

```powershell
cd C:\Users\zx\work\relay
pnpm run smoke
```

## Deployment / Reload Checklist

After monitor extension edits:

1. Open `chrome://extensions` in the relevant Chrome profile.
2. Reload the unpacked monitor extension.
3. Refresh the GMGN follow/address pages.
4. Re-select monitor screen if needed with `gcp-monitor-screen-toggle`.

After Relay edits:

1. Deploy `C:\Users\zx\work\relay` to Mac mini runtime path.
2. Restart the Relay service/process on Mac mini.
3. Verify `/health`.
4. Verify `POST /focus-addresses` for `robinhood` if that chain is involved.

## Key Files

Monitor extension:

- `manifest.json`
- `background.js`
- `gmgn/content.js`
- `gmgn/redirector.js`
- `gmgn/focus-address-quick-add.js`
- `gmgn/styles.css`
- `tests/monitor-focus-address-quick-add.test.js`
- `tests/monitor-focus-speech-toggle.test.js`
- `tests/monitor-screen-gating.test.js`
- `tests/audio-unlock-regression.test.js`

Relay:

- `C:\Users\zx\work\relay\server.js`
- `C:\Users\zx\work\relay\smoke-test.js`
- `C:\Users\zx\work\relay\API.md`

## High-Level Mental Model

- GMGN page data still comes from the monitor page DOM/network hooks.
- Focus Wallet membership is a list.
- In one Chrome profile, that list is shared through `chrome.storage.local`.
- Across profiles or machines, that list should be centralized through Relay.
- Relay is not the source of GMGN trade events; it is a handoff and persistence layer.
