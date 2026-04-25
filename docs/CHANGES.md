# v1.4.0 - 2026-04-25

## Core — Lifecycle Shortcuts
- Added `RGX:OnLogin(fn)` — run a callback when the player logs in. Addon authors no longer need to know that `PLAYER_LOGIN` exists.
- Added `RGX:OnLoad(addonName, fn)` — run a callback when a specific addon finishes loading. Hides `ADDON_LOADED`.
- Added `RGX:Minimap(config)` — one-call minimap button creation; shortcut for `RGX:GetMinimap():Create(config)`.

These three methods are the primary entry point for new addon authors. The result is a working addon in ~10 lines with no WoW event names, no frame creation, and no compat boilerplate. `RegisterEvent`, timers, and the full module APIs remain for advanced use.
