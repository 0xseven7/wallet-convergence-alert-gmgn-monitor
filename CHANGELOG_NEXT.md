## v1.9.4 - GMGN monitor and aggregation refinements

This build focuses on making GMGN follow monitoring more stable, easier to read, and less noisy in day-to-day use.

- Aggregate buy alerts are now easier to read and control
  - Default sorting is by buyer count, with optional sorting by latest or market cap
  - Added chain filtering for `All / BSC / ETH / BASE / SOL`
  - Chain labels now use clearer color badges in both the status bar and alert cards
  - Market cap is highlighted more clearly inside aggregate cards

- Aggregate signal handling is more accurate
  - Added sell-pool tracking alongside buy and close tracking
  - Fixed stale or incorrect market-cap display in aggregate cards
  - Fixed repeated resort/re-render loops caused by unstable row timing
  - Disabled multi-page shared aggregation so one GMGN follow page can aggregate directly across mixed chains shown in that page

- Wallet-focused workflows were refined
  - Starred wallets can still surface low-count aggregate entries, but no longer trigger overly heavy visual emphasis
  - Added blacklist wallet markers and quick blacklist toggles inside aggregate cards
  - Watched-wallet speech now sounds more natural and includes chain-specific quote assets such as `BNB`, `ETH`, and `baseETH`

- Twitter voice alerts were improved
  - Speech now prefers `remark`, then GMGN `name`, before falling back further
  - Added clearer action wording and natural pauses in TTS
  - Tweet deletions now announce correctly
  - Background GMGN tabs no longer duplicate Twitter voice playback

- GMGN page cleanup was expanded
  - Removes prediction navigation links
  - Removes `CookingCoinButton` nodes and related `Cook / cooking` navigation entries
