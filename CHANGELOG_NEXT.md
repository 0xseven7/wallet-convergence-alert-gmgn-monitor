## v1.9.6 - GMGN stability and routing refinement

This build focuses on reducing false replays in GMGN aggregate alerts, making cross-window navigation cleaner, and improving live alert audibility.

- GMGN aggregate alerts are more stable under heavy pools
  - Fixed a replay path where active tokens could be pushed out of the visible 30-card tray and retriggered as new alerts
  - Kept full aggregate state internally while limiting only the rendered tray count
  - Improved token-name parsing so inline SVG icon text no longer pollutes token names like `S STOCK`

- Main-window routing is less noisy
  - When a monitor jump target already exists in the main browser window, the extension now reuses that tab instead of opening duplicates

- Alert audio is easier to hear and tune
  - Unified the settings-page volume slider for GMGN and Twitter alerts
  - Raised supported playback gain to 200 percent for audio-file and remote-TTS playback paths
