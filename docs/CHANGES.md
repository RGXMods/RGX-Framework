# Changes

## Current Release

### [v2.7.2](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.7.2.md) - 2026-08-22

- Fixed deferred WoW frame-event registrations created during framework event
  dispatch. Consumer events registered from `PLAYER_LOGIN`,
  `PLAYER_ENTERING_WORLD`, or another handler now become native frame events
  immediately after the outermost safe dispatch returns.
- Extended the same lifecycle guarantee to registrations created inside RGX
  timer callbacks, closing the second path that could strand callbacks in
  `pendingFrameEvents`.
- Made unit-event unregistration clean up pending and native frame state
  symmetrically while preserving a shared registration when regular handlers
  still exist for the same event.
- Added 35 Lua 5.1 event-lifecycle checks covering login bootstrap, nested
  dispatch, unit events, timers, combat deferral, shared handlers, and
  removal-before-flush. Existing 166 timer and 86 restricted-aura checks remain
  green.
- Published assets are `RGX-Framework-v2.7.2.zip` and `release.json`; the addon
  archive contains 100 runtime files and all six flavor TOCs.

## Recent Releases

### [v2.7.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.7.0.md) - 2026-08-15

- Added declarative named repeating timers with deterministic ordering,
  lifecycle binding, metadata, self-cancellation, and failure isolation.
- Hardened RGXAuras into an accessible-only restricted-value boundary and added
  the corresponding Lua 5.1 runtime and source-conformance coverage.

### [v2.6.2](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.6.2.md) - 2026-08-14

- Synchronized distribution documentation and hardened release/package
  validation across the six supported WoW flavors.

### [v2.6.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.6.1.md) - 2026-08-13

- Restored the single-product framework distribution boundary and aligned
  deterministic package verification.

### [v2.6.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.6.0.md) - 2026-08-13

- Added capability-gated support and verified TOCs for Retail, Classic Era,
  TBC, Wrath/Titan, Cataclysm, and Mists Classic.

### [v2.5.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.5.1.md) - 2026-08-12

- Added the cross-version compatibility layer, hardened aura payload access,
  and shipped accumulated UI and pet-battle fixes.

## Historical Release Notes

Full per-version notes remain in [`docs/changelogs/`](https://github.com/DonnieDice/RGX-Framework/tree/main/docs/changelogs), including releases from v1.x through v2.5.0.
