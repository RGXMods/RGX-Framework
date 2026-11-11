# Changes

## Current Release

### [v2.17.3](changelogs/2.17.3.md) - 2026-11-10

- `UI:CreateStandardCard` takes `addonMenu = false` and `loginMessage = false` to omit those switches.

### [v2.17.2](changelogs/2.17.2.md) - 2026-11-10

- `RGX:CreateChat` prints the standard RGX prefix, `icon - [Label] message` (the `RGX:CreateChatPrefix` format), with `label`, `icon` and `tagColor` options.

### [v2.17.1](changelogs/2.17.1.md) - 2026-11-10

- `UI:CreateStandardCard` takes `description = false` and `prefix = false` to omit the muted line under the title and the chat-prefix box.

### [v2.17.0](changelogs/2.17.0.md) - 2026-11-10

- `UI:CreateStandardCard`: one card with the options every mod shares (minimap icon, Addons-menu entry, chat output, login message, chat prefix).
- `RGX:CreateChat`: addon chat with the shared prefix and on/off rules.

### [v2.16.0](changelogs/2.16.0.md) - 2026-11-09

- Minimap buttons can show or hide their Addons-menu entry at runtime (`SetCompartmentVisible`).
- New shared addon release kit: guide plus templates for the GitHub workflow, `.pkgmeta` and GitLab CI.

### [v2.15.2](changelogs/2.15.2.md) - 2026-11-07

- Rounded buttons keep the building mod's hover ring colour; `WithTheme` and `WithStyle` return the builder's results.

### [v2.15.1](changelogs/2.15.1.md) - 2026-11-07

- Every interface style is branded by the mod's own primary and accent colours. RGX Material Round's ring now follows `primary` and its card titles follow `accent`, instead of a fixed red and coral.

### [v2.15.0](changelogs/2.15.0.md) - 2026-11-07

- New **RGX Material Round** interface style (rounded cards, header bands and buttons on grey with the RGX red ring), a drop-in for every RGX addon.
- Styles are named **RGX Framework**, **RGX Material Round** and **RGX Classic**; `retail` and `forever` remain as aliases.
- Added `Design:WithStyle` for building one addon's UI in a style without changing the operator's choice.

### [v2.14.2](changelogs/2.14.2.md) - 2026-11-05

- Addons can pass their own palette to dropdown list frames (`ForceWidth` `opts.skin`) and inline buttons (`AddInlineButton` `opts.colors`).

### [v2.14.1](changelogs/2.14.1.md) - 2026-11-05

- Dropdown list frames opened through `ForceWidth` use the design-system theme, and inline Play buttons stay inside the row.
- Release zips avoid a boot-sector byte signature that Wago rejected.

### [v2.14.0](changelogs/2.14.0.md) - 2026-11-05

- Added `RGXLoot:OnItemLooted` (any new item) and `RGXHonor:OnHonorGain`; `OnRareLoot` no longer repeats for items that stay flagged new.
- The dropdown inline Play button is themed with the design system and keeps clear of the frame edge.
- Release tooling publishes the exact CurseForge and Wago game version per flavor.

### [v2.13.0](changelogs/2.13.0.md) - 2026-11-05

- Every button created with `RGXMinimap:Create` is now also listed in Blizzard's Addons menu on the minimap (the addon compartment), with the same icon, tooltip, left click and right click.
- Added `compartment = false` to opt a button out and `compartmentText` to set the menu label.
- Clients without the addon compartment are unchanged.

### [v2.12.0](changelogs/2.12.0.md) - 2026-11-03

- Added `onPreview` to `CreateNestedDropdown`: a Play/Stop button on each leaf with a value. Use `isPreviewing`, `previewLabel` and `previewStopLabel` to control it, and set `item.preview = false` to skip a row.
- Menus with `onPreview` use the UIDropDownMenu path, where the framework reserves row width for the button.
- Added `holder:RefreshPreviews()` to re-read Play/Stop labels after playback ends.
- Play buttons are cleared whenever a dropdown builds a menu level, because menu rows are shared between dropdowns.
- Documented the Play button API in `docs/DROPDOWNS.md`.

### [v2.8.2](changelogs/2.8.2.md) - 2026-10-19

- Added the declarative `compat` key: first callable global API path wins,
  optional normalize repacks return values, and missing paths fail before
  registration.
- The runtime package now ships the expanded `AGENTS.md` project entry point in
  place of `AGENT-DIRECTIVE.md`; the file count is unchanged.

### [v2.8.1](changelogs/2.8.1.md) - 2026-10-19

- Repaired the WoW reference cache and added inventory/freshness checks.
- Restored `modules/` for game-domain modules; library modules remain under
  `libraries/`.
- Namespaced framework slash commands as `/rgxframework` and `/rgxf`, keeping
  `/rgx` as a legacy alias.
- Colocated library-owned media and kept legacy font paths resolving.
- Added the shipped `AGENT-DIRECTIVE.md`; public APIs and client Interfaces are
  unchanged.

### [v2.8.0](changelogs/2.8.0.md) - 2026-10-17

- New `RGXTimers` library module (`RGX:GetTimers()`, global `RGXTimers`) adds
  frame-based countdown/progress bars that replace LibCandyBar-3.0 for consumer
  addons: native frame methods on every bar, completion and cancel callbacks,
  and `exp`/`start` stamps for pooled sorting.
- `docs/TIMERS.md` documents the module with a LibCandyBar mapping table; the
  API catalog gains the `timers` entry and an 11-scenario Lua 5.1 harness runs
  in `lua-runtime-check`.
- Current public APIs and client Interfaces are unchanged. No SavedVariables
  deletion is required.

## Recent Releases

### [v2.7.20](changelogs/2.7.20.md) - 2026-10-17

- Minimap buttons created through `RGX.Addon` now persist their visibility when
  the consumer addon does not declare its own database; storage falls back to
  the framework SavedVariables while consumer-owned databases keep their
  existing behavior.
- Lua 5.1 regression coverage documents the fallback; current public APIs and
  client Interfaces are unchanged. No SavedVariables deletion is required.

## Recent Releases

### [v2.7.19](changelogs/2.7.19.md) - 2026-10-17

- The login scan no longer treats the framework's own `RGXSharedMedia`
  registry as a generic addon global or re-bridges sound paths a live entry
  still claims, removing the redundant work flagged by the
  `[RGX:timer-slow] SharedMedia:QueueScan` budget warning.
- World-map pin and waypoint primitives (`RGXWorldMap`) ship with pin lifecycle
  on the world map and minimap plus a zone-data adapter over `C_Map` with a
  HereBeDragons-2.0 fallback for Classic-era clients.
- Picker Escape no longer collides with a module alias shortcut.
- Lua 5.1 regressions cover the fixes; current public APIs and client
  Interfaces are unchanged. No SavedVariables deletion is required.

### [v2.7.18](changelogs/2.7.18.md) - 2026-10-14

- Prevent adopting a database handle/live profile view as its own SavedVariables
  owner, avoiding a recursive C stack overflow while preserving saved values.
- Recovered metatable-poisoned profile stores remain writable, rather than
  silently dropping later settings changes.
- Lua 5.1 regressions cover both failures. Operator reports no issues after
  testing and explicitly approves stable publication; no detailed test matrix
  or independent in-game capture is claimed.

### [v2.7.17](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.17.md) - 2026-10-13

Player-accepted opt-in secure minimap item actions support preparation on one
click and item use on the next hardware click, without replacing secure OnClick.
Ordinary minimap consumers are unchanged; secure mutations are combat-guarded.

### [v2.7.16](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.16.md) - 2026-10-13

Retail 12.1.5 compatibility (Interface `120105`) and wiki-manifest publishing
fix; runtime unchanged from the v2.7.15 cycle.

### [v2.7.14](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.14.md) - 2026-10-06

Stable release of the beta-validated UI/minimap batch:

- `UI:CreateButton` selected-state support for option tabs and toggles.
- Minimap-button ownership respects ElvUI-style collectors; the backdrop frame
  background moves to `frame.backgroundTexture` for collector compatibility.
- Opt-in `legacyFlat` database migration preserves pre-existing flat settings
  when adopting profiles.
- Framework no longer prints its own startup banner to chat.

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

## Historical Beta - v2.7.15-beta.4

The prior opt-in beta preceded the v2.7.15 release line. See
[beta notes](changelogs/2.7.15-beta.4.md) for additions and tester checks.
