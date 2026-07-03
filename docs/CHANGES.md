# Changes

## Current Development Release

### Unreleased (on `main`, not yet tagged)

- **New module: RGXTooltip** — tooltip composition (`Show`/`Attach`) replacing the `SetOwner → ClearLines → AddLine × N → Show` boilerplate found across 71 GameTooltip call sites in BattlePetUtility alone, plus a safe wrapper (`HookNative`) over Blizzard's `TooltipDataProcessor` for augmenting native item/spell/unit/aura/pet/mount/macro tooltips. Blizzard does not pcall-wrap `TooltipDataProcessor` dispatch, so `HookNative` pcall-guards every registered callback — one addon's tooltip hook can no longer break tooltip rendering for every other addon.
- Documented the in-tree `tools/rgx-mcp/` MCP server and the Declarative API in README.md and description.html (shipped in v2.2.0, previously undocumented in either entry point).

### [v2.2.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.2.1.md) - 2026-07-02

- Packaging hotfix: the v2.2.0 zip leaked `docs/`, `schemas/`, and `tools/` — the packager's ignore matcher silently fails on directory entries with trailing slashes. Entries normalized; the zip now contains only the runtime (TOC, XML, core, modules, media, LICENSE).

### [v2.2.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.2.0.md) - 2026-07-02

- **rgx-mcp ships in-tree** at `tools/rgx-mcp/` — read-only MCP server (validate/audit/generate against the Simplicity Contract), excluded from the player zip; anyone with the checkout has the tool. Registered in `.mcp.json`.
- **CI: Discord notifications fixed** — the notify step now fails loudly on webhook rejection instead of silently succeeding (`curl` without `--fail` treated 4xx as success); avatar URL corrected; empty-secret guard added.
- Repaired double-encoded UTF-8 (mojibake) across 11 documentation files; deleted `docs/USAGE-BPU.md` in favor of the Tier 2 work item it described.
- **New module: RGXAuras** — taint-safe aura scanning and watching (`HasPlayerAura`/`GetPlayerAura` fast path, `HasAura`/`GetAura`/`IterateAuras` for any unit, `WatchUnit` incremental `UNIT_AURA` cache with `OnApplied`/`OnRemoved`/`OnUpdated` callbacks). Designed around Midnight's secret-aura restrictions: every potentially-secret field comparison stays behind an internal pcall boundary, so restricted units yield nil/false instead of taint. Generalizes BPU's `PlayerHasAuraSpellID` pattern; first rgx-mod trigger primitive.
- **`RGXAddon` global entry point** — line 1 of a consumer addon is the addon: `RGXAddon "MyAddon" { ... }` (curried form supported). Wraps `RGX.Addon`; per the frozen Simplicity Contract (`docs/DECLARATIVE-DSL.md`, `dsl` branch), the `local RGX = assert(...)` form is now the documented escape hatch, not the front door.
- **Declarative API contract shipped** — `schemas/rgx-addon.schema.json` (machine-checkable shape of the `RGXAddon` opts table; keys annotated `x-rgx-ships: today|tier4`, trigger vocabulary + control grammar encoded) and `docs/DECLARATIVE-API.md` (human reference for the shipped surface, verified against `core/core.lua`). This is Tier 5 #14 and the contract the external `rgx-mcp` tool validates against. Schema excluded from the packaged zip.
- `RGXSharedMedia` now fires the internal message `RGX_SHAREDMEDIA_UPDATED` after every scan so consumers can re-import bridge entries and refresh media pickers.
- Added `SM:ExcludeFolder(addonFolderName)` — consumers that manage their own media can exclude their AddOn folder from the generic scan so their paths are not re-bridged as duplicates. The framework's own folder is excluded by default.
- Packaging fixes: added missing `LICENSE.txt` (TOC already declared `X-License: MIT`); `.pkgmeta` now excludes agent/tool files (`CLAUDE.md`, `Home.md`, `.agents/`, `.claude/`, `graphify-out/`) from the zip, uses the valid `manual-changelog` key pointing at `docs/CHANGES.md`, and drops stale font-download instructions (fonts are committed under `media/fonts/`).
- Removed dead `KittyGetSoundPacks` / `KittyRegisterSoundPack` scan and hook from `RGXSharedMedia` — these globals never existed in any real addon; the generic addon-global scan already covers third-party sound packs.
- Enforced the framework's own "no `C_Timer`" rule: `RGXDelves:QueueLivesRefresh` and `RGXHonor:QueueCheck` now use `RGX:After` so deferred work is budgeted and diagnosable by the framework timer driver.
- Documented the design thesis in `CLAUDE.md`: the framework prevents taint and deprecated-API bugs by construction. Verified by audit that the framework (and consumers BLU, BPU) use only `hooksecurefunc`, no protected-function calls, with correct combat-lockdown handling.

### [v2.1.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.1.0.md) - 2026-06-30

- Enabled RGXCombat — combat enter/leave/kill/crit/low-health/execute/encounter callbacks now active for all consumers.
- Enabled 8 event callback modules that were dormant since v1.8.0: Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey.
- All modules are now active in the XML loader. No dormant code remains in-tree.
- `TryInit("RGXCombat")` wired into initialization.lua between RGXSharedMedia and RGXPetBattles.
- Removed stale comment in initialization.lua that described RGXCombat as blocked during load screen (its Init() already defers via PLAYER_REGEN_ENABLED).

Full notes:
- [v2.1.0 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.1.0.md)

## Production Releases

### [v2.0.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0.md) - 2026-06-30

- Stable RGX 2.0 framework release for retail 12.0.7.
- Promotes the RGX.Addon, NewDatabase, event, timer, and runtime integration work out of alpha.
- Keeps unfinished callback modules out of the XML loader for a clean live load.
- Includes combat-safe event/runtime hardening and SharedMedia scan coalescing from the alpha cycle.

Full notes:
- [v2.0.0 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0.md)

### [v2.0.0-alpha.2](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.2.md) - 2026-06-28

- SharedMedia startup scan now coalesces light/full rescans instead of doing the expensive generic pass immediately.
- Generic addon-global media scan is deferred until after `PLAYER_LOGIN`, reducing startup timer-slow warnings.
- Added scan-state guards so late media-provider loads can upgrade a pending scan without duplicating work.

Full notes:
- [v2.0.0-alpha.2 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.2.md)

### [v2.0.0-alpha.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.1.md) - 2026-06-11

- **RGX.Addon()** — one-call addon factory: auto-creates database, slash commands, minimap button from a single declarative table.
- **Declarative options engine** — table-driven panel builder with toggle, slider, dropdown, button, section, label controls, all auto-bound to `addon.db`.
- **Proxy fix** — `__newindex`/`__index` now guard internal fields (`_guard`, `_raw`, `_defaults`, `_callbacks`, `_onSwitch`) with `rawget`/`rawset` so they never leak into profile SavedVars.
- Fixed `MergeDefaults` → `MergeTable` (3 call sites — `MergeDefaults` was never defined).
- Added `database_test.lua` with 14 assertions, wired via `/rgx dbtest` command.
- `RGX.Addon()` now passes `opts.onSwitch` through to `NewDatabase`.
- Timer-slow threshold: 50ms → 250ms (SharedMedia:QueueScan ~207ms is normal I/O).

Full notes:
- [v2.0.0-alpha.1 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.1.md)

### [v1.9.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.9.0.md) - 2026-06-09

- **NewDatabase API** — `RGX:NewDatabase(name, defaults, opts)` with metamethod-based profile access, profile CRUD, cross-character `db.global`.
- Combat lockdown safety — `pcall(function() ... end)` closure pattern replaces raw C function reference.
- `RGXCombat` returned to dormant status.

### [v1.8.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.8.0.md) - 2026-06-09

- **BLU v7 migration foundation** — 10 callback modules (Achievement, LevelUp, Collectibles, Loot, Quest, Honor, Delves, Housing, TradingPost, Prey).
- Theme highlight tokens, combat safety guards.

### [v1.6.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.6.0.md) - 2026-05-01

## Changes

- Reworked backend font handling to properly support shared bundled fonts across downstream addons.
- Improved RGX font registration, lookup, and UI application paths so addons can reliably consume the shared font system.
- Updated shared option UI behavior for tabs, buttons, labels, and reset controls.
- Restored framework tab sizing and label anchoring to the expected RGX defaults.
- Cleaned up button/tab text handling to avoid unintended wrapping, alignment drift, and inconsistent font-string anchors.
- Rewrote README.md as a polished entry point with links to the full wiki documentation.
- Added comprehensive wiki documentation: Architecture, API Reference, Fonts System, Dropdowns System, Theming & Design, Troubleshooting, and Migration Guide.
- Updated CurseForge description.html with current module list, font counts, and documentation links.
- Fixed stale file path references (modules/fonts/fonts.lua → modules/fonts/definitions.lua).
- Fixed inconsistent dormant module wording across all docs (standardized to "in-tree but not loaded by the XML loader").
- Fixed stale interface version in Super Simple example code (110002 → 120005).
- Standardized font count language across all docs (36 bundled + 8 WoW defaults = ~44 total, 10 blocked, ~34 available).

## Fixes

- Fixed shared font plumbing needed by BattlePetUtility and SimpleQuestPlates.
- Fixed RGX option tabs using widened dimensions and incorrect text alignment.
- Fixed non-icon option tab labels being left-aligned instead of centered.
- Fixed icon tab label padding regressions.
- Removed unintended word-wrap and font-string anchor changes from shared RGX controls.
- Verified touched RGX Lua files pass syntax validation.
