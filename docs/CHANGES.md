# Changes

## Current Release

### [v2.7.13](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.13.md) - 2026-10-05

First stable release of the shared UI batch (tested as v2.7.13-beta.1/beta.2):

- Profiles panel preset pagination, confirmed per-row Delete, and
  create-from-current copying.
- Panel `Close()`/`Toggle()` through the safe-hide boundary, including the
  Settings-embedded host.
- New `UI:CreateSwitch` module toggles plus config gear/dialog chrome.
- Slider purpose labels visible with hover-only values; dropdown modern-menu
  restoration and reclaimed inline rows; card layout and reset alignment fixes.
- Regression coverage across profiles, controls, layout, dropdowns, options,
  reset/poison recovery, and six-flavor packaging.

## Recent Releases

### [v2.7.12](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.12.md) - 2026-10-03

- Fixed the CurseForge release upload (metadata must be a plain form
  value, not a file part), completing the distribution chain.
- Settings-embedded options panels now fill the canvas: no more double
  frame or extra background inside the game's Settings window.
- Taller 64px header band with the 42px square suite icon.
- Round/square suite icons regenerated with proper edge-keyed alpha.
- Runtime is consumer-agnostic and CI-enforced: no consumer addon names
  anywhere in core/ or modules/ Lua.
- Classic Era `11509` added to the base TOC.

### Language coverage

RGX-Framework ships complete WoW client locale coverage for its own
user-facing output across all twelve WoW client locales: enUS (base), deDE,
esES, esMX, frFR, itIT, koKR, ptBR, ptPT, ruRU, zhCN, zhTW. The same
coverage list is published in every flavor TOC's `## X-Localizations:`
header and in `README.md`. Consumer addons inherit the
`RGXLocale:NewLocale(addonName, locale, isDefault)` registry convention.


### [v2.7.10](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.10.md) - 2026-10-03

- Database self-heal: metatable-poisoned SavedVariables tables no longer
  loop every read into a C stack overflow; the corrupted entry is logged
  and rebuilt plain with defaults.
- Fixed `card:AutoHeight()` crashing layout construction with an
  arithmetic-on-table error.
- New framework chrome: `UI:CreateCloseButton`, `UI:CreateConfigButton`, and
  `UI:CreateConfigDialog` primitives; options panels consume the shared
  close button.
- Shipped suite brand icons `media/round.tga` (minimap) and
  `media/square.tga` (headers); Wago project ID registered.
- Architecture hardening: contract promoted to `contract/` with shared
  engines, MCP thinned to a transport adapter, module taxonomy + frozen
  31-global public surface + runtime boundary enforcement in shared CI.

### [v2.7.9](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.9.md) - 2026-09-29

- Hardened client metadata compatibility checks when APIs are unavailable.
- Applied framework accent borders to section headers.
- Documented flavor-specific consumer module and options boundaries.

### [v2.7.8](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.8.md) - 2026-09-25

- RGXDesign restyle taking the BugTabs aesthetic: dark navy rounded
  nine-slice panels (12px corners via new `media/panel_rounded.tga`),
  cyan `#00e6ff` primary accent, gold secondary accent, Inter labels
  with locale-safe font fallback and soft text shadows.
- `Design:CreateFrame` rounds by default; pass `opts.square = true` for
  the legacy flat backdrop (exported `Design:ApplyBackdrop` unchanged).
- Minimap `Button:GetAngle` now reads the durable store before
  callback-backed sources, so dragged positions persist for every
  consumer path.
- New `Design:WithTheme(theme, fn)` scoped theme helper: an addon can
  apply its brand color while building its panel, and RGXDesign
  restores its defaults afterwards.
- Options panel tab buttons honor `panel.theme` at runtime: hover and
  active states resolve the panel brand `primary` instead of the
  shared RGXDesign default, and the build-time `Design:SetTheme` is
  restored after construction.

### [v2.7.7](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.7.md) - 2026-09-21

- Fixed the tonumber crash in compat.lua on WoW Forever beta clients. New RGX.API guarded module. Minimap positions prefer durable store. 101 runtime files.

### [v2.7.6](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.6.md) - 2026-09-20

- Durable minimap button positions across the suite: drag angles mirror into `RGXFrameworkDB.RGXMinimapPositions` and restore when an addon's own SavedVariables are lost.

### [v2.7.5](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.5.md) - 2026-09-17

- Added WoW Forever Beta compatibility (Interface `16001` client) via runtime capability detection while retaining Retail `120100` manifest support.
- Uses the interface capability rather than client build `69893` to suppress restricted CLEU registration.
- Skips the generic SharedMedia global scan on Forever to avoid the measured startup hitch.

### [v2.7.4](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.4.md) - 2026-08-23

- Standardized framework chat output as `{icon} - [RGX] {message}` through
  `RGX:CreateChatPrefix()`.
- Added a persistent global login-message gate with `/rgx login on|off|status`
  and the `IsLoginMessagesEnabled`, `SetLoginMessagesEnabled`, and
  `LoginMessage` APIs.
- Routed declarative `welcome` output through the login gate and reduced
  framework startup output to one gated, metadata-derived line.
- Added Lua 5.1 runtime coverage for persistence, command confirmations,
  declarative welcome behavior, prefix formatting, and startup deduplication.

### [v2.7.3](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.3.md) - 2026-08-22

- Fixed `ADDON_ACTION_FORBIDDEN` from the v2.7.2 event-lifecycle flush: deferred
  native registrations now run only from an anonymous next-frame driver, never
  while unwinding an event dispatch, timer dispatch, combat, or pet battle.
- Registration success is verified with `IsEventRegistered`; unsupported or
  repeatedly rejected events are dropped after a bounded attempt cap instead of
  retrying forever. The 2.7.2 deferral guarantee is preserved one frame later.
- Retail no longer registers `COMBAT_LOG_EVENT_UNFILTERED`: new flavor-gated
  `combatLogEvent` capability, `RGXCombat` skips CLEU on Retail 12.x, and
  `RGXCombat:HasCombatLogEvents()` exposes the degraded surface.
- Event-lifecycle runtime coverage extended from 35 to 66 checks.
- Published assets are `RGX-Framework-v2.7.3.zip` and `release.json`; the addon
  archive contains 100 runtime files and all six flavor TOCs.

### [v2.7.2](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.2.md) - 2026-08-22

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

### [v2.7.0](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.0.md) - 2026-08-15

- Added declarative named repeating timers with deterministic ordering,
  lifecycle binding, metadata, self-cancellation, and failure isolation.
- Hardened RGXAuras into an accessible-only restricted-value boundary and added
  the corresponding Lua 5.1 runtime and source-conformance coverage.

### [v2.6.2](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.2.md) - 2026-08-14

- Synchronized distribution documentation and hardened release/package
  validation across the six supported WoW flavors.

### [v2.6.1](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.1.md) - 2026-08-13

- Restored the single-product framework distribution boundary and aligned
  deterministic package verification.

### [v2.6.0](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.0.md) - 2026-08-13

- Added capability-gated support and verified TOCs for Retail, Classic Era,
  TBC, Wrath/Titan, Cataclysm, and Mists Classic.

### [v2.5.1](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.5.1.md) - 2026-08-12

- Added the cross-version compatibility layer, hardened aura payload access,
  and shipped accumulated UI and pet-battle fixes.

## Historical Release Notes

Full per-version notes remain in [`docs/changelogs/`](https://github.com/RGXMods/RGX-Framework/tree/main/docs/changelogs), including releases from v1.x through v2.5.0. The 2.7.13 beta channel (beta.1, beta.2) was promoted to stable as v2.7.13; its notes remain in [`docs/changelogs/`](https://github.com/RGXMods/RGX-Framework/tree/main/docs/changelogs).

## Beta — v2.7.14-beta.1

Opt-in beta; stable remains v2.7.13. See
[beta notes](changelogs/2.7.14-beta.1.md) for additions and tester checks.
