## v1.9.5 - GMGN aggregate control and release cleanup

This build focuses on making the GMGN aggregate panel easier to control in live use and cleaning up stale release behavior.

- GMGN aggregate alerts are easier to manage
  - Added per-token hide buttons inside aggregate cards
  - Hidden cards stay hidden until that token gets a fresh buy again
  - Empty-state copy now distinguishes between chain filtering and manually hidden alerts

- Aggregate alert behavior is easier to diagnose
  - Added debug logs around aggregate alert creation, replay, trimming, and sound playback
  - Aggregate sounds now support chain-specific sound profiles when a qualifying alert fires

- Release-check noise was removed
  - Disabled GitHub release version detection in both GMGN and xxyy content scripts
  - Removed the old “new version available” runtime behavior from daily usage
